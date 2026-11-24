const bcrypt = require('bcrypt');
const prisma = require('../prisma');
const { enviarEmail } = require('../email');
const { gerarToken, hashDoToken, urlDoSite, buscarTokenValido } = require('../tokens');

// ---- APAGAR DADOS: RESETAR E EXCLUIR A CONTA ----
//
// Duas ações da "Zona de perigo" de Configurações:
//
//   RESETAR  -> apaga os dados financeiros e mantém o login. A pessoa
//               recomeça do zero, com uma Carteira nova e zerada.
//   EXCLUIR  -> apaga a pessoa do Verdanz. Só acontece depois de um clique
//               num link enviado ao e-mail dela.
//
// As duas pedem a SENHA antes de qualquer coisa: uma sessão esquecida
// aberta num computador emprestado não pode bastar para apagar tudo.

const TIPO_EXCLUSAO = 'excluir_conta';
const PRAZO_MINUTOS = 30;

const linkInvalido = { erro: 'Este link é inválido ou expirou. Peça a exclusão de novo em Configurações.' };

// Erro com status HTTP, para ser lançado de dentro do $transaction.
class ErroExclusao extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// Confere a senha de quem está logado. Lança ErroExclusao se não conferir.
async function conferirSenha(id_usuario, senha) {
  if (!senha) {
    throw new ErroExclusao(400, 'Digite a sua senha para confirmar.');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id_usuario } });
  if (!usuario) {
    throw new ErroExclusao(404, 'Usuário não encontrado');
  }

  if (!(await bcrypt.compare(senha, usuario.senha))) {
    throw new ErroExclusao(401, 'Senha incorreta.');
  }

  return usuario;
}

// Apaga TODOS os dados financeiros de um usuário. Sempre roda dentro de um
// $transaction (recebe o `tx`): ou tudo some, ou nada some.
//
// A ORDEM importa:
//   1. contas (levam junto as transações, pelo Cascade). Vêm primeiro
//      porque uma categoria personalizada não pode sair enquanto tiver
//      transação, e o MySQL não garante em que ordem as cascatas
//      acontecem;
//   2. bancos conectados (as contas importadas já saíram no passo 1);
//   3. limites (inclusive os das categorias do sistema);
//   4. categorias personalizadas (já sem transações);
//   5. metas.
async function apagarDadosFinanceiros(tx, id_usuario) {
  await tx.conta.deleteMany({ where: { id_usuario } });
  await tx.conexaoBancaria.deleteMany({ where: { id_usuario } });
  await tx.limiteCategoria.deleteMany({ where: { id_usuario } });
  await tx.categoria.deleteMany({ where: { id_usuario } });
  await tx.meta.deleteMany({ where: { id_usuario } });
}

function responderErro(res, erro, mensagemPadrao) {
  if (erro instanceof ErroExclusao) {
    return res.status(erro.status).json({ erro: erro.message });
  }
  console.error(erro);
  res.status(500).json({ erro: mensagemPadrao });
}

// ---- RESETAR ----

// POST /api/usuario/:id/resetar   corpo: { senha }
//
// Fica: nome, e-mail, senha e CPF (o login). Some: contas, transações,
// metas, limites, categorias criadas e bancos conectados. No fim nasce uma
// Carteira zerada, como no cadastro: pela regra do projeto, ninguém fica
// sem conta onde registrar.
async function resetarDados(req, res) {
  try {
    const id_usuario = req.usuario.id_usuario;
    await conferirSenha(id_usuario, req.body?.senha);

    await prisma.$transaction(async (tx) => {
      await apagarDadosFinanceiros(tx, id_usuario);
      await tx.conta.create({ data: { nome: 'Carteira', saldo: 0, id_usuario } });
    });

    res.json({ mensagem: 'Pronto! Seus dados foram apagados e você começa do zero, com uma Carteira nova.' });
  } catch (erro) {
    responderErro(res, erro, 'Erro ao resetar os dados');
  }
}

// ---- EXCLUIR A CONTA ----
//
// Três passos, como na troca de e-mail:
//   1. solicitar: confere a senha e manda o link para o e-mail da conta;
//   2. verificar: a página do link mostra o que vai ser apagado;
//   3. confirmar: a pessoa concorda e a conta é apagada.
//
// Por que o e-mail? Excluir não tem volta. O link prova que quem pede tem
// acesso à caixa de entrada do dono, além da senha, e dá um tempo para a
// pessoa pensar antes do último clique.

