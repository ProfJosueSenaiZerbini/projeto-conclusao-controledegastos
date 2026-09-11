const express = require('express');
const usuarioController = require('../controllers/usuarioController');
const { autenticar, verificarDono } = require('../middlewares/auth');

// Router é um "mini-app" do Express: agrupa rotas relacionadas
// num arquivo só e depois é plugado no app principal no index.js.
const router = express.Router();

// ---- ROTAS PÚBLICAS ----
// Não faz sentido exigir token para se cadastrar ou para entrar.
router.post('/usuario', usuarioController.criarUsuario);
router.post('/usuario/login', usuarioController.login);

// Quem esqueceu a senha, por definição, não consegue fazer login.
// A segurança aqui vem do token enviado por e-mail, não do token de login.
router.post('/usuario/esqueci-senha', usuarioController.esqueciSenha);
router.post('/usuario/redefinir-senha', usuarioController.redefinirSenha);

// ---- ROTAS PROTEGIDAS ----
// Os middlewares rodam em ordem, da esquerda para a direita:
// autenticar (tem token válido?) -> verificarDono (é seu?) -> controller.
router.get('/usuario/:id', autenticar, verificarDono, usuarioController.buscarUsuario);
router.put('/usuario/:id', autenticar, verificarDono, usuarioController.atualizarUsuario);
router.delete('/usuario/:id', autenticar, verificarDono, usuarioController.deletarUsuario);

module.exports = router;
