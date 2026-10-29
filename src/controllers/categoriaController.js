const prisma = require('../prisma');
const { CATEGORIA_METAS, normalizarNome, visiveisPara, buscarCategoriaVisivel } = require('../categorias');

const TIPOS_VALIDOS = ['despesa', 'receita'];
const TAMANHO_MAXIMO_NOME = 50;

// Erro com status HTTP, para ser lançado de dentro do $transaction.
// Lançar um erro lá dentro desfaz TUDO o que já tinha sido feito nele.
class ErroCategoria extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// Confere o nome antes de criar ou renomear. Devolve a mensagem de erro,
// ou null se o nome pode ser usado.
//
// O nome não pode repetir uma categoria do SISTEMA nem outra do próprio
// usuário. A repetição com o sistema não é barrada pelo @@unique do banco
// (no MySQL, o índice único aceita vários nulos), por isso a conferência
// é feita aqui. "Metas" entra junto: é uma categoria do sistema.
async function conferirNome(nome, id_usuario, idIgnorado = null) {
  if (!nome) {
    return 'Dê um nome para a categoria';
  }

  if (nome.length > TAMANHO_MAXIMO_NOME) {
    return `O nome pode ter no máximo ${TAMANHO_MAXIMO_NOME} letras`;
  }

  const existentes = await prisma.categoria.findMany({
    where: visiveisPara(id_usuario),
    select: { id_categoria: true, nome_categoria: true, id_usuario: true },
  });

  const repetida = existentes.find(
    (c) => c.id_categoria !== idIgnorado && normalizarNome(c.nome_categoria) === normalizarNome(nome)
  );

  if (!repetida) return null;

  return repetida.id_usuario === null
    ? `"${repetida.nome_categoria}" já é uma categoria do Verdanz. Escolha outro nome.`
    : `Você já tem uma categoria chamada "${repetida.nome_categoria}"`;
}

// Busca uma categoria PERSONALIZADA do usuário, para editar ou excluir.
// As do sistema são de todos e não podem ser mexidas por ninguém.
async function buscarCategoriaDoUsuario(id_categoria, id_usuario) {
  const categoria = await buscarCategoriaVisivel(prisma, id_categoria, id_usuario);

  if (!categoria) {
    return { status: 404, erro: 'Categoria não encontrada' };
  }

  if (categoria.id_usuario === null) {
    return { status: 403, erro: 'As categorias do Verdanz não podem ser alteradas nem excluídas' };
  }

  return { categoria };
}

// GET /api/categoria
//
// Devolve as 13 categorias do sistema mais as personalizadas de quem está
// pedindo. As personalizadas vêm com `total_transacoes`, que a tela usa
// para avisar antes de excluir e para travar a troca de tipo.
async function listarCategorias(req, res) {
  try {
    const categorias = await prisma.categoria.findMany({
      where: visiveisPara(req.usuario.id_usuario),
      include: { _count: { select: { transacoes: true } } },
      orderBy: [{ tipo: 'asc' }, { nome_categoria: 'asc' }],
    });

    res.json(
      categorias.map(({ _count, ...categoria }) => ({
        ...categoria,
        personalizada: categoria.id_usuario !== null,
        // Numa categoria do sistema, a contagem somaria as transações de
        // TODOS os usuários. Esse número não é da conta de ninguém.
        total_transacoes: categoria.id_usuario !== null ? _count.transacoes : undefined,
      }))
    );
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar categorias' });
  }
}

// POST /api/categoria   corpo: { nome_categoria, tipo }
async function criarCategoria(req, res) {
  try {
    const nome = String(req.body.nome_categoria || '').trim();
    const { tipo } = req.body;

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ erro: 'Escolha se a categoria é de gasto ou de ganho' });
    }

    const erroNome = await conferirNome(nome, req.usuario.id_usuario);
    if (erroNome) {
      return res.status(400).json({ erro: erroNome });
    }

    const categoria = await prisma.categoria.create({
      data: {
        nome_categoria: nome,
        tipo,
        // Dono vem do token, nunca do body.
        id_usuario: req.usuario.id_usuario,
      },
    });

    res.status(201).json({ ...categoria, personalizada: true, total_transacoes: 0 });
  } catch (erro) {
    // P2002 = o @@unique([id_usuario, nome_categoria]) barrou. Acontece se
    // dois pedidos iguais chegarem juntos e passarem pela conferência.
    if (erro.code === 'P2002') {
      return res.status(409).json({ erro: 'Você já tem uma categoria com esse nome' });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar categoria' });
  }
}

