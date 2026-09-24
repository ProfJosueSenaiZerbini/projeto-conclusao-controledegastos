const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../prisma');
const { enviarEmail } = require('../email');

// ---- ESQUECI A SENHA ----
//
// O fluxo tem duas etapas:
//   1. A pessoa informa o e-mail e recebe um link com um token.
//   2. Abrindo o link, ela escolhe a senha nova e o token é conferido.
//
// O token é um número aleatório enorme, guardado na tabela token_usuario.
// Guardar no banco (e não só dentro de um JWT) permite:
// - Uso único de verdade: depois de usado, o token é marcado e não serve mais.
// - Cancelar links antigos: pedir um link novo invalida os anteriores.
//
// O banco guarda só o HASH do token (SHA-256). O token de verdade existe
// apenas no link do e-mail. Se alguém copiar o banco, não consegue usar
// nenhum link — é a mesma ideia do hash da senha.

const TIPO = 'redefinir_senha';
const PRAZO_MINUTOS = 30;

const linkInvalido = { erro: 'Este link é inválido ou expirou. Peça um novo.' };

// 32 bytes aleatórios = 256 bits. Impossível de adivinhar por tentativa.
// crypto.randomBytes usa o gerador seguro do sistema operacional;
// Math.random() NÃO serve para isso, porque é previsível.
function gerarToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// Diferente da senha, aqui não precisa de bcrypt: o token já é aleatório
// e enorme, então um hash rápido (SHA-256) basta e permite buscar direto
// no banco pelo valor.
function hashDoToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// O endereço do site vem do .env, e não do cabeçalho Host da requisição.
// O Host é enviado pelo cliente: um atacante poderia pedir a redefinição
// da senha de outra pessoa com "Host: site-falso.com", e o link que chega
// no e-mail da vítima entregaria o token para o site dele.
function urlDoSite() {
  return process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
}

// Busca um token que ainda pode ser usado: do tipo certo, não usado e
// dentro do prazo. Devolve null em qualquer outro caso.
async function buscarTokenValido(cliente, token) {
  if (typeof token !== 'string' || token.length < 20) return null;

  const registro = await cliente.tokenUsuario.findUnique({
    where: { token_hash: hashDoToken(token) },
  });

  if (!registro) return null;
  if (registro.tipo !== TIPO) return null;
  if (registro.usado_em) return null;
  if (registro.expira_em < new Date()) return null;

  return registro;
}

// Parte "lenta" do pedido: gerar o token, gravar e mandar o e-mail.
async function processarPedido(email) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) return;

  const token = gerarToken();

  await prisma.$transaction([
    // Pediu um link novo? Os anteriores deixam de valer. Assim só o
    // e-mail mais recente funciona, e links esquecidos na caixa de
    // entrada não ficam abertos por aí.
    prisma.tokenUsuario.updateMany({
      where: { id_usuario: usuario.id_usuario, tipo: TIPO, usado_em: null },
      data: { usado_em: new Date() },
    }),
    prisma.tokenUsuario.create({
      data: {
        token_hash: hashDoToken(token),
        tipo: TIPO,
        expira_em: new Date(Date.now() + PRAZO_MINUTOS * 60 * 1000),
        id_usuario: usuario.id_usuario,
      },
    }),
  ]);

  const link = `${urlDoSite()}/redefinir-senha?token=${token}`;

  await enviarEmail({
    para: usuario.email,
    assunto: 'Verdanz — redefinir sua senha',
    texto:
      `Olá, ${usuario.nome_usuario}!\n\n` +
      `Recebemos um pedido para criar uma senha nova na sua conta do Verdanz.\n` +
      `Clique no link abaixo. Ele vale por ${PRAZO_MINUTOS} minutos:\n\n` +
      `${link}\n\n` +
      `Se não foi você, é só ignorar: sua senha continua a mesma.`,
  });
}

// POST /api/usuario/esqueci-senha
async function esqueciSenha(req, res) {
  const email = String(req.body?.email || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  }

  // Sem `await` de propósito: a resposta sai na hora, exista o e-mail
  // ou não. Se esperássemos o banco e o envio, a resposta demoraria mais
  // só quando o e-mail existe — e o tempo entregaria essa informação.
  processarPedido(email).catch((erro) => {
    console.error('Falha ao processar pedido de redefinição de senha:', erro);
  });

  // Mesma resposta para e-mail cadastrado ou não, pelo mesmo motivo do
  // login: não revelar quais e-mails existem no sistema.
  res.json({
    mensagem: 'Se esse e-mail estiver cadastrado, você vai receber um link para criar uma senha nova.',
  });
}

// POST /api/usuario/redefinir-senha/verificar
// Chamado assim que a tela do link abre. Se o link já não vale, a tela
// nem mostra os campos: não adianta digitar uma senha que vai ser recusada.
async function verificarToken(req, res) {
  try {
    const registro = await buscarTokenValido(prisma, req.body?.token);

    if (!registro) {
      return res.status(400).json(linkInvalido);
    }

    res.json({ valido: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao verificar o link' });
  }
}

// POST /api/usuario/redefinir-senha
async function redefinirSenha(req, res) {
  try {
    const { token, senha } = req.body || {};

    if (!token || !senha) {
      return res.status(400).json({ erro: 'Token e nova senha são obrigatórios' });
    }

    if (typeof senha !== 'string' || senha.length < 6) {
      return res.status(400).json({ erro: 'A senha deve ter no mínimo 6 caracteres' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    // Tudo numa operação só: marcar o token como usado e trocar a senha.
    // Se uma parte falhar, nada é gravado.
    const trocou = await prisma.$transaction(async (tx) => {
      const registro = await buscarTokenValido(tx, token);
      if (!registro) return false;

      // O `usado_em: null` no filtro é a trava contra dois cliques ao
      // mesmo tempo: só UMA das requisições consegue marcar o token.
      // A outra recebe count 0 e é recusada.
      const marcado = await tx.tokenUsuario.updateMany({
        where: { id_token: registro.id_token, usado_em: null },
        data: { usado_em: new Date() },
      });
      if (marcado.count !== 1) return false;

      await tx.usuario.update({
        where: { id_usuario: registro.id_usuario },
        data: { senha: senhaHash },
      });

      return true;
    });

    if (!trocou) {
      return res.status(400).json(linkInvalido);
    }

    res.json({ mensagem: 'Senha alterada com sucesso' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao redefinir a senha' });
  }
}

module.exports = {
  esqueciSenha,
  verificarToken,
  redefinirSenha,
};
