const prisma = require('../prisma');

const STATUS_VALIDOS = ['em_progresso', 'concluida', 'cancelada'];

// Ordem em que as metas aparecem: as que ainda pedem ação primeiro.
const ORDEM_STATUS = { em_progresso: 0, concluida: 1, cancelada: 2 };

// ---- STATUS AUTOMÁTICO ----
//
// "em_progresso" e "concluida" não são escolhidos pela pessoa: dependem
// só de quanto foi guardado. Chegou no valor da meta, está concluída;
// se o valor da meta subir e voltar a faltar dinheiro, volta a estar em
// progresso. Só "cancelada" é uma decisão da pessoa, e por isso o
// recálculo nunca mexe numa meta cancelada.
//
// Isso é um dado que poderia ser deduzido dos valores (como o
// percentual, que não é gravado). A coluna continua existindo porque
// "cancelada" não se deduz de nada. Para os dois nunca se contradizerem,
// o status é recalculado na MESMA operação que muda os valores.
async function recalcularStatus(tx, id_meta) {
  await tx.$executeRaw`
    UPDATE meta
    SET status = CASE WHEN valor_atual >= valor_alvo THEN 'concluida' ELSE 'em_progresso' END
    WHERE id_meta = ${id_meta} AND status <> 'cancelada'`;
}

// ---- GUARDAR DINHEIRO NA META ----
//
// O dinheiro guardado numa meta SAI de uma conta do usuário. Isso vira
// uma transação de verdade, na categoria "Metas", porque Conta.saldo é a
// soma das transações: se o saldo baixasse sem uma transação, o histórico
// deixaria de explicar o saldo.
const CATEGORIA_METAS = 'Metas';