// PUT /api/categoria/:id   corpo: { nome_categoria?, tipo? }
//
// REGRA: o tipo só muda enquanto a categoria não tiver transações. O saldo
// das contas foi calculado com o tipo de cada transação (ganho soma, gasto
// subtrai). Trocar o tipo depois inverteria esse efeito em todo o
// histórico, e o saldo deixaria de bater com as transações.
async function atualizarCategoria(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const resultado = await buscarCategoriaDoUsuario(id, req.usuario.id_usuario);
    if (resultado.erro) {
      return res.status(resultado.status).json({ erro: resultado.erro });
    }

    const { categoria } = resultado;
    const dados = {};

    if (req.body.nome_categoria !== undefined) {
      const nome = String(req.body.nome_categoria).trim();
      const erroNome = await conferirNome(nome, req.usuario.id_usuario, id);
      if (erroNome) {
        return res.status(400).json({ erro: erroNome });
      }
      dados.nome_categoria = nome;
    }

    const trocaTipo = req.body.tipo !== undefined && req.body.tipo !== categoria.tipo;

    if (trocaTipo) {
      if (!TIPOS_VALIDOS.includes(req.body.tipo)) {
        return res.status(400).json({ erro: 'Escolha se a categoria é de gasto ou de ganho' });
      }
      dados.tipo = req.body.tipo;
    }

    if (Object.keys(dados).length === 0) {
      return res.status(400).json({ erro: 'Nada foi alterado' });
    }

    const atualizada = await prisma.$transaction(async (tx) => {
      if (trocaTipo) {
        // Limite de gasto só existe em categoria de gasto.
        const limites = await tx.limiteCategoria.count({ where: { id_categoria: id } });
        if (limites > 0) {
          throw new ErroCategoria(400, 'Esta categoria tem um limite de gasto. Remova o limite na tela de Metas antes de trocar o tipo.');
        }
      }

      // "transacoes: { none: {} }" vai no WHERE quando o tipo muda: o banco
      // confere "não tem transação" e altera na mesma instrução. Se uma
      // transação for lançada no meio do caminho, nada é alterado.
      const { count } = await tx.categoria.updateMany({
        where: { id_categoria: id, ...(trocaTipo ? { transacoes: { none: {} } } : {}) },
        data: dados,
      });

      if (count === 0) {
        throw new ErroCategoria(400, 'Esta categoria já tem transações, então o tipo (gasto ou ganho) não pode mais ser trocado.');
      }

      return tx.categoria.findUnique({
        where: { id_categoria: id },
        include: { _count: { select: { transacoes: true } } },
      });
    });

    const { _count, ...semContagem } = atualizada;
    res.json({ ...semContagem, personalizada: true, total_transacoes: _count.transacoes });
  } catch (erro) {
    if (erro instanceof ErroCategoria) {
      return res.status(erro.status).json({ erro: erro.message });
    }

    if (erro.code === 'P2002') {
      return res.status(409).json({ erro: 'Você já tem uma categoria com esse nome' });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar categoria' });
  }
}

// DELETE /api/categoria/:id?mover_para=ID
//
// Sem transações, a categoria é apagada direto. Com transações, é preciso
// dizer para qual categoria elas vão (mover_para): uma transação não pode
// ficar sem categoria, porque é a categoria que diz se ela é ganho ou gasto.
//
// O destino precisa ter o MESMO tipo. Assim mover não mexe em saldo
// nenhum: um gasto continua sendo gasto, só muda de nome de categoria.
async function deletarCategoria(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const resultado = await buscarCategoriaDoUsuario(id, req.usuario.id_usuario);
    if (resultado.erro) {
      return res.status(resultado.status).json({ erro: resultado.erro });
    }

    const { categoria } = resultado;
    let destino = null;

    if (req.query.mover_para !== undefined) {
      const idDestino = Number(req.query.mover_para);

      if (!Number.isInteger(idDestino) || idDestino === id) {
        return res.status(400).json({ erro: 'Escolha outra categoria para receber as transações' });
      }

      destino = await buscarCategoriaVisivel(prisma, idDestino, req.usuario.id_usuario);

      if (!destino) {
        return res.status(404).json({ erro: 'A categoria de destino não foi encontrada' });
      }

      if (destino.tipo !== categoria.tipo) {
        return res.status(400).json({ erro: 'As transações só podem ir para uma categoria do mesmo tipo (gasto ou ganho)' });
      }

      if (destino.nome_categoria === CATEGORIA_METAS) {
        return res.status(400).json({ erro: 'A categoria "Metas" é usada só pela tela de Metas' });
      }
    }

    const movidas = await prisma.$transaction(async (tx) => {
      let quantas = 0;

      if (destino) {
        const { count } = await tx.transacao.updateMany({
          where: { id_categoria: id },
          data: { id_categoria: destino.id_categoria },
        });
        quantas = count;
      }

      // Mesma ideia do PUT: "não tem transação" é conferido na própria
      // instrução que apaga. O limite da categoria sai junto (Cascade).
      const { count } = await tx.categoria.deleteMany({
        where: { id_categoria: id, transacoes: { none: {} } },
      });

      if (count === 0) {
        throw new ErroCategoria(
          409,
          'Esta categoria tem transações. Escolha para qual categoria elas vão antes de excluir.'
        );
      }

      return quantas;
    });

    res.json({
      mensagem: 'Categoria excluída',
      transacoes_movidas: movidas,
      ...(destino ? { movidas_para: destino.nome_categoria } : {}),
    });
  } catch (erro) {
    if (erro instanceof ErroCategoria) {
      return res.status(erro.status).json({ erro: erro.message });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao excluir categoria' });
  }
}

module.exports = { listarCategorias, criarCategoria, atualizarCategoria, deletarCategoria };
