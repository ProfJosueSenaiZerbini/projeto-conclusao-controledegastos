// Cliente do banco: o ÚNICO lugar do Verdanz que conversa com o banco.
//
// O resto do sistema chama estas funções e recebe dados prontos, sem
// saber de URLs, cabeçalhos ou do formato de erro do banco. Se um dia o
// banco simulado for trocado por um banco de verdade (ou pela sandbox de
// um agregador), é este arquivo que muda — o resto continua igual.
//
// A conversa é por HTTP, mesmo com o banco rodando no mesmo servidor.
// É isso que mantém a simulação honesta: o Verdanz nunca lê os dados do
// banco direto do arquivo, só pelas rotas, como faria com um banco real.

const NOME_BANCO = 'Banco Simulado';

// Para onde o banco devolve a pessoa depois de autorizar. Precisa estar
// na lista de endereços que o banco aceita (ver bancoSimulado/bancoRoutes.js).
const ENDERECO_DE_RETORNO = '/contas';

function urlDoBanco() {
  return process.env.BANCO_SIMULADO_URL || `http://localhost:${process.env.PORT || 3000}/banco-simulado`;
}

// Erro com uma mensagem que já pode ir para a tela, e o status HTTP que
// o Verdanz deve responder. O `codigo` deixa a tela reconhecer casos
// especiais (como o acesso expirado) sem comparar o texto da mensagem.
class ErroBanco extends Error {
  constructor(status, mensagem, codigo) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

// Faz a chamada e devolve o JSON. Se o banco recusar, lança um erro
// com o status DO BANCO em `statusBanco`, para quem chamou decidir o que
// isso significa para o usuário.
async function chamar(caminho, { corpo, token } = {}) {
  let resposta;

  try {
    resposta = await fetch(urlDoBanco() + caminho, {
      method: corpo ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: 'Bearer ' + token }),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      // Sem limite de tempo, um banco travado deixaria a tela do Verdanz
      // esperando para sempre.
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ErroBanco(503, 'O banco não respondeu. Tente de novo em instantes.');
  }

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    const erro = new ErroBanco(502, 'O banco respondeu com um erro inesperado.');
    erro.statusBanco = resposta.status;
    throw erro;
  }

  return dados;
}

// Traduz "token recusado" do banco para uma mensagem que o usuário entende.
// 409 (e não 401) porque o login do Verdanz continua válido: quem expirou
// foi a autorização no banco.
async function chamarComAcesso(caminho, token) {
  try {
    return await chamar(caminho, { token });
  } catch (erro) {
    if (erro.statusBanco === 401) {
      throw new ErroBanco(409, 'A autorização do banco expirou. Conecte o banco de novo.', 'CONEXAO_EXPIRADA');
    }
    throw erro;
  }
}

// ---- CONSENTIMENTO ----

// Pede ao banco acesso aos dados de um CPF. Devolve o endereço da tela
// do banco, para onde o navegador da pessoa vai ser levado.
async function pedirConsentimento(cpf, state) {
  try {
    const { data } = await chamar('/consents', {
      corpo: { cpf, redirect_uri: ENDERECO_DE_RETORNO, state },
    });
    return `${urlDoBanco()}/autorizar?consentId=${encodeURIComponent(data.consentId)}`;
  } catch (erro) {
    if (erro.statusBanco === 404) {
      throw new ErroBanco(404, `Seu CPF não é cliente do ${NOME_BANCO}.`);
    }
    throw erro;
  }
}

// Troca o código que voltou da tela do banco pelo token de acesso.
// Esta troca é de servidor para servidor: o token nunca passa pelo navegador.
async function trocarCodigo(code) {
  try {
    const dados = await chamar('/token', { corpo: { code } });
    return {
      token: dados.access_token,
      expiraEm: new Date(Date.now() + dados.expires_in * 1000),
    };
  } catch (erro) {
    if (erro.statusBanco === 400) {
      throw new ErroBanco(400, 'A autorização expirou antes de ser concluída. Tente conectar de novo.');
    }
    throw erro;
  }
}

// ---- DADOS ----

async function listarContas(token) {
  const { data } = await chamarComAcesso('/accounts', token);
  return data;
}

async function buscarSaldo(token, accountId) {
  const { data } = await chamarComAcesso(`/accounts/${encodeURIComponent(accountId)}/balances`, token);
  return data.availableAmount.amount;
}

// `desde` (AAAA-MM-DD) é opcional: sem ele, vem o extrato inteiro.
async function listarTransacoes(token, accountId, desde) {
  const filtro = desde ? `?fromBookingDate=${desde}` : '';
  const { data } = await chamarComAcesso(`/accounts/${encodeURIComponent(accountId)}/transactions${filtro}`, token);
  return data;
}

module.exports = {
  NOME_BANCO,
  ErroBanco,
  pedirConsentimento,
  trocarCodigo,
  listarContas,
  buscarSaldo,
  listarTransacoes,
};
