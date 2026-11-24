const prisma = require('../prisma');
const { calcularAjustes, comSaldos, emCentavos, hojeSemHorario } = require('../saldo');
const { CATEGORIA_TRANSFERENCIA_SAIDA, CATEGORIA_TRANSFERENCIA_ENTRADA } = require('../categorias');

// Devolve a conta com `saldo` (o de hoje) e `saldo_previsto`, em números
// comuns. O Prisma devolve Decimal (um objeto) para não perder precisão em
// dinheiro; o JSON precisa de um número que o navegador saiba formatar.
// O cálculo dos dois saldos está explicado em src/saldo.js.
async function comSaldoNumerico(conta) {
  const ajustes = await calcularAjustes(prisma, [conta.id_conta]);
  return comSaldos(conta, ajustes);
}

// Busca a conta e confere se ela é de quem está pedindo.
// Devolve { conta } em caso de sucesso ou { erro, status } para o controller responder.
async function buscarContaDoUsuario(id_conta, id_usuario) {
  const conta = await prisma.conta.findUnique({ where: { id_conta } });

  if (!conta) {
    return { status: 404, erro: 'Conta não encontrada' };
  }

  // O id da URL vem do cliente e pode ser mentira. Sem esta checagem,
  // bastaria trocar o número para mexer na conta de outra pessoa.
  if (conta.id_usuario !== id_usuario) {
    return { status: 403, erro: 'Acesso negado a conta de outro usuário' };
  }

  return { conta };
}

// Contas importadas de um banco espelham o extrato real. Editar o saldo
// ou apagar uma delas faria o Verdanz discordar do banco (e a próxima
// sincronização traria a conta de volta). Quem atualiza é o banco.
const MENSAGEM_CONTA_IMPORTADA = {
  editar: 'Contas importadas são atualizadas pelo banco. Use "Sincronizar" na tela de Contas.',
  excluir: 'Para remover uma conta importada, desconecte o banco na tela de Contas.',
};

// POST /api/conta
async function criarConta(req, res) {
  try {
    const { nome, saldo } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'O nome da conta é obrigatório' });
    }

    // Saldo inicial é opcional — uma conta nova costuma começar zerada,
    // mas quem já tem dinheiro no banco quer informar quanto.
    let saldoInicial = 0;
    if (saldo !== undefined && saldo !== null && saldo !== '') {
      saldoInicial = Number(saldo);

      // Pode ser negativo: o dinheiro das contas manuais é informado pela
      // própria pessoa (quem começa no cheque especial, por exemplo).
      if (!Number.isFinite(saldoInicial)) {
        return res.status(400).json({ erro: 'Saldo inválido' });
      }
    }

    const conta = await prisma.conta.create({
      data: {
        nome: nome.trim(),
        saldo: saldoInicial,
        // O dono vem do TOKEN, nunca do body. Se viesse do body,
        // qualquer um criaria conta no nome de outra pessoa.
        id_usuario: req.usuario.id_usuario,
      },
    });

    res.status(201).json(await comSaldoNumerico(conta));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar conta' });
  }
}

// GET /api/usuario/:id/conta
async function listarContas(req, res) {
  try {
    const contas = await prisma.conta.findMany({
      where: { id_usuario: req.usuario.id_usuario },
      // O nome do banco vai junto para a tela mostrar o selo nas contas
      // importadas. Nas contas manuais, `conexao` vem null.
      include: { conexao: { select: { banco: true } } },
      orderBy: { id_conta: 'asc' },
    });

    // Uma consulta só para todas as contas, em vez de uma por conta.
    const ajustes = await calcularAjustes(prisma, contas.map((c) => c.id_conta));
    res.json(contas.map((c) => comSaldos(c, ajustes)));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar contas' });
  }
}

