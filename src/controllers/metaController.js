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
    const { titulo, valor_alvo, data_limite } = req.body;

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

    const meta = await prisma.meta.create({
      data: {
        titulo: titulo.trim(),
        valor_alvo: valorAlvo,
        data_limite: dataLimite,
        // Dono vem do token, nunca do body.
        id_usuario: req.usuario.id_usuario,
      },
    });

    res.status(201).json(comProgresso(meta));
  } catch (erro) {
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
// Atende dois usos: editar a meta e somar dinheiro nela.
// Mandando { adicionar: 100 }, o valor é somado ao que já existe —
// é o que o botão "Adicionar valor" da tela usa, para não obrigar o
// usuário a calcular o novo total de cabeça.
//
// REGRA: o valor guardado nunca passa do valor da meta. Uma meta de
// R$ 3.000 fica em "3.000 de 3.000", e não "5.344 de 3.000": o que
// passou do alvo não é dinheiro guardado PARA aquela meta.
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

    const { titulo, valor_alvo, valor_atual, data_limite, status, adicionar } = req.body;
    const dados = {};

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

    if (adicionar !== undefined) {
      const v = Number(adicionar);
      if (!Number.isFinite(v) || v <= 0) {
        return res.status(400).json({ erro: 'O valor a adicionar deve ser maior que zero' });
      }
      // A soma é feita mais abaixo, direto no banco, já com o limite.
      valorAdicionar = v.toFixed(2);
    } else if (valor_atual !== undefined) {
      const v = Number(valor_atual);
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({ erro: 'Valor guardado inválido' });
      }
      dados.valor_atual = v;
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

    const meta = await prisma.$transaction(async (tx) => {
      if (Object.keys(dados).length > 0) {
        await tx.meta.update({ where: { id_meta: id }, data: dados });
      }

      // Somar e limitar numa instrução só, dentro do próprio banco.
      // LEAST devolve o menor dos dois: o total somado ou o valor da meta.
      //
      // Por que não ler o valor, calcular no JavaScript e gravar? Porque
      // duas somas enviadas ao mesmo tempo leriam o mesmo valor antigo e
      // uma apagaria a outra. Feito no banco, cada soma parte do valor
      // que já está lá.
      //
      // Também roda quando só o alvo ou o valor guardado mudam: se a
      // pessoa baixar a meta de R$ 3.000 para R$ 2.000, o guardado acompanha.
      //
      // O CAST mantém a conta em decimal exato (sem os erros de
      // arredondamento de 0.1 + 0.2). O ${...} vira parâmetro da consulta,
      // nunca texto colado no SQL, então não abre brecha para SQL injection.
      if (valorAdicionar !== null) {
        await tx.$executeRaw`
          UPDATE meta
          SET valor_atual = LEAST(valor_atual + CAST(${valorAdicionar} AS DECIMAL(12, 2)), valor_alvo)
          WHERE id_meta = ${id}`;
      } else if (dados.valor_alvo !== undefined || dados.valor_atual !== undefined) {
        await tx.$executeRaw`
          UPDATE meta
          SET valor_atual = LEAST(valor_atual, valor_alvo)
          WHERE id_meta = ${id}`;
      }

      // Depois de os valores estarem certos, o status acompanha.
      // Se a pessoa mandou status "concluida" ou "em_progresso", quem
      // decide de verdade são os valores; "cancelada" é respeitado.
      await recalcularStatus(tx, id);

      return tx.meta.findUnique({ where: { id_meta: id } });
    });

    res.json(comProgresso(meta));
  } catch (erro) {
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
