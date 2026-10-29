const express = require('express');
const limiteController = require('../controllers/limiteController');
const { autenticar, verificarDono } = require('../middlewares/auth');

const router = express.Router();

// Mesmo desenho das rotas de Meta.
router.post('/limite', autenticar, limiteController.criarLimite);
router.get('/usuario/:id/limite', autenticar, verificarDono, limiteController.listarLimites);
router.put('/limite/:id', autenticar, limiteController.atualizarLimite);
router.delete('/limite/:id', autenticar, limiteController.deletarLimite);

module.exports = router;
