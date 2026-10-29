const bcrypt = require('bcrypt');
const prisma = require('../prisma');
const { enviarEmail } = require('../email');
const { gerarToken, hashDoToken, urlDoSite, buscarTokenValido } = require('../tokens');

// ---- TROCAR O E-MAIL ----
//
// Por que isto não é um simples PUT:
//
// O e-mail é a chave que destranca a conta. Quem troca o e-mail pode em
// seguida pedir "esqueci a senha", receber o link na própria caixa e
// assumir a conta. Logo, trocar o e-mail é tão perigoso quanto trocar a
// senha — e precisa da mesma proteção.
//
// Quatro camadas, cada uma cobrindo uma falha diferente:
//
//   1. Pede a SENHA ATUAL. Um token roubado deixa de bastar, porque a
//      senha não está no token nem guardada no navegador.
//   2. Manda um link para o ENDEREÇO NOVO. A troca só vale depois do
//      clique, então quem digitou errado não perde a conta, e quem não
//      tem acesso àquela caixa não consegue concluir.
//   3. Avisa o ENDEREÇO ANTIGO. Transforma um sequestro silencioso em
//      algo que o dono percebe enquanto ainda dá para reagir.
//   4. Ao concluir, INVALIDA os links de redefinir senha que estiverem
//      abertos. Um link pedido antes da troca não serve para a conta nova.

const TIPO = 'trocar_email';
const PRAZO_MINUTOS = 30;

const linkInvalido = { erro: 'Este link é inválido ou expirou. Peça a troca de novo.' };

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/usuario/:id/email
// Protegida por autenticar + verificarDono: só o dono da conta pede.
async function solicitarTrocaEmail(req, res) {
  try {
    const id_usuario = req.usuario.id_usuario;
    const senhaAtual = req.body?.senha_atual;
    const emailNovo = String(req.body?.email_novo || '').trim().toLowerCase();

    if (!senhaAtual || !emailNovo) {
      return res.status(400).json({ erro: 'Informe o e-mail novo e sua senha atual.' });
    }

    if (!emailValido(emailNovo)) {
      return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id_usuario } });
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    // ---- CAMADA 1: a senha atual ----
    const senhaConfere = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaConfere) {
      return res.status(401).json({ erro: 'Senha incorreta.' });
    }

    if (emailNovo === usuario.email.toLowerCase()) {
      return res.status(400).json({ erro: 'Este já é o seu e-mail atual.' });
    }

    // O e-mail é @unique no banco. Conferir aqui dá uma mensagem clara
    // agora, em vez de um erro só na hora de confirmar o link — quando a
    // pessoa já teria perdido tempo.
    const jaUsado = await prisma.usuario.findUnique({ where: { email: emailNovo } });
    if (jaUsado) {
      return res.status(409).json({ erro: 'Esse e-mail já está cadastrado em outra conta.' });
    }

    const token = gerarToken();

    await prisma.$transaction([
      // Pediu de novo? O pedido anterior deixa de valer. Impede que dois
      // endereços diferentes fiquem com links abertos ao mesmo tempo.
      prisma.tokenUsuario.updateMany({
        where: { id_usuario, tipo: TIPO, usado_em: null },
        data: { usado_em: new Date() },
      }),
      prisma.tokenUsuario.create({
        data: {
          token_hash: hashDoToken(token),
          tipo: TIPO,
          email_novo: emailNovo,
          expira_em: new Date(Date.now() + PRAZO_MINUTOS * 60 * 1000),
          id_usuario,
        },
      }),
    ]);

    const link = `${urlDoSite()}/confirmar-email?token=${token}`;

    // Os dois e-mails saem SEM await, igual ao "esqueci a senha".
    //
    // Esperar o envio fazia a resposta demorar 23 segundos — o servidor
    // de e-mail leva vários segundos para aceitar a mensagem, e o usuário
    // ficava olhando um botão travado sem saber se funcionou.
    //
    // O token já está gravado neste ponto, então a troca está registrada
    // mesmo que o envio falhe. Uma falha aparece no terminal do servidor,
    // e a pessoa pode simplesmente pedir de novo.

    // ---- CAMADA 2: o link vai para o endereço NOVO ----
    enviarEmail({
      para: emailNovo,
      assunto: 'Verdanz — confirme seu novo e-mail',
      texto:
        `Olá, ${usuario.nome_usuario}!\n\n` +
        `Você pediu para usar este endereço na sua conta do Verdanz.\n` +
        `Clique no link abaixo para confirmar. Ele vale por ${PRAZO_MINUTOS} minutos:\n\n` +
        `${link}\n\n` +
        `Enquanto você não clicar, sua conta continua com o e-mail antigo.\n` +
        `Se não foi você, ignore esta mensagem.`,
    }).catch((erro) => {
      console.error('Falha ao enviar o link de confirmação de e-mail:', erro);
    });

    // ---- CAMADA 3: aviso no endereço ANTIGO ----
    enviarEmail({
      para: usuario.email,
      assunto: 'Verdanz — pediram para trocar o e-mail da sua conta',
      texto:
        `Olá, ${usuario.nome_usuario}!\n\n` +
        `Recebemos um pedido para trocar o e-mail da sua conta do Verdanz ` +
        `para ${emailNovo}.\n\n` +
        `Se foi você, não precisa fazer nada: basta confirmar pelo link que ` +
        `enviamos ao endereço novo.\n\n` +
        `SE NÃO FOI VOCÊ, sua conta pode estar comprometida. Troque sua senha ` +
        `agora mesmo em ${urlDoSite()}/esqueci-senha — isso cancela o pedido.`,
    }).catch((erro) => {
      console.error('Falha ao avisar o e-mail antigo sobre a troca:', erro);
    });

    res.json({
      mensagem: `Enviamos um link de confirmação para ${emailNovo}. Seu e-mail só muda depois que você clicar nele.`,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao solicitar a troca de e-mail' });
  }
}

