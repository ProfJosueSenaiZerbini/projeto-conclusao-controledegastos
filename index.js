require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const viewRoutes = require('./src/routes/viewRoutes');
const usuarioRoutes = require('./src/routes/usuarioRoutes');
const contaRoutes = require('./src/routes/contaRoutes');
const categoriaRoutes = require('./src/routes/categoriaRoutes');
const transacaoRoutes = require('./src/routes/transacaoRoutes');
const metaRoutes = require('./src/routes/metaRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Arquivos estáticos (imagens, css, js do navegador).
// Tudo dentro de public/ fica acessível direto pela URL:
// public/img/Verdanz.png  ->  http://localhost:3000/img/Verdanz.png
app.use(express.static(path.join(__dirname, 'public')));

// Telas (HTML)
app.use('/', viewRoutes);

// API (JSON) — sempre com prefixo /api para não colidir com as telas
app.use('/api', usuarioRoutes);
app.use('/api', contaRoutes);
app.use('/api', categoriaRoutes);
app.use('/api', transacaoRoutes);
app.use('/api', metaRoutes);

// Qualquer rota não encontrada cai aqui.
// Atenção: no Express 5 a sintaxe app.get('*') foi removida.
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Tratador de erro global. Um middleware com QUATRO parâmetros é como o
// Express reconhece que ele trata erros — não dá para omitir o `next`,
// mesmo sem usar.
//
// Sem isto, um corpo de requisição com JSON malformado faz o Express
// responder uma página HTML de erro. O front-end espera JSON e quebraria
// ao tentar interpretar a resposta.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'Corpo da requisição não é um JSON válido' });
  }

  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