// Erro com status HTTP, para ser lançado de dentro do $transaction.
// Lançar um erro lá dentro desfaz TUDO o que já tinha sido feito nele.
class ErroMeta extends Error {
  constructor(status, mensagem, codigo) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

// O dia de hoje no relógio do servidor, como data "pura" (sem horário).
// new Date() sozinho guardaria a data em UTC: às 22h no Brasil já seria
// o dia seguinte, e o dashboard mostraria a transação como pendente.
function hojeSemHorario() {
  const agora = new Date();
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

// Confere a conta de onde o dinheiro vai sair. Mesmas regras de um
// lançamento manual em transacaoController.
async function buscarContaDeOrigem(id_conta, id_usuario) {
  const idConta = Number(id_conta);

  if (!Number.isInteger(idConta)) {
    return { status: 400, erro: 'Escolha de qual conta o dinheiro vai sair' };
  }

  const conta = await prisma.conta.findUnique({ where: { id_conta: idConta } });

  if (!conta) {
    return { status: 404, erro: 'Conta não encontrada' };
  }

  if (conta.id_usuario !== id_usuario) {
    return { status: 403, erro: 'Acesso negado a conta de outro usuário' };
  }

  // Conta importada só muda pelo banco (regra do CLAUDE.md).
  if (conta.id_conexao) {
    return {
      status: 400,
      erro: `A conta "${conta.nome}" é importada do banco e não pode ser usada para guardar dinheiro. Escolha outra conta.`,
    };
  }

  return { conta };
}

// Tira `valor` da conta e coloca na meta. Recebe o `tx` porque SEMPRE roda
// dentro de um prisma.$transaction: debitar a conta, registrar a transação
// e somar na meta acontecem juntos, ou nada acontece.
//
// Devolve quanto entrou de fato na meta: se faltavam R$ 200 e a pessoa
// informou R$ 500, entram (e saem da conta) só R$ 200.
async function guardarNaMeta(tx, { id_meta, conta, valor }) {
  const categoria = await tx.categoria.findFirst({
    where: { nome_categoria: CATEGORIA_METAS, tipo: 'despesa' },
  });

  if (!categoria) {
    throw new ErroMeta(500, 'A categoria "Metas" não está cadastrada. Rode: npx prisma migrate dev');
  }

  // FOR UPDATE trava a linha da meta até o fim da operação. Se duas somas
  // chegarem juntas, a segunda espera a primeira terminar e já enxerga o
  // valor novo. Sem a trava, as duas calculariam o "quanto falta" com o
  // valor antigo e a conta seria debitada a mais.
  const [linha] = await tx.$queryRaw`
    SELECT titulo, valor_atual, valor_alvo, status
    FROM meta
    WHERE id_meta = ${id_meta}
    FOR UPDATE`;

  if (linha.status === 'cancelada') {
    throw new ErroMeta(400, 'Esta meta está cancelada e não recebe mais valores');
  }

  // A conta é feita em centavos (números inteiros) para fugir dos erros de
  // arredondamento do JavaScript, como 0.1 + 0.2 = 0.30000000000000004.
  const faltaCentavos = Math.round((Number(linha.valor_alvo) - Number(linha.valor_atual)) * 100);
  const valorCentavos = Math.round(valor * 100);

  if (faltaCentavos <= 0) {
    throw new ErroMeta(400, 'Esta meta já foi concluída');
  }

  const guardado = Math.min(valorCentavos, faltaCentavos) / 100;

  // Mesma checagem de saldo do lançamento manual: a condição vai no WHERE,
  // então o banco confere e desconta na mesma instrução.
  const { count } = await tx.conta.updateMany({
    where: { id_conta: conta.id_conta, saldo: { gte: guardado } },
    data: { saldo: { decrement: guardado } },
  });

  if (count === 0) {
    throw new ErroMeta(
      400,
      `Saldo insuficiente: a conta "${conta.nome}" não tem ${guardado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} disponíveis`,
      'SALDO_INSUFICIENTE'
    );
  }

  await tx.transacao.create({
    data: {
      valor_transacao: guardado,
      data_transacao: hojeSemHorario(),
      descricao: `Meta: ${linha.titulo}`,
      id_categoria: categoria.id_categoria,
      id_conta: conta.id_conta,
    },
  });

  await tx.meta.update({
    where: { id_meta },
    data: { valor_atual: { increment: guardado } },
  });

  await recalcularStatus(tx, id_meta);

  return guardado;
}

// Resposta de erro padrão para os erros lançados acima.
function responderErroMeta(res, erro) {
  return res.status(erro.status).json({
    ...(erro.codigo ? { codigo: erro.codigo } : {}),
    erro: erro.message,
  });
}

// Converte os Decimal e calcula o progresso.
//
// O percentual NÃO é gravado no banco: é dado derivado, calculado a
// partir de valor_atual e valor_alvo. Guardar um valor que pode ser
// deduzido de outros dois abriria espaço para os três se contradizerem.
function comProgresso(meta) {
  const valorAlvo = Number(meta.valor_alvo);
  const valorAtual = Number(meta.valor_atual);

  return {
    ...meta,
    valor_alvo: valorAlvo,
    valor_atual: valorAtual,
    progresso: valorAlvo > 0 ? Math.min(100, (valorAtual / valorAlvo) * 100) : 0,
  };
}

async function buscarMetaDoUsuario(id_meta, id_usuario) {
  const meta = await prisma.meta.findUnique({ where: { id_meta } });

  if (!meta) {
    return { status: 404, erro: 'Meta não encontrada' };
  }

  if (meta.id_usuario !== id_usuario) {
    return { status: 403, erro: 'Acesso negado a meta de outro usuário' };
  }

  return { meta };
}

// POST /api/meta
async function criarMeta(req, res) {
  try {
    const { titulo, valor_alvo, data_limite, valor_inicial, id_conta } = req.body;

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ erro: 'O título da meta é obrigatório' });
    }

    const valorAlvo = Number(valor_alvo);
    if (!Number.isFinite(valorAlvo) || valorAlvo <= 0) {
      return res.status(400).json({ erro: 'O valor da meta deve ser maior que zero' });
    }

    if (!data_limite) {
      return res.status(400).json({ erro: 'A data limite é obrigatória' });
    }

    const dataLimite = new Date(data_limite);
    if (Number.isNaN(dataLimite.getTime())) {
      return res.status(400).json({ erro: 'Data limite inválida' });
    }

