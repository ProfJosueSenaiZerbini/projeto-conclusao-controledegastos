const express = require('express');
const conexaoController = require('../controllers/conexaoController');
const { autenticar } = require('../middlewares/auth');

const router = express.Router();

// Todas protegidas: só quem está logado conecta um banco. As rotas com
// :id conferem no controller se a conexão é de quem está pedindo.
router.post('/conexao-bancaria', autenticar, conexaoController.iniciarConexao);
router.post('/conexao-bancaria/finalizar', autenticar, conexaoController.finalizarConexao);
router.get('/conexao-bancaria', autenticar, conexaoController.listarConexoes);
router.post('/conexao-bancaria/:id/sincronizar', autenticar, conexaoController.sincronizarConexao);
router.delete('/conexao-bancaria/:id', autenticar, conexaoController.desconectar);

module.exports = router;
