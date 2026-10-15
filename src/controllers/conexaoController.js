const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const banco = require('../clienteBanco');
const { sincronizar } = require('../importacao');

const { ErroBanco, NOME_BANCO } = banco;

// ---- CONEXÃO COM O BANCO ----
//
// O fluxo completo, do ponto de vista do Verdanz:
//   1. POST /api/conexao-bancaria
//      O Verdanz pede o consentimento ao banco e devolve à tela o
//      endereço da tela do banco.
//   2. A pessoa autoriza no site do banco e volta para /contas com um
//      código e o `state` na URL.
//   3. POST /api/conexao-bancaria/finalizar
//      O Verdanz confere o state, troca o código pelo token de acesso,
//      guarda a conexão e faz a primeira importação.

// ---- O STATE ----
//
// O state é um carimbo que o Verdanz cria no passo 1 e confere no
// passo 3. Ele garante que quem está finalizando a conexão é a mesma
// pessoa que começou. Sem ele, alguém poderia autorizar a PRÓPRIA conta
// bancária e mandar o link de volta para a vítima: ao abrir, o Verdanz
// da vítima importaria as contas do atacante.
//
// O segredo é derivado do JWT_SECRET, mas diferente dele. Se fosse o
// mesmo, este carimbo (que passa pela URL) serviria como token de login.
function segredoDoState() {
  return process.env.JWT_SECRET + ':estado-conexao';
}

// Campos da conexão que podem ir para a tela. O token_acesso fica de
// fora: é a chave de acesso ao banco e nunca sai do servidor.
const camposPublicos = {
  id_conexao: true,
  banco: true,
  data_conexao: true,
  ultima_sincronizacao: true,
  acesso_expira_em: true,
};

function comSituacao(conexao) {
  return { ...conexao, expirada: conexao.acesso_expira_em < new Date() };
}

// Erros do banco já trazem mensagem e status prontos para a tela.
function responderErro(res, erro, mensagemPadrao) {
  if (erro instanceof ErroBanco) {
    return res.status(erro.status).json({ erro: erro.message, codigo: erro.codigo });
  }

  console.error(erro);
  res.status(500).json({ erro: mensagemPadrao });
}

async function buscarConexaoDoUsuario(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ erro: 'ID inválido' });
    return null;
  }

  const conexao = await prisma.conexaoBancaria.findUnique({ where: { id_conexao: id } });

  if (!conexao) {
    res.status(404).json({ erro: 'Conexão não encontrada' });
    return null;
  }

  // Mesmo cuidado das contas: o id da URL pode ser de outra pessoa.
  if (conexao.id_usuario !== req.usuario.id_usuario) {
    res.status(403).json({ erro: 'Acesso negado a conexão de outro usuário' });
    return null;
  }

  return conexao;
}

// POST /api/conexao-bancaria
async function iniciarConexao(req, res) {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: req.usuario.id_usuario },
      select: { id_usuario: true, cpf_cnpj: true },
    });

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    const state = jwt.sign(
      { tipo: 'estado_conexao', sub: usuario.id_usuario },
      segredoDoState(),
      { expiresIn: '10m' }
    );

    // O CPF vai do servidor do Verdanz para o banco, nunca pela URL.
    const url = await banco.pedirConsentimento(usuario.cpf_cnpj, state);

    res.json({ url });
  } catch (erro) {
    responderErro(res, erro, 'Erro ao iniciar a conexão com o banco');
  }
}

// POST /api/conexao-bancaria/finalizar   corpo: { code, state }
async function finalizarConexao(req, res) {
  try {
    const { code, state } = req.body || {};

    if (!code || !state) {
      return res.status(400).json({ erro: 'Código e state são obrigatórios' });
    }

    let carimbo;
    try {
      carimbo = jwt.verify(String(state), segredoDoState());
    } catch {
      carimbo = null;
    }

    if (!carimbo || carimbo.tipo !== 'estado_conexao' || carimbo.sub !== req.usuario.id_usuario) {
      return res.status(400).json({ erro: 'Pedido de conexão inválido ou expirado. Tente conectar de novo.' });
    }

    const acesso = await banco.trocarCodigo(String(code));

    // upsert: se o banco já estava conectado (por exemplo, com a
    // autorização vencida), só renova o token. As contas importadas
    // continuam as mesmas, porque o id_externo delas não muda.
    const conexao = await prisma.conexaoBancaria.upsert({
      where: { id_usuario_banco: { id_usuario: req.usuario.id_usuario, banco: NOME_BANCO } },
      create: {
        banco: NOME_BANCO,
        token_acesso: acesso.token,
        acesso_expira_em: acesso.expiraEm,
        id_usuario: req.usuario.id_usuario,
      },
      update: {
        token_acesso: acesso.token,
        acesso_expira_em: acesso.expiraEm,
      },
    });

    const resumo = await sincronizar(conexao);

    res.status(201).json({ id_conexao: conexao.id_conexao, resumo });
  } catch (erro) {
    responderErro(res, erro, 'Erro ao concluir a conexão com o banco');
  }
}

// GET /api/conexao-bancaria
async function listarConexoes(req, res) {
  try {
    const conexoes = await prisma.conexaoBancaria.findMany({
      where: { id_usuario: req.usuario.id_usuario },
      select: { ...camposPublicos, _count: { select: { contas: true } } },
      orderBy: { data_conexao: 'asc' },
    });

    res.json(conexoes.map(comSituacao));
  } catch (erro) {
    responderErro(res, erro, 'Erro ao listar conexões');
  }
}

// POST /api/conexao-bancaria/:id/sincronizar
async function sincronizarConexao(req, res) {
  try {
    const conexao = await buscarConexaoDoUsuario(req, res);
    if (!conexao) return;

    res.json(await sincronizar(conexao));
  } catch (erro) {
    responderErro(res, erro, 'Erro ao sincronizar com o banco');
  }
}

// DELETE /api/conexao-bancaria/:id
async function desconectar(req, res) {
  try {
    const conexao = await buscarConexaoDoUsuario(req, res);
    if (!conexao) return;

    // Cascade no schema: apagar a conexão apaga as contas importadas por
    // ela, e com elas as transações. A tela avisa antes de confirmar.
    // No banco nada muda: ele só deixa de ser consultado.
    await prisma.conexaoBancaria.delete({ where: { id_conexao: conexao.id_conexao } });

    res.json({ mensagem: 'Banco desconectado' });
  } catch (erro) {
    responderErro(res, erro, 'Erro ao desconectar o banco');
  }
}

module.exports = {
  iniciarConexao,
  finalizarConexao,
  listarConexoes,
  sincronizarConexao,
  desconectar,
};
