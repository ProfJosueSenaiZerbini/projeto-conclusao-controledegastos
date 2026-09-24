const express = require('express');
const usuarioController = require('../controllers/usuarioController');
const senhaController = require('../controllers/senhaController');
const { autenticar, verificarDono } = require('../middlewares/auth');

// Router é um "mini-app" do Express: agrupa rotas relacionadas
// num arquivo só e depois é plugado no app principal no index.js.
const router = express.Router();

// ---- ROTAS PÚBLICAS ----
// Não faz sentido exigir token para se cadastrar ou para entrar.
router.post('/usuario', usuarioController.criarUsuario);
router.post('/usuario/login', usuarioController.login);

// Esqueci a senha: quem esqueceu a senha não tem como estar logado.
// A segurança aqui vem do token que chega por e-mail, não do login.
router.post('/usuario/esqueci-senha', senhaController.esqueciSenha);
router.post('/usuario/redefinir-senha/verificar', senhaController.verificarToken);
router.post('/usuario/redefinir-senha', senhaController.redefinirSenha);

// ---- ROTAS PROTEGIDAS ----
// Os middlewares rodam em ordem, da esquerda para a direita:
// autenticar (tem token válido?) -> verificarDono (é seu?) -> controller.
router.get('/usuario/:id', autenticar, verificarDono, usuarioController.buscarUsuario);
router.put('/usuario/:id', autenticar, verificarDono, usuarioController.atualizarUsuario);
router.delete('/usuario/:id', autenticar, verificarDono, usuarioController.deletarUsuario);

module.exports = router;
