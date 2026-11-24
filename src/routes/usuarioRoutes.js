const express = require('express');
const usuarioController = require('../controllers/usuarioController');
const senhaController = require('../controllers/senhaController');
const emailController = require('../controllers/emailController');
const exclusaoController = require('../controllers/exclusaoController');
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

// Confirmar a troca de e-mail também é público: quem clica no link pode
// estar em outro aparelho, sem sessão. A segurança vem do token.
router.post('/usuario/confirmar-email/verificar', emailController.verificarTokenEmail);
router.post('/usuario/confirmar-email', emailController.confirmarTrocaEmail);

// Excluir a conta, pelo link do e-mail: também público, pelo mesmo motivo.
// Quem prova que é o dono é o token do link (exclusaoController.js).
router.post('/usuario/excluir-conta/verificar', exclusaoController.verificarExclusao);
router.post('/usuario/excluir-conta', exclusaoController.confirmarExclusao);

// ---- ROTAS PROTEGIDAS ----
// Os middlewares rodam em ordem, da esquerda para a direita:
// autenticar (tem token válido?) -> verificarDono (é seu?) -> controller.
router.get('/usuario/:id', autenticar, verificarDono, usuarioController.buscarUsuario);
router.put('/usuario/:id', autenticar, verificarDono, usuarioController.atualizarUsuario);

// Pedir a troca de e-mail: além do token, o controller exige a senha atual.
router.post('/usuario/:id/email', autenticar, verificarDono, emailController.solicitarTrocaEmail);
// Zona de perigo de Configurações. As duas pedem a senha no corpo.
//   resetar: apaga os dados financeiros e mantém o login;
//   excluir-conta: só MANDA o link por e-mail. A exclusão acontece no clique.
// Não existe mais DELETE /usuario/:id: com ele, uma sessão aberta bastava
// para apagar tudo, sem senha e sem e-mail.
router.post('/usuario/:id/resetar', autenticar, verificarDono, exclusaoController.resetarDados);
router.post('/usuario/:id/excluir-conta', autenticar, verificarDono, exclusaoController.solicitarExclusao);

module.exports = router;