    // Uma meta com prazo no passado nasce impossível de cumprir.
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (dataLimite < hoje) {
      return res.status(400).json({ erro: 'A data limite deve estar no futuro' });
    }

    // Valor inicial é opcional. Vazio, null ou 0 = a meta nasce zerada.
    // Se vier, precisa dizer de qual conta o dinheiro sai.
    let valorInicial = 0;
    let conta = null;

    if (valor_inicial !== undefined && valor_inicial !== null && valor_inicial !== '') {
      valorInicial = Number(valor_inicial);

      if (!Number.isFinite(valorInicial) || valorInicial < 0) {
        return res.status(400).json({ erro: 'O valor inicial deve ser um número maior que zero' });
      }

      // Na criação, recusar é mais claro do que cortar: a pessoa acabou
      // de digitar os dois valores e pode corrigir na hora.
      if (valorInicial > valorAlvo) {
        return res.status(400).json({ erro: 'O valor inicial não pode ser maior que o valor da meta' });
      }

      if (valorInicial > 0) {
        const resultado = await buscarContaDeOrigem(id_conta, req.usuario.id_usuario);
        if (resultado.erro) {
          return res.status(resultado.status).json({ erro: resultado.erro });
        }
        conta = resultado.conta;
      }
    }

    // Criar a meta e guardar o valor inicial juntos: se faltar saldo, a
    // meta também não é criada, e a pessoa tenta de novo sem duplicar.
    const meta = await prisma.$transaction(async (tx) => {
      const nova = await tx.meta.create({
        data: {
          titulo: titulo.trim(),
          valor_alvo: valorAlvo,
          data_limite: dataLimite,
          // Dono vem do token, nunca do body.
          id_usuario: req.usuario.id_usuario,
        },
      });

      if (valorInicial > 0) {
        await guardarNaMeta(tx, { id_meta: nova.id_meta, conta, valor: valorInicial });
      }

      return tx.meta.findUnique({ where: { id_meta: nova.id_meta } });
    });

    res.status(201).json(comProgresso(meta));
  } catch (erro) {
    if (erro instanceof ErroMeta) {
      return responderErroMeta(res, erro);
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar meta' });
  }
}

// GET /api/usuario/:id/meta
async function listarMetas(req, res) {
  try {
    const metas = await prisma.meta.findMany({
      where: { id_usuario: req.usuario.id_usuario },
      orderBy: { data_limite: 'asc' },
    });

    // A ordem por status é feita aqui, e não no banco: ordenando pelo
    // texto, "concluida" viria antes de "em_progresso" (ordem alfabética),
    // e as metas já alcançadas ficariam na frente das que faltam.
    // O sort do JavaScript mantém a ordem de prazo dentro de cada grupo.
    metas.sort((a, b) => ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]);

    res.json(metas.map(comProgresso));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar metas' });
  }
}

