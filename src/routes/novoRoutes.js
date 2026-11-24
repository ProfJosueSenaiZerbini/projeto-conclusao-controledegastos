// Rotas das telas da VERSÃO NOVA do site (teste), que mora em /novo.
//
// A versão antiga continua em / e não foi mexida: as duas funcionam ao
// mesmo tempo e usam a mesma API e o mesmo login, para dar para comparar.
//
// As telas ficam em src/views/novo/ e os arquivos do navegador (CSS e
// JavaScript) em public/novo/.

const express = require('express');
const path = require('path');

const router = express.Router();

const pastaViews = path.join(__dirname, '..', 'views', 'novo');

function enviarTela(nomeArquivo) {
  return (req, res) => res.sendFile(path.join(pastaViews, nomeArquivo));
}

// Endereços em português e sem palavras técnicas: "entrar" em vez de
// "login", "inicio" em vez de "dashboard".
router.get('/', enviarTela('index.html'));
router.get('/entrar', enviarTela('entrar.html'));
router.get('/criar-conta', enviarTela('criar-conta.html'));
router.get('/esqueci-senha', enviarTela('esqueci-senha.html'));
router.get('/redefinir-senha', enviarTela('redefinir-senha.html'));
router.get('/confirmar-email', enviarTela('confirmar-email.html'));
// Chega pelo link do e-mail de exclusão: aberta mesmo sem estar logado.
router.get('/excluir-conta', enviarTela('excluir-conta.html'));
router.get('/perfil', enviarTela('perfil.html'));
router.get('/inicio', enviarTela('inicio.html'));
router.get('/transacoes', enviarTela('transacoes.html'));
router.get('/contas', enviarTela('contas.html'));
router.get('/metas', enviarTela('metas.html'));
router.get('/meu-perfil', enviarTela('meu-perfil.html'));
router.get('/configuracoes', enviarTela('configuracoes.html'));

module.exports = router;
