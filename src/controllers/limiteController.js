const prisma = require('../prisma');
const { emCentavos } = require('../saldo');
const { CATEGORIA_METAS, buscarCategoriaVisivel } = require('../categorias');

// ---- LIMITE DE GASTO POR CATEGORIA ----
//
// "No máximo R$ 500 por mês em Lazer". O limite vale para o mês atual e
// renova sozinho no dia 1: não existe nada para "zerar", porque o gasto do
// mês é sempre calculado de novo a partir das transações.
//
// O que conta como gasto do mês: as despesas da categoria com data dentro
// do mês, PAGAS OU NÃO. Uma conta a pagar ainda não saiu do saldo, mas o
// dinheiro já está comprometido com aquela categoria. Isso inclui as
// transações importadas do banco, que são gastos de verdade.

// A partir de quanto o limite pede atenção (em %). Os números vêm das
// personas: Diego e Ana querem aviso aos 80%, Felipe aos 70% e 90%.
// Ficou o menor, para avisar com folga.
const PERCENTUAL_ATENCAO = 70;

// Primeiro dia deste mês e do próximo, como datas "puras" (sem horário),
// no mesmo formato de hojeSemHorario (src/saldo.js).
function limitesDoMes() {
  const agora = new Date();
  return {
    inicio: new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), 1)),
    fim: new Date(Date.UTC(agora.getFullYear(), agora.getMonth() + 1, 1)),
  };
}

// Soma o gasto do mês de cada categoria pedida, numa consulta só.
// Devolve um Map: id_categoria → centavos gastos.
async function gastosDoMes(id_usuario, idsCategorias) {
  const gastos = new Map(idsCategorias.map((id) => [id, 0]));
  if (idsCategorias.length === 0) return gastos;

  const { inicio, fim } = limitesDoMes();

  // Transacao não tem id_usuario (3FN): o dono é achado pela conta.
  const somas = await prisma.transacao.groupBy({
    by: ['id_categoria'],
    where: {
      id_categoria: { in: idsCategorias },
      conta: { id_usuario },
      data_transacao: { gte: inicio, lt: fim },
    },
    _sum: { valor_transacao: true },
  });

  somas.forEach((s) => gastos.set(s.id_categoria, emCentavos(s._sum.valor_transacao)));
  return gastos;
}

// Junta o limite com o gasto do mês e calcula a situação.
//
// Nada disto é gravado: percentual, restante e situação saem do limite e
// das transações. Mesmo motivo do progresso das metas.
function comSituacao(limite, gastoCentavos) {
  const limiteCentavos = emCentavos(limite.valor_limite);
  const percentual = limiteCentavos > 0 ? (gastoCentavos / limiteCentavos) * 100 : 0;

  let situacao = 'ok';
  if (percentual >= 100) situacao = 'estourado';
  else if (percentual >= PERCENTUAL_ATENCAO) situacao = 'atencao';

  return {
    id_limite: limite.id_limite,
    id_categoria: limite.id_categoria,
    nome_categoria: limite.categoria.nome_categoria,
    valor_limite: limiteCentavos / 100,
    gasto_mes: gastoCentavos / 100,
    // Negativo = quanto passou do limite.
    restante: (limiteCentavos - gastoCentavos) / 100,
    percentual,
    situacao,
  };
}

// Lê e confere o valor do limite. Devolve o número ou null se inválido.
function lerValor(valor) {
  const v = Number(valor);
  return Number.isFinite(v) && v > 0 ? v : null;
}

async function buscarLimiteDoUsuario(id_limite, id_usuario) {
  const limite = await prisma.limiteCategoria.findUnique({
    where: { id_limite },
    include: { categoria: true },
  });

  if (!limite) {
    return { status: 404, erro: 'Limite não encontrado' };
  }

  if (limite.id_usuario !== id_usuario) {
    return { status: 403, erro: 'Acesso negado a limite de outro usuário' };
  }

  return { limite };
}

