const jwt = require('jsonwebtoken');

// Middleware = função que roda ENTRE a chegada da requisição e o controller.
// Ela recebe (req, res, next) e decide: ou chama next() para deixar passar,
// ou responde com erro e barra ali mesmo. É um porteiro.

function autenticar(req, res, next) {
  // O padrão do header é: Authorization: Bearer <token>
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não enviado' });
  }

  const token = header.split(' ')[1];

  try {
    // jwt.verify confere a assinatura usando a JWT_SECRET.
    // Token adulterado ou expirado lança erro e cai no catch.
    const dados = jwt.verify(token, process.env.JWT_SECRET);

    // A partir daqui, qualquer controller sabe quem fez a requisição
    // através de req.usuario — sem precisar confiar no que veio na URL.
    req.usuario = { id_usuario: dados.id_usuario };

    next();
  } catch (erro) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

// Confere se o :id da URL é o mesmo do dono do token.
//
// Por que isso é necessário: o :id vem do cliente e pode ser mentira.
// Sem essa checagem, um usuário logado trocaria o número na URL
// (/api/usuario/1 -> /api/usuario/2) e leria os dados de outra pessoa.
// 401 = "não sei quem você é"; 403 = "sei quem você é, mas isso não é seu".
function verificarDono(req, res, next) {
  const idDaUrl = Number(req.params.id);

  if (!Number.isInteger(idDaUrl)) {
    return res.status(400).json({ erro: 'ID inválido' });
  }

  if (idDaUrl !== req.usuario.id_usuario) {
    return res.status(403).json({ erro: 'Acesso negado a dados de outro usuário' });
  }

  next();
}

module.exports = { autenticar, verificarDono };