// POST /api/usuario/:id/excluir-conta   corpo: { senha }
async function solicitarExclusao(req, res) {
  try {
    const id_usuario = req.usuario.id_usuario;
    const usuario = await conferirSenha(id_usuario, req.body?.senha);

    const token = gerarToken();

    await prisma.$transaction([
      // Pediu de novo? Só o link mais novo vale.
      prisma.tokenUsuario.updateMany({
        where: { id_usuario, tipo: TIPO_EXCLUSAO, usado_em: null },
        data: { usado_em: new Date() },
      }),
      prisma.tokenUsuario.create({
        data: {
          token_hash: hashDoToken(token),
          tipo: TIPO_EXCLUSAO,
          expira_em: new Date(Date.now() + PRAZO_MINUTOS * 60 * 1000),
          id_usuario,
        },
      }),
    ]);

    const link = `${urlDoSite()}/excluir-conta?token=${token}`;

    // Sem await, como nos outros e-mails: o envio demora vários segundos e o
    // token já está gravado. Uma falha aparece no terminal do servidor.
    enviarEmail({
      para: usuario.email,
      assunto: 'Verdanz — confirme a exclusão da sua conta',
      texto:
        `Olá, ${usuario.nome_usuario}!\n\n` +
        `Recebemos um pedido para EXCLUIR a sua conta do Verdanz.\n` +
        `Para ver o que será apagado e confirmar, abra o link abaixo. Ele vale por ${PRAZO_MINUTOS} minutos:\n\n` +
        `${link}\n\n` +
        `Nada é apagado enquanto você não confirmar na página do link.\n` +
        `Se não foi você, ignore esta mensagem e troque a sua senha: alguém pode saber qual é.`,
    }).catch((erro) => {
      console.error('Falha ao enviar o link de exclusão da conta:', erro);
    });

    res.json({
      mensagem: `Enviamos um link para ${usuario.email}. A conta só é excluída depois que você abrir o link e confirmar.`,
    });
  } catch (erro) {
    responderErro(res, erro, 'Erro ao pedir a exclusão da conta');
  }
}

// POST /api/usuario/excluir-conta/verificar   corpo: { token }
//
// Pública: quem abre o link pode estar em outro aparelho, sem sessão. A
// segurança vem do token. Devolve o resumo do que será apagado, para a
// pessoa decidir sabendo exatamente o que perde.
async function verificarExclusao(req, res) {
  try {
    const registro = await buscarTokenValido(prisma, req.body?.token, TIPO_EXCLUSAO);
    if (!registro) {
      return res.status(400).json(linkInvalido);
    }

    const id_usuario = registro.id_usuario;
    const [usuario, contas, transacoes, metas, categorias, limites, bancos] = await Promise.all([
      prisma.usuario.findUnique({ where: { id_usuario }, select: { nome_usuario: true, email: true } }),
      prisma.conta.count({ where: { id_usuario } }),
      prisma.transacao.count({ where: { conta: { id_usuario } } }),
      prisma.meta.count({ where: { id_usuario } }),
      prisma.categoria.count({ where: { id_usuario } }),
      prisma.limiteCategoria.count({ where: { id_usuario } }),
      prisma.conexaoBancaria.count({ where: { id_usuario } }),
    ]);

    res.json({
      valido: true,
      id_usuario,
      nome: usuario.nome_usuario,
      email: usuario.email,
      resumo: { contas, transacoes, metas, categorias, limites, bancos },
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao verificar o link' });
  }
}

// POST /api/usuario/excluir-conta   corpo: { token }
async function confirmarExclusao(req, res) {
  try {
    const usuario = await prisma.$transaction(async (tx) => {
      const registro = await buscarTokenValido(tx, req.body?.token, TIPO_EXCLUSAO);
      if (!registro) throw new ErroExclusao(400, linkInvalido.erro);

      // O `usado_em: null` no filtro é a trava contra dois cliques ao mesmo
      // tempo: só UMA requisição consegue marcar o token e seguir.
      const marcado = await tx.tokenUsuario.updateMany({
        where: { id_token: registro.id_token, usado_em: null },
        data: { usado_em: new Date() },
      });
      if (marcado.count !== 1) throw new ErroExclusao(400, linkInvalido.erro);

      const dono = await tx.usuario.findUnique({
        where: { id_usuario: registro.id_usuario },
        select: { nome_usuario: true, email: true },
      });

      // Os dados primeiro, na ordem certa; o usuário por último (o Cascade
      // leva os tokens junto).
      await apagarDadosFinanceiros(tx, registro.id_usuario);
      await tx.usuario.delete({ where: { id_usuario: registro.id_usuario } });

      return dono;
    });

    // Confirmação por escrito de que a conta saiu.
    enviarEmail({
      para: usuario.email,
      assunto: 'Verdanz — sua conta foi excluída',
      texto:
        `Olá, ${usuario.nome_usuario}!\n\n` +
        `Sua conta do Verdanz e todos os seus dados foram excluídos, como você pediu.\n` +
        `Se um dia quiser voltar, é só criar uma conta nova em ${urlDoSite()}/criar-conta.\n\n` +
        `Obrigado por ter usado o Verdanz. Volte sempre!`,
    }).catch((erro) => {
      console.error('Falha ao enviar o aviso de conta excluída:', erro);
    });

    res.json({ mensagem: 'Conta excluída com sucesso', nome: usuario.nome_usuario });
  } catch (erro) {
    responderErro(res, erro, 'Erro ao excluir a conta');
  }
}

module.exports = { resetarDados, solicitarExclusao, verificarExclusao, confirmarExclusao, apagarDadosFinanceiros };
