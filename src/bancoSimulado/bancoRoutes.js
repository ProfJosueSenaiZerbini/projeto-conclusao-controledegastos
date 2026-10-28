const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const dados = require('./dados.json');

// ---- BANCO SIMULADO ----
//
// Este arquivo NÃO faz parte do Verdanz. Ele finge ser um banco externo,
// para o Verdanz ter com quem "conversar" ao importar contas e transações.
// Os dois rodam no mesmo servidor só por comodidade.
//
// Regras que mantêm a simulação honesta:
// - O banco tem os próprios dados (dados.json) e nunca lê o MySQL do Verdanz.
// - O Verdanz nunca lê o dados.json: só chama estas rotas, como faria com
//   um banco de verdade.
// - As respostas vêm no "jeito do banco", inspirado no padrão do Open
//   Finance (nomes em inglês, valores como texto). Quem traduz para o
//   modelo do Verdanz é o próprio Verdanz.
//
// O fluxo imita o Open Finance, em três crachás (tokens):
//   1. CONSENTIMENTO: o app pede acesso aos dados de um CPF.
//   2. CÓDIGO: o cliente autoriza na tela do banco e o banco devolve
//      um código de curta duração.
//   3. ACESSO: o app troca o código por um token de acesso, e é com ele
//      que busca contas e transações.
//
// Simplificação consciente: o Open Finance real exige certificados
// digitais e o protocolo FAPI. Aqui mantemos o formato do fluxo, sem
// essa camada de segurança.

const router = express.Router();

// O banco tem o próprio segredo, separado do JWT_SECRET do Verdanz:
// são dois sistemas diferentes, e um não deve conseguir assinar os
// crachás do outro. O valor padrão serve só porque o banco é fictício.
const SEGREDO_BANCO = process.env.BANCO_SIMULADO_SECRET || 'segredo-do-banco-simulado';

const PRAZO = {
  consentimento: '10m', // tempo para o cliente abrir a tela e autorizar
  codigo: '5m',         // o código só serve para ser trocado na hora
  acesso: '90d',        // depois de autorizado, o app pode sincronizar por 90 dias
};

// Para onde o banco aceita devolver o usuário depois da autorização.
// No Open Finance real, cada app registra esses endereços antes de
// poder pedir acesso. Sem a lista, alguém poderia criar um pedido que
// devolvesse o código de autorização para um site falso.
const REDIRECIONAMENTOS_PERMITIDOS = ['/contas'];

// Os crachás carregam o código interno do cliente (CLI-001), nunca o
// CPF: eles passam pelo navegador e ficam guardados no app.
// `extra` leva dados que precisam viajar junto, como o endereço de volta.
function emitir(tipo, clientId, extra = {}) {
  return jwt.sign({ ...extra, tipo, sub: clientId }, SEGREDO_BANCO, { expiresIn: PRAZO[tipo] });
}

// Monta o endereço de volta para o app, com os parâmetros na URL.
function enderecoDeVolta(consentimento, parametros) {
  const busca = new URLSearchParams({ ...parametros, state: consentimento.state });
  return `${consentimento.redirect_uri}?${busca}`;
}

// Confere a assinatura, o prazo E o tipo. Sem checar o tipo, alguém
// poderia usar o crachá de consentimento como se fosse o de acesso.
function conferir(token, tipoEsperado) {
  try {
    const conteudo = jwt.verify(String(token || ''), SEGREDO_BANCO);
    return conteudo.tipo === tipoEsperado ? conteudo : null;
  } catch {
    return null;
  }
}

function erro(res, status, titulo) {
  return res.status(status).json({ errors: [{ code: status, title: titulo }] });
}

const buscarClientePorId = (id) => dados.clientes.find((c) => c.clientId === id);

// ---- 1. CONSENTIMENTO ----

// POST /banco-simulado/consents
// corpo: { "cpf": "48291573646", "redirect_uri": "/contas", "state": "..." }
// O app informa de quem quer os dados e para onde o cliente deve voltar.
// Se o CPF não for cliente, é como tentar conectar um banco onde você
// não tem conta.
router.post('/consents', (req, res) => {
  const cpf = String(req.body?.cpf || '').replace(/\D/g, '');
  const redirectUri = req.body?.redirect_uri;
  const state = req.body?.state;

  if (!REDIRECIONAMENTOS_PERMITIDOS.includes(redirectUri)) {
    return erro(res, 400, 'Endereço de retorno não autorizado');
  }

  // O state é um valor do app que o banco só devolve, sem interpretar.
  if (typeof state !== 'string' || !state || state.length > 1000) {
    return erro(res, 400, 'state é obrigatório');
  }

  const cliente = dados.clientes.find((c) => c.cpf === cpf);

  if (!cliente) {
    return erro(res, 404, 'Cliente não encontrado neste banco');
  }

  res.status(201).json({
    data: {
      consentId: emitir('consentimento', cliente.clientId, { redirect_uri: redirectUri, state }),
      status: 'AGUARDANDO_AUTORIZACAO',
      permissions: ['ACCOUNTS_READ', 'ACCOUNTS_BALANCES_READ', 'ACCOUNTS_TRANSACTIONS_READ'],
    },
  });
});

