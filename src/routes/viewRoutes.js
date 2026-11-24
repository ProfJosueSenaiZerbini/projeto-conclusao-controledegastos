const express = require('express');
const path = require('path');

const router = express.Router();

// Pasta onde ficam os arquivos .html das telas
const pastaViews = path.join(__dirname, '..', 'views');

// Atalho: monta o caminho completo do arquivo e envia para o navegador.
// `path.join` monta o caminho do jeito certo em qualquer sistema
// operacional (Windows usa \, Linux usa /).
function enviarTela(nomeArquivo) {
  return (req, res) => res.sendFile(path.join(pastaViews, nomeArquivo));
}

// Leva a pessoa para outro endereço do site, mantendo o que vier depois do
// "?" (como o ?token= dos links de e-mail).
//
// O destino sempre começa com UMA barra só. Sem esse cuidado, um endereço
// como "/novo//site-falso.com" viraria "//site-falso.com", que o navegador
// entende como OUTRO site: o Verdanz estaria mandando a pessoa para fora.
// A barra invertida (\) sai junto porque os navegadores leem "/\" como "//".
function levarPara(destino, req, res) {
  const busca = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect('/' + destino.replace(/^[/\\]+/, '') + busca);
}

// ---- ROTAS DAS TELAS ----
//
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

// ---- ENDEREÇOS ANTIGOS ----
//
// A primeira versão do site usava outros nomes. Quem tem esses endereços
// salvos (favoritos, links antigos) cai na tela nova equivalente.
router.get('/login', (req, res) => levarPara('/entrar', req, res));
router.get('/cadastro', (req, res) => levarPara('/criar-conta', req, res));
router.get('/dashboard', (req, res) => levarPara('/inicio', req, res));

// A versão atual foi testada primeiro em /novo, ao lado da antiga. Hoje ela
// é a principal: /novo/contas leva para /contas, /novo leva para /.
router.get(['/novo', '/novo/*caminho'], (req, res) => levarPara(req.path.slice('/novo'.length), req, res));

module.exports = router;
