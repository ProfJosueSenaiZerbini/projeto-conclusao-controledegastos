const express = require('express');
const categoriaController = require('../controllers/categoriaController');
const { autenticar } = require('../middlewares/auth');

const router = express.Router();

// Exige token, mas não tem verificarDono: as categorias são as mesmas
// para todo mundo, não pertencem a ninguém.
router.get('/categoria', autenticar, categoriaController.listarCategorias);

module.exports = router;