// GET /banco-simulado/consents/:consentId
// Usado pela tela do banco para mostrar "Olá, Ana. O Verdanz quer...".
router.get('/consents/:consentId', (req, res) => {
  const consentimento = conferir(req.params.consentId, 'consentimento');
  const cliente = consentimento && buscarClientePorId(consentimento.sub);

  if (!cliente) {
    return erro(res, 400, 'Pedido de acesso inválido ou expirado');
  }

  res.json({ data: { status: 'AGUARDANDO_AUTORIZACAO', clientName: cliente.nome } });
});

// POST /banco-simulado/consents/authorize   corpo: { "consentId": "..." }
// Chamado quando o cliente clica em "Autorizar" na tela do banco.
// Gera um código de curta duração e devolve o endereço de volta para o
// app, já com o código e o state. O app troca esse código pelo acesso.
router.post('/consents/authorize', (req, res) => {
  const consentimento = conferir(req.body?.consentId, 'consentimento');

  if (!consentimento || !buscarClientePorId(consentimento.sub)) {
    return erro(res, 400, 'Pedido de acesso inválido ou expirado');
  }

  const code = emitir('codigo', consentimento.sub);
  res.json({ data: { code, redirectTo: enderecoDeVolta(consentimento, { code }) } });
});

// POST /banco-simulado/consents/reject   corpo: { "consentId": "..." }
// O cliente clicou em "Recusar": volta para o app sem código, avisando
// que o acesso foi negado. Nenhum dado é liberado.
router.post('/consents/reject', (req, res) => {
  const consentimento = conferir(req.body?.consentId, 'consentimento');

  if (!consentimento) {
    return erro(res, 400, 'Pedido de acesso inválido ou expirado');
  }

  res.json({ data: { redirectTo: enderecoDeVolta(consentimento, { error: 'access_denied' }) } });
});

// GET /banco-simulado/autorizar?consentId=...
// A tela do banco, onde o cliente decide se autoriza. Ela pertence ao
// banco, não ao Verdanz: por isso fica nesta pasta e tem visual próprio.
router.get('/autorizar', (req, res) => {
  res.sendFile(path.join(__dirname, 'autorizar.html'));
});

// ---- 2. TROCA DO CÓDIGO PELO ACESSO ----

// POST /banco-simulado/token   corpo: { "code": "..." }
// Por que não entregar o acesso direto na autorização? Porque o código
// passa pelo navegador (no endereço da página). O acesso de verdade só
// é entregue nesta troca, feita de servidor para servidor.
router.post('/token', (req, res) => {
  const codigo = conferir(req.body?.code, 'codigo');

  if (!codigo || !buscarClientePorId(codigo.sub)) {
    return erro(res, 400, 'Código inválido ou expirado');
  }

  res.json({
    access_token: emitir('acesso', codigo.sub),
    token_type: 'Bearer',
    expires_in: 90 * 24 * 60 * 60, // em segundos, como no padrão OAuth
  });
});

// ---- 3. DADOS (exigem o token de acesso) ----

// Porteiro das rotas de dados: só passa com o token de acesso válido.
function exigirAcesso(req, res, next) {
  const [esquema, token] = String(req.headers.authorization || '').split(' ');
  const acesso = esquema === 'Bearer' && conferir(token, 'acesso');
  const cliente = acesso && buscarClientePorId(acesso.sub);

  if (!cliente) {
    return erro(res, 401, 'Token de acesso inválido ou expirado');
  }

  req.cliente = cliente;
  next();
}

// Busca a conta só entre as do próprio cliente. Assim, um token da Ana
// nunca enxerga a conta do Bruno, mesmo que alguém troque o id na URL.
function buscarConta(req, res) {
  const conta = req.cliente.contas.find((c) => c.accountId === req.params.accountId);
  if (!conta) erro(res, 404, 'Conta não encontrada');
  return conta;
}

// GET /banco-simulado/accounts
router.get('/accounts', exigirAcesso, (req, res) => {
  res.json({
    data: req.cliente.contas.map((c) => ({
      accountId: c.accountId,
      brandName: dados.banco.nome,
      compeCode: dados.banco.codigo,
      type: c.type,
      branchCode: c.branchCode,
      number: c.number,
      checkDigit: c.checkDigit,
    })),
  });
});

// GET /banco-simulado/accounts/:accountId/balances
// O saldo não fica guardado no dados.json: é calculado na hora, somando
// as transações. Assim ele nunca discorda do extrato.
router.get('/accounts/:accountId/balances', exigirAcesso, (req, res) => {
  const conta = buscarConta(req, res);
  if (!conta) return;

  const centavos = conta.transacoes.reduce((soma, t) => {
    const valor = Math.round(Number(t.transactionAmount.amount) * 100);
    return t.creditDebitType === 'CREDITO' ? soma + valor : soma - valor;
  }, 0);

  res.json({
    data: { availableAmount: { amount: (centavos / 100).toFixed(2), currency: 'BRL' } },
  });
});

// GET /banco-simulado/accounts/:accountId/transactions?fromBookingDate=2026-08-01
// O filtro de data é opcional. Ele permite que o app peça só o que é
// novo desde a última sincronização, em vez do extrato inteiro.
router.get('/accounts/:accountId/transactions', exigirAcesso, (req, res) => {
  const conta = buscarConta(req, res);
  if (!conta) return;

  const desde = req.query.fromBookingDate;
  if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    return erro(res, 400, 'fromBookingDate deve estar no formato AAAA-MM-DD');
  }

  const transacoes = desde
    ? conta.transacoes.filter((t) => t.transactionDate >= desde)
    : conta.transacoes;

  res.json({ data: transacoes });
});

module.exports = router;