// PUT /api/conta/:id
async function atualizarConta(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const resultado = await buscarContaDoUsuario(id, req.usuario.id_usuario);
    if (resultado.erro) {
      return res.status(resultado.status).json({ erro: resultado.erro });
    }

    if (resultado.conta.id_conexao) {
      return res.status(400).json({ erro: MENSAGEM_CONTA_IMPORTADA.editar });
    }

    const { nome, saldo } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'O nome da conta é obrigatório' });
    }

    const dados = { nome: nome.trim() };

    // O saldo é opcional na edição: sem ele, só o nome muda.
    //
    // Editar o saldo serve para acertar o ponto de partida — a Carteira
    // nasce zerada no cadastro, mas a pessoa já tem dinheiro nela. É o
    // mesmo papel do saldo inicial ao criar uma conta: a partir do novo
    // valor, as transações continuam somando e subtraindo normalmente.
    if (saldo !== undefined && saldo !== null && saldo !== '') {
      const novoSaldo = Number(saldo);

      // Pode ser negativo, como o saldo inicial.
      if (!Number.isFinite(novoSaldo)) {
        return res.status(400).json({ erro: 'Saldo inválido' });
      }

      // A pessoa informa o saldo de HOJE. O banco guarda também os ganhos
      // com data futura (ver src/saldo.js), então eles são somados aqui;
      // senão, o saldo mostrado depois da edição ficaria menor que o digitado.
      const ajustes = await calcularAjustes(prisma, [id]);
      dados.saldo = (emCentavos(novoSaldo) + ajustes.get(id).ganhosFuturos) / 100;
    }

    const conta = await prisma.conta.update({
      where: { id_conta: id },
      data: dados,
    });

    res.json(await comSaldoNumerico(conta));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar conta' });
  }
}

