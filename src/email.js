const nodemailer = require('nodemailer');

// Envio de e-mails do sistema (hoje, só o de redefinir senha).
//
// Os dados do servidor de e-mail (SMTP) ficam no .env, nunca no código:
// é uma senha, e o código vai para o GitHub.
//
// Sem SMTP configurado, o e-mail NÃO é enviado — o conteúdo aparece no
// terminal do servidor. Assim dá para desenvolver e testar o fluxo inteiro
// sem ter uma conta de e-mail configurada.

const smtpConfigurado = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

const transporte = smtpConfigurado
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      // Porta 465 usa conexão criptografada desde o início; a 587 começa
      // aberta e é criptografada em seguida (STARTTLS). Ambas são seguras.
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

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

module.exports = { enviarEmail };