// POST /api/usuario/confirmar-email/verificar
// Chamado quando a tela do link abre, para não mostrar o botão de um
// link que já não vale.
async function verificarTokenEmail(req, res) {
  try {
    const registro = await buscarTokenValido(prisma, req.body?.token, TIPO);

    if (!registro) {
      return res.status(400).json(linkInvalido);
    }

    res.json({ valido: true, email_novo: registro.email_novo });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao verificar o link' });
  }
}

// POST /api/usuario/confirmar-email
//
// Rota pública de propósito: quem confirma pode estar em outro aparelho,
// sem sessão aberta. A segurança vem do token do e-mail, não do login —
// mesma lógica do "esqueci a senha".
async function confirmarTrocaEmail(req, res) {
  try {
    const token = req.body?.token;

    if (!token) {
      return res.status(400).json({ erro: 'Token é obrigatório' });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const registro = await buscarTokenValido(tx, token, TIPO);
      if (!registro) return { ok: false };

      // O `usado_em: null` no filtro é a trava contra dois cliques ao
      // mesmo tempo: só UMA das requisições consegue marcar o token.
      const marcado = await tx.tokenUsuario.updateMany({
        where: { id_token: registro.id_token, usado_em: null },
        data: { usado_em: new Date() },
      });
      if (marcado.count !== 1) return { ok: false };

      // Entre o pedido e o clique alguém pode ter cadastrado esse e-mail.
      // Sem esta conferência, o update falharia com erro de campo único.
      const jaUsado = await tx.usuario.findUnique({ where: { email: registro.email_novo } });
      if (jaUsado) return { ok: false, conflito: true };

      const antes = await tx.usuario.update({
        where: { id_usuario: registro.id_usuario },
        data: { email: registro.email_novo },
        select: { nome_usuario: true },
      });

      // ---- CAMADA 4: links de senha abertos deixam de valer ----
      //
      // Um link de "esqueci a senha" pedido ANTES da troca foi enviado ao
      // endereço antigo. Se continuasse válido, quem tivesse aquele link
      // poderia trocar a senha da conta que agora tem outro dono.
      await tx.tokenUsuario.updateMany({
        where: { id_usuario: registro.id_usuario, tipo: 'redefinir_senha', usado_em: null },
        data: { usado_em: new Date() },
      });

      return { ok: true, nome: antes.nome_usuario, email: registro.email_novo };
    });

    if (resultado.conflito) {
      return res.status(409).json({
        erro: 'Esse e-mail foi cadastrado em outra conta enquanto você confirmava. Peça a troca de novo.',
      });
    }

    if (!resultado.ok) {
      return res.status(400).json(linkInvalido);
    }

    res.json({
      mensagem: 'E-mail alterado com sucesso',
      email: resultado.email,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao confirmar a troca de e-mail' });
  }
}

module.exports = { solicitarTrocaEmail, verificarTokenEmail, confirmarTrocaEmail };