// DELETE /api/conta/:id
async function deletarConta(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const resultado = await buscarContaDoUsuario(id, req.usuario.id_usuario);
    if (resultado.erro) {
      return res.status(resultado.status).json({ erro: resultado.erro });
    }

    if (resultado.conta.id_conexao) {
      return res.status(400).json({ erro: MENSAGEM_CONTA_IMPORTADA.excluir });
    }

    // O schema usa onDelete: Cascade — apagar a conta apaga junto todas
    // as transações dela. A tela avisa disso antes de confirmar.
    await prisma.conta.delete({ where: { id_conta: id } });

    res.json({ mensagem: 'Conta removida com sucesso' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover conta' });
  }
}

// POST /api/conta/transferencia   corpo: { id_origem, id_destino, valor }
//
// Passa dinheiro de uma conta da pessoa para outra (da Carteira para a
// poupança, por exemplo). Vira DUAS transações, uma em cada conta, porque
// Conta.saldo é a soma das transações: se os saldos mudassem sem elas, o
// histórico deixaria de explicar o saldo.
//
//   origem:  "Transferência enviada"  (despesa, já paga)
//   destino: "Transferência recebida" (receita)
//
// Transferência não é ganho nem gasto: o dinheiro continua sendo da pessoa.
// Por isso essas duas categorias ficam fora das somas de ganhos e gastos
// das telas (ehTransferencia, em public/js/auth.js).
async function transferir(req, res) {
  try {
    const id_usuario = req.usuario.id_usuario;
    const idOrigem = Number(req.body.id_origem);
    const idDestino = Number(req.body.id_destino);
    const valor = Number(req.body.valor);

    // ---- VALIDAÇÕES (antes de encostar no banco) ----

    if (!Number.isInteger(idOrigem) || !Number.isInteger(idDestino)) {
      return res.status(400).json({ erro: 'Escolha a conta de onde o dinheiro sai e a conta para onde ele vai' });
    }

    if (idOrigem === idDestino) {
      return res.status(400).json({ erro: 'Escolha duas contas diferentes' });
    }

    if (!Number.isFinite(valor) || valor <= 0) {
      return res.status(400).json({ erro: 'O valor deve ser um número maior que zero' });
    }

    // Em centavos, para não guardar 10.005 numa coluna de 2 casas.
    const valorCentavos = Math.round(valor * 100);
    if (valorCentavos <= 0) {
      return res.status(400).json({ erro: 'O valor deve ser um número maior que zero' });
    }

    // As duas contas são de quem está pedindo? E nenhuma é importada?
    const contas = {};
    for (const [papel, id] of [['origem', idOrigem], ['destino', idDestino]]) {
      const resultado = await buscarContaDoUsuario(id, id_usuario);
      if (resultado.erro) {
        return res.status(resultado.status).json({ erro: resultado.erro });
      }

      // Conta importada só muda pelo banco: o Verdanz não consegue mover
      // dinheiro de verdade entre bancos.
      if (resultado.conta.id_conexao) {
        return res.status(400).json({
          erro: `A conta "${resultado.conta.nome}" é importada do banco e só muda pela sincronização. Escolha outra conta.`,
        });
      }

      contas[papel] = resultado.conta;
    }

    // ---- A OPERAÇÃO ATÔMICA ----
    //
    // Tirar da origem, pôr no destino e registrar as duas transações: ou
    // tudo é gravado, ou nada é. Se só a saída fosse gravada, o dinheiro
    // sumiria.
    const hoje = hojeSemHorario();

    await prisma.$transaction(async (tx) => {
      // id_usuario: null = só as categorias do SISTEMA.
      const categorias = await tx.categoria.findMany({
        where: { nome_categoria: { in: [CATEGORIA_TRANSFERENCIA_SAIDA, CATEGORIA_TRANSFERENCIA_ENTRADA] }, id_usuario: null },
      });
      const saida = categorias.find((c) => c.nome_categoria === CATEGORIA_TRANSFERENCIA_SAIDA);
      const entrada = categorias.find((c) => c.nome_categoria === CATEGORIA_TRANSFERENCIA_ENTRADA);

      if (!saida || !entrada) {
        throw new ErroTransferencia(500, 'As categorias de transferência não estão cadastradas. Rode: npx prisma migrate dev');
      }

      // Como em guardar dinheiro numa meta, transferir EXIGE saldo: é mover
      // dinheiro que existe. O saldo que vale é o de HOJE, por isso os
      // ganhos com data futura (que ainda não chegaram) entram na conta.
      //
      // A condição vai no WHERE: o banco confere e desconta na mesma
      // instrução, então dois cliques juntos não tiram o dinheiro duas vezes.
      const ajustes = await calcularAjustes(tx, [idOrigem]);
      const minimoCentavos = valorCentavos + ajustes.get(idOrigem).ganhosFuturos;

      const { count } = await tx.conta.updateMany({
        where: { id_conta: idOrigem, saldo: { gte: minimoCentavos / 100 } },
        data: { saldo: { decrement: valorCentavos / 100 } },
      });

      if (count === 0) {
        throw new ErroTransferencia(400, `Saldo insuficiente: a conta "${contas.origem.nome}" não tem esse valor disponível hoje`);
      }

      await tx.conta.update({
        where: { id_conta: idDestino },
        data: { saldo: { increment: valorCentavos / 100 } },
      });

      await tx.transacao.create({
        data: {
          valor_transacao: valorCentavos / 100,
          data_transacao: hoje,
          descricao: `Transferência para ${contas.destino.nome}`,
          id_categoria: saida.id_categoria,
          id_conta: idOrigem,
          // O dinheiro saiu agora: é uma saída já paga.
          data_pagamento: hoje,
        },
      });

      await tx.transacao.create({
        data: {
          valor_transacao: valorCentavos / 100,
          data_transacao: hoje,
          descricao: `Transferência de ${contas.origem.nome}`,
          id_categoria: entrada.id_categoria,
          id_conta: idDestino,
        },
      });
    });

    // Devolve as duas contas com os saldos novos, prontas para a tela.
    const atualizadas = await prisma.conta.findMany({ where: { id_conta: { in: [idOrigem, idDestino] } } });
    const ajustes = await calcularAjustes(prisma, [idOrigem, idDestino]);
    const comSaldo = (id) => comSaldos(atualizadas.find((c) => c.id_conta === id), ajustes);

    res.status(201).json({ valor: valorCentavos / 100, origem: comSaldo(idOrigem), destino: comSaldo(idDestino) });
  } catch (erro) {
    if (erro instanceof ErroTransferencia) {
      return res.status(erro.status).json({ erro: erro.message });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao transferir entre contas' });
  }
}

// Erro com status HTTP, para ser lançado de dentro do $transaction.
// Lançar um erro lá dentro desfaz TUDO o que já tinha sido feito nele.
class ErroTransferencia extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

module.exports = {
  criarConta,
  listarContas,
  atualizarConta,
  deletarConta,
  transferir,
  buscarContaDoUsuario,
};
