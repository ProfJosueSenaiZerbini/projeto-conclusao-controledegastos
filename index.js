require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const viewRoutes = require('./src/routes/viewRoutes');
const usuarioRoutes = require('./src/routes/usuarioRoutes');

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

// Qualquer rota não encontrada cai aqui.
// Atenção: no Express 5 a sintaxe app.get('*') foi removida.
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