// PUT /api/meta/:id
//
// Atende dois usos: editar a meta e guardar dinheiro nela.
// Mandando { adicionar: 100, id_conta: 1 }, R$ 100 saem da conta 1 e
// entram na meta — é o que o botão "Adicionar valor" da tela usa, para
// não obrigar o usuário a calcular o novo total de cabeça.
//
// REGRA: o valor guardado nunca passa do valor da meta. Uma meta de
// R$ 3.000 fica em "3.000 de 3.000", e não "5.344 de 3.000". Se a pessoa
// informar mais do que falta, só o que falta sai da conta.
//
// REGRA: o valor guardado é dinheiro que saiu de uma conta, então ele não
// é editado à mão (valor_atual) e o valor da meta não pode ficar menor que
// ele — senão uma parte do dinheiro sumiria sem voltar para conta nenhuma.
async function atualizarMeta(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const resultado = await buscarMetaDoUsuario(id, req.usuario.id_usuario);
    if (resultado.erro) {
      return res.status(resultado.status).json({ erro: resultado.erro });
    }

    const { titulo, valor_alvo, valor_atual, data_limite, status, adicionar, id_conta } = req.body;
    const dados = {};

    if (valor_atual !== undefined) {
      return res.status(400).json({
        erro: 'O valor guardado não é editado diretamente. Use "Adicionar valor", que tira o dinheiro de uma conta.',
      });
    }

    if (titulo !== undefined) {
      if (!titulo.trim()) {
        return res.status(400).json({ erro: 'O título não pode ficar vazio' });
      }
      dados.titulo = titulo.trim();
    }

    if (valor_alvo !== undefined) {
      const v = Number(valor_alvo);
      if (!Number.isFinite(v) || v <= 0) {
        return res.status(400).json({ erro: 'O valor da meta deve ser maior que zero' });
      }
      dados.valor_alvo = v;
    }

    let valorAdicionar = null;
    let conta = null;

    if (adicionar !== undefined) {
      const v = Number(adicionar);
      if (!Number.isFinite(v) || v <= 0) {
        return res.status(400).json({ erro: 'O valor a adicionar deve ser maior que zero' });
      }
      valorAdicionar = v;

      const origem = await buscarContaDeOrigem(id_conta, req.usuario.id_usuario);
      if (origem.erro) {
        return res.status(origem.status).json({ erro: origem.erro });
      }
      conta = origem.conta;
    }

    if (data_limite !== undefined) {
      const d = new Date(data_limite);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ erro: 'Data limite inválida' });
      }
      dados.data_limite = d;
    }

    if (status !== undefined) {
      if (!STATUS_VALIDOS.includes(status)) {
        return res.status(400).json({
          erro: `Status deve ser: ${STATUS_VALIDOS.join(', ')}`,
        });
      }
      dados.status = status;
    }

    if (Object.keys(dados).length === 0 && valorAdicionar === null) {
      return res.status(400).json({ erro: 'Nenhum campo enviado para atualização' });
    }

    let guardado = null;

    const meta = await prisma.$transaction(async (tx) => {
      // Baixar o valor da meta abaixo do que já foi guardado é recusado.
      // A leitura usa FOR UPDATE pelo mesmo motivo de guardarNaMeta: uma
      // soma chegando ao mesmo tempo não escapa da comparação.
      if (dados.valor_alvo !== undefined) {
        const [linha] = await tx.$queryRaw`
          SELECT valor_atual FROM meta WHERE id_meta = ${id} FOR UPDATE`;

        if (dados.valor_alvo < Number(linha.valor_atual)) {
          throw new ErroMeta(
            400,
            `Você já guardou ${Number(linha.valor_atual).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} nesta meta. O valor dela não pode ficar menor que isso.`
          );
        }
      }

      if (Object.keys(dados).length > 0) {
        await tx.meta.update({ where: { id_meta: id }, data: dados });
      }

      if (valorAdicionar !== null) {
        guardado = await guardarNaMeta(tx, { id_meta: id, conta, valor: valorAdicionar });
      }

      // Depois de os valores estarem certos, o status acompanha.
      // Se a pessoa mandou status "concluida" ou "em_progresso", quem
      // decide de verdade são os valores; "cancelada" é respeitado.
      await recalcularStatus(tx, id);

      return tx.meta.findUnique({ where: { id_meta: id } });
    });

    // valor_guardado diz à tela quanto saiu da conta de fato (pode ser
    // menos do que o informado, quando faltava pouco para a meta).
    res.json(guardado === null ? comProgresso(meta) : { ...comProgresso(meta), valor_guardado: guardado });
  } catch (erro) {
    if (erro instanceof ErroMeta) {
      return responderErroMeta(res, erro);
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar meta' });
  }
}

// DELETE /api/meta/:id
async function deletarMeta(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const resultado = await buscarMetaDoUsuario(id, req.usuario.id_usuario);
    if (resultado.erro) {
      return res.status(resultado.status).json({ erro: resultado.erro });
    }

    await prisma.meta.delete({ where: { id_meta: id } });

    res.json({ mensagem: 'Meta removida com sucesso' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover meta' });
  }
}

module.exports = { criarMeta, listarMetas, atualizarMeta, deletarMeta };
