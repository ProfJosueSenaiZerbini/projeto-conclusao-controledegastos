const crypto = require('crypto');

// Ferramentas compartilhadas pelos fluxos que mandam link por e-mail:
// redefinir senha e trocar e-mail. Antes viviam dentro do senhaController;
// saíram de lá quando um segundo fluxo passou a precisar das mesmas regras.
//
// Duplicar código de segurança é pior que duplicar código comum: se um dia
// o prazo ou o algoritmo mudar e só uma cópia for corrigida, a outra vira
// uma brecha silenciosa.

// 32 bytes aleatórios = 256 bits. Impossível de adivinhar por tentativa.
// crypto.randomBytes usa o gerador seguro do sistema operacional;
// Math.random() NÃO serve para isso, porque é previsível.
function gerarToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// Diferente da senha, aqui não precisa de bcrypt: o token já é aleatório
// e enorme, então um hash rápido (SHA-256) basta e permite buscar direto
// no banco pelo valor.
//
// O banco guarda só o HASH. O token de verdade existe apenas no link do
// e-mail. Se alguém copiar o banco, não consegue usar nenhum link.
function hashDoToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// O endereço do site vem do .env, e não do cabeçalho Host da requisição.
// O Host é enviado pelo cliente: um atacante poderia pedir um link em nome
// de outra pessoa com "Host: site-falso.com", e o link que chega no e-mail
// da vítima entregaria o token para o site dele.
function urlDoSite() {
  return process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
}

// Busca um token que ainda pode ser usado: do tipo certo, não usado e
// dentro do prazo. Devolve null em qualquer outro caso.
//
// Recebe o `cliente` (prisma ou o `tx` de dentro de uma transação) para
// servir aos dois casos sem duplicação.
async function buscarTokenValido(cliente, token, tipo) {
  if (typeof token !== 'string' || token.length < 20) return null;

  const registro = await cliente.tokenUsuario.findUnique({
    where: { token_hash: hashDoToken(token) },
  });

  if (!registro) return null;
  if (registro.tipo !== tipo) return null;
  if (registro.usado_em) return null;
  if (registro.expira_em < new Date()) return null;

  return registro;
}

module.exports = { gerarToken, hashDoToken, urlDoSite, buscarTokenValido };
