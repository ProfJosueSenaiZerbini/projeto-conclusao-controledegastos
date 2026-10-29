const express = require('express');
const categoriaController = require('../controllers/categoriaController');
const { autenticar } = require('../middlewares/auth');

const router = express.Router();

// Não usam verificarDono porque a URL não tem o id do usuário: quem está
// pedindo vem do token (req.usuario). O GET devolve as categorias do
// sistema mais as do próprio usuário, e o controller confere se a
// categoria editada ou excluída é mesmo dele.
router.get('/categoria', autenticar, categoriaController.listarCategorias);
router.post('/categoria', autenticar, categoriaController.criarCategoria);
router.put('/categoria/:id', autenticar, categoriaController.atualizarCategoria);
router.delete('/categoria/:id', autenticar, categoriaController.deletarCategoria);

module.exports = router;
