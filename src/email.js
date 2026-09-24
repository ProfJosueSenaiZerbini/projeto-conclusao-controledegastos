const nodemailer = require('nodemailer');

// Envio de e-mails do sistema (confirmação de cadastro e redefinição de senha).
//
// Um site não entrega e-mail sozinho: ele entrega a mensagem para um
// servidor SMTP (o "correio"), e é esse servidor que leva até a caixa de
// entrada da pessoa. Os dados desse servidor ficam no .env, nunca no
// código: SMTP_PASS é uma senha, e o código vai para o GitHub.
//
// Sem SMTP configurado, o e-mail NÃO é enviado — o conteúdo aparece no
// terminal do servidor. Isso ajuda a testar sem conta de e-mail, mas foi
// exatamente o que fez a versão antiga "funcionar" sem nada chegar. Por
// isso agora o servidor avisa em voz alta, ao iniciar, que está nesse modo.

const smtpConfigurado = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

const porta = Number(process.env.SMTP_PORT) || 587;

const transporte = smtpConfigurado
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: porta,
      // Porta 465 usa conexão criptografada desde o início; a 587 começa
      // aberta e é criptografada em seguida (STARTTLS). Ambas são seguras.
      secure: porta === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

// Chamada uma vez, quando o servidor sobe. Com SMTP configurado, faz um
// teste de conexão e login no servidor de e-mail: se a senha estiver
// errada, o problema aparece agora, e não quando um usuário pedir ajuda.
async function conferirEmail() {
  if (!transporte) {
    console.warn(
      '\n[AVISO] E-mail NÃO configurado (faltam SMTP_HOST, SMTP_USER ou SMTP_PASS no .env).\n' +
        '        Nenhum e-mail será enviado: o conteúdo aparece só neste terminal.\n'
    );
    return;
  }

  try {
    await transporte.verify();
    console.log(`E-mail pronto: enviando por ${process.env.SMTP_HOST} como ${process.env.SMTP_USER}`);
  } catch (erro) {
    console.error(
      '\n[ERRO] Não foi possível conectar ao servidor de e-mail. Confira os campos SMTP_* do .env.\n' +
        '       No Gmail, SMTP_PASS precisa ser uma "senha de app", não a senha normal da conta.\n' +
        `       Detalhe: ${erro.message}\n`
    );
  }
}

async function enviarEmail({ para, assunto, texto }) {
  if (!transporte) {
    console.log('\n---- E-MAIL (SMTP não configurado, não foi enviado) ----');
    console.log(`Para: ${para}`);
    console.log(`Assunto: ${assunto}`);
    console.log(texto);
    console.log('--------------------------------------------------------\n');
    return;
  }

  await transporte.sendMail({
    from: process.env.EMAIL_REMETENTE || process.env.SMTP_USER,
    to: para,
    subject: assunto,
    text: texto,
  });
}

module.exports = { enviarEmail, conferirEmail };
