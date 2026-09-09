const prisma = require('../prisma');

const STATUS_VALIDOS = ['em_progresso', 'concluida', 'cancelada'];

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
      orderBy: [{ status: 'asc' }, { data_limite: 'asc' }],
    });

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

    if (adicionar !== undefined) {
      const v = Number(adicionar);
      if (!Number.isFinite(v) || v <= 0) {
        return res.status(400).json({ erro: 'O valor a adicionar deve ser maior que zero' });
      }
      dados.valor_atual = { increment: v };
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

    if (Object.keys(dados).length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo enviado para atualização' });
    }

    const meta = await prisma.meta.update({
      where: { id_meta: id },
      data: dados,
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
