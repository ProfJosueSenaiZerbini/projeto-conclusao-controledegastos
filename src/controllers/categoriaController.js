const prisma = require('../prisma');

// GET /api/categoria
//
// A lista é fixa: 12 categorias criadas pelo seed, 8 de despesa e 4 de
// receita. O usuário não cria categorias nesta fase — por isso existe
// só a leitura, sem POST, PUT ou DELETE.
async function listarCategorias(req, res) {
  try {
    const categorias = await prisma.categoria.findMany({
      orderBy: [{ tipo: 'asc' }, { nome_categoria: 'asc' }],
    });

    res.json(categorias);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar categorias' });
  }
}

module.exports = { listarCategorias };
