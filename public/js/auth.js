// Funções compartilhadas pelas telas de cadastro, login e dashboard.
// Carregado ANTES dos outros scripts em cada tela.

// ---- SESSÃO ----
// O token fica no localStorage: uma "gavetinha" do navegador que
// sobrevive ao fechar a aba. É o meio mais simples e o mais comum
// em projetos deste porte.
//
// Trade-off que vale saber: o localStorage é lido por JavaScript,
// então é vulnerável a XSS. A alternativa mais segura seria um
// cookie httpOnly, que o JavaScript não consegue ler.

const Sessao = {
  salvar(token, id_usuario) {
    localStorage.setItem('token', token);
    localStorage.setItem('id_usuario', id_usuario);
  },

  token() {
    return localStorage.getItem('token');
  },

  idUsuario() {
    return localStorage.getItem('id_usuario');
  },

  limpar() {
    localStorage.removeItem('token');
    localStorage.removeItem('id_usuario');
  },
};

// ---- MENSAGENS NA TELA ----
// Mostra o aviso no <div id="mensagem"> em vez de usar alert(),
// que trava a página e tem aparência de site antigo.

function mostrarMensagem(texto, tipo) {
  const caixa = document.getElementById('mensagem');
  if (!caixa) return;

  const cores = {
    erro: 'bg-red-50 text-red-700 border border-red-200',
    sucesso: 'bg-green-50 text-green-700 border border-green-200',
  };

  caixa.className = 'mb-5 px-4 py-3 rounded-xl text-sm ' + (cores[tipo] || cores.erro);
  caixa.textContent = texto;
}

function esconderMensagem() {
  const caixa = document.getElementById('mensagem');
  if (caixa) caixa.className = 'hidden';
}

// ---- CHAMADAS À API ----
// Centraliza o fetch para não repetir cabeçalhos e tratamento de erro.
// Devolve sempre { ok, status, dados } para quem chamou decidir o que fazer.

async function chamarApi(url, opcoes = {}) {
  const cabecalhos = { 'Content-Type': 'application/json' };

  // Se houver token guardado, manda junto. É assim que o servidor
  // sabe quem está pedindo: Authorization: Bearer <token>
  const token = Sessao.token();
  if (token) {
    cabecalhos['Authorization'] = 'Bearer ' + token;
  }

  const resposta = await fetch(url, {
    ...opcoes,
    headers: { ...cabecalhos, ...(opcoes.headers || {}) },
  });

  let dados = {};
  try {
    dados = await resposta.json();
  } catch (e) {
    // Resposta sem corpo JSON — segue com objeto vazio.
  }

  return { ok: resposta.ok, status: resposta.status, dados };
}