// Responde um limite já com o gasto do mês calculado.
async function responderLimite(res, status, limite, id_usuario) {
  const gastos = await gastosDoMes(id_usuario, [limite.id_categoria]);
  res.status(status).json(comSituacao(limite, gastos.get(limite.id_categoria)));
}

// GET /api/usuario/:id/limite
async function listarLimites(req, res) {
  try {
    const id_usuario = req.usuario.id_usuario;

    const limites = await prisma.limiteCategoria.findMany({
      where: { id_usuario },
      include: { categoria: true },
    });

    const gastos = await gastosDoMes(id_usuario, limites.map((l) => l.id_categoria));
    const lista = limites.map((l) => comSituacao(l, gastos.get(l.id_categoria)));

    // Os que mais pedem atenção primeiro.
    lista.sort((a, b) => b.percentual - a.percentual);

    res.json(lista);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar limites' });
  }
}

// POST /api/limite   corpo: { id_categoria, valor_limite }
async function criarLimite(req, res) {
  try {
    const id_usuario = req.usuario.id_usuario;
    const idCategoria = Number(req.body.id_categoria);
    const valor = lerValor(req.body.valor_limite);

    if (!Number.isInteger(idCategoria)) {
      return res.status(400).json({ erro: 'Escolha a categoria' });
    }

    if (valor === null) {
      return res.status(400).json({ erro: 'O limite deve ser um valor maior que zero' });
    }

    // Do sistema ou do próprio usuário — nunca a categoria de outra pessoa.
    const categoria = await buscarCategoriaVisivel(prisma, idCategoria, id_usuario);

    if (!categoria) {
      return res.status(404).json({ erro: 'Categoria não encontrada' });
    }

    if (categoria.tipo !== 'despesa') {
      return res.status(400).json({ erro: 'Limite de gasto só existe para categorias de gasto' });
    }

    // Dinheiro guardado numa meta não é gasto: é o contrário. Limitar
    // "Metas" seria pedir para a pessoa guardar menos.
    if (categoria.nome_categoria === CATEGORIA_METAS) {
      return res.status(400).json({ erro: 'Dinheiro guardado em metas não é gasto e não tem limite' });
    }

    const limite = await prisma.limiteCategoria.create({
      data: { valor_limite: valor, id_categoria: idCategoria, id_usuario },
      include: { categoria: true },
    });

    await responderLimite(res, 201, limite, id_usuario);
  } catch (erro) {
    // P2002 = o @@unique([id_usuario, id_categoria]) barrou.
    if (erro.code === 'P2002') {
      return res.status(409).json({ erro: 'Esta categoria já tem um limite. Altere o valor do limite existente.' });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar limite' });
  }
}

// PUT /api/limite/:id   corpo: { valor_limite }
// A categoria não muda: para limitar outra, cria-se outro limite.
async function atualizarLimite(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const valor = lerValor(req.body.valor_limite);
    if (valor === null) {
      return res.status(400).json({ erro: 'O limite deve ser um valor maior que zero' });
    }

    const resultado = await buscarLimiteDoUsuario(id, req.usuario.id_usuario);
    if (resultado.erro) {
      return res.status(resultado.status).json({ erro: resultado.erro });
    }

    const limite = await prisma.limiteCategoria.update({
      where: { id_limite: id },
      data: { valor_limite: valor },
      include: { categoria: true },
    });

    await responderLimite(res, 200, limite, req.usuario.id_usuario);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar limite' });
  }
}

// DELETE /api/limite/:id
// Só tira o limite. Nenhuma transação muda.
async function deletarLimite(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const resultado = await buscarLimiteDoUsuario(id, req.usuario.id_usuario);
    if (resultado.erro) {
      return res.status(resultado.status).json({ erro: resultado.erro });
    }

    await prisma.limiteCategoria.delete({ where: { id_limite: id } });

    res.json({ mensagem: 'Limite removido' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover limite' });
  }
}

module.exports = { listarLimites, criarLimite, atualizarLimite, deletarLimite };
