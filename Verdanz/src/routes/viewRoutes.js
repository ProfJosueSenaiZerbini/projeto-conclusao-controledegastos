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

// ---- ROTAS DAS TELAS ----
router.get('/', enviarTela('index.html'));
router.get('/login', enviarTela('login.html'));
router.get('/cadastro', enviarTela('cadastro.html'));
router.get('/dashboard', enviarTela('dashboard.html'));

module.exports = router;
