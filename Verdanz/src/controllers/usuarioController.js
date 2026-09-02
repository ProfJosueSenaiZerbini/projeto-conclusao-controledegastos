const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

// Campos que PODEM sair na resposta. Repare que `senha` não está aqui:
// mesmo com hash, o hash nunca deve trafegar para fora do servidor.
// Usar `select` é mais seguro do que apagar o campo depois — se um dia
// alguém adicionar uma coluna sensível no schema, ela não vaza por acidente.
// Remove tudo que não é dígito: "123.456.789-00" vira "12345678900".
// O banco guarda apenas números; pontos e traços são enfeite de tela.
function limparDocumento(valor) {
  return String(valor).replace(/\D/g, '');
}

// CPF tem 11 dígitos, CNPJ tem 14. Não existe meio-termo.
function documentoTemTamanhoValido(documento) {
  return documento.length === 11 || documento.length === 14;
}

const camposPublicos = {
  id_usuario: true,
  nome_usuario: true,
  cpf_cnpj: true,
  email: true,
  data_cadastro: true,
};

// POST /api/usuario
async function criarUsuario(req, res) {
  try {
    const { nome_usuario, cpf_cnpj, email, senha } = req.body;

    // Validação ANTES de falar com o banco: é mais rápido e devolve
    // uma mensagem que o usuário entende, em vez do erro cru do MySQL.
    if (!nome_usuario || !cpf_cnpj || !email || !senha) {
      return res.status(400).json({
        erro: 'nome_usuario, cpf_cnpj, email e senha são obrigatórios',
      });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ erro: 'Email inválido' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ erro: 'A senha deve ter no mínimo 6 caracteres' });
    }

    // A máscara da tela é só visual. Aqui limpamos de novo, porque
    // requisições podem chegar pelo Insomnia ou por outro front-end,
    // sem passar pelo nosso JavaScript. Guardar sempre só os dígitos
    // é o que faz a regra de campo único funcionar de verdade.
    const documento = limparDocumento(cpf_cnpj);

    if (!documentoTemTamanhoValido(documento)) {
      return res.status(400).json({
        erro: 'CPF deve ter 11 dígitos e CNPJ deve ter 14',
      });
    }

    // O número 10 é o "custo": quantas rodadas de embaralhamento o bcrypt faz.
    // Quanto maior, mais lento de gerar E mais lento de quebrar na força bruta.
    // 10 é o equilíbrio recomendado hoje.
    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
      data: { nome_usuario, cpf_cnpj: documento, email, senha: senhaHash },
      select: camposPublicos,
    });

    res.status(201).json(usuario);
  } catch (erro) {
    // P2002 = violação de campo @unique (email ou cpf_cnpj já cadastrado).
    // Sem esse tratamento, cairia no 500 genérico e o usuário não saberia o motivo.
    if (erro.code === 'P2002') {
      const campo = erro.meta?.target?.includes('email') ? 'Email' : 'CPF/CNPJ';
      return res.status(409).json({ erro: `${campo} já cadastrado` });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
}

// POST /api/usuario/login
async function login(req, res) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    // ATENÇÃO: a mensagem é a MESMA para "email não existe" e para
    // "senha errada". Se fossem diferentes, um atacante descobriria
    // quais emails estão cadastrados só testando um por um.
    if (!usuario) {
      return res.status(401).json({ erro: 'Email ou senha inválidos' });
    }

    // bcrypt.compare aplica o mesmo hash na senha digitada e compara
    // com o que está no banco. Nada é "descriptografado" — hash é
    // via de mão única.
    const senhaConfere = await bcrypt.compare(senha, usuario.senha);

    if (!senhaConfere) {
      return res.status(401).json({ erro: 'Email ou senha inválidos' });
    }

    // O token guarda só o id. NUNCA colocar senha aqui: o JWT é
    // assinado, não criptografado — qualquer um lê o conteúdo dele.
    // O que impede a falsificação é a assinatura com a JWT_SECRET.
    const token = jwt.sign(
      { id_usuario: usuario.id_usuario },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      id_usuario: usuario.id_usuario,
      nome_usuario: usuario.nome_usuario,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
}

// GET /api/usuario/:id
async function buscarUsuario(req, res) {
  try {
    const id = Number(req.params.id);

    // Se vier "abc" na URL, Number() devolve NaN e o Prisma quebraria.
    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: id },
      select: camposPublicos,
    });

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json(usuario);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar usuário' });
  }
}

// PUT /api/usuario/:id
async function atualizarUsuario(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const { nome_usuario, cpf_cnpj, email, senha } = req.body;

    // Monta o objeto só com o que veio. Assim o usuário pode mandar
    // apenas { "email": "novo@x.com" } sem apagar os outros campos.
    const dados = {};
    if (nome_usuario) dados.nome_usuario = nome_usuario;
    if (cpf_cnpj) {
      const documento = limparDocumento(cpf_cnpj);

      if (!documentoTemTamanhoValido(documento)) {
        return res.status(400).json({
          erro: 'CPF deve ter 11 dígitos e CNPJ deve ter 14',
        });
      }

      dados.cpf_cnpj = documento;
    }
    if (email) {
      if (!email.includes('@')) {
        return res.status(400).json({ erro: 'Email inválido' });
      }
      dados.email = email;
    }
    if (senha) {
      if (senha.length < 6) {
        return res.status(400).json({ erro: 'A senha deve ter no mínimo 6 caracteres' });
      }
      dados.senha = await bcrypt.hash(senha, 10);
    }

    if (Object.keys(dados).length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo enviado para atualização' });
    }

    const usuario = await prisma.usuario.update({
      where: { id_usuario: id },
      data: dados,
      select: camposPublicos,
    });

    res.json(usuario);
  } catch (erro) {
    // P2025 = o registro que o Prisma tentou atualizar não existe.
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    if (erro.code === 'P2002') {
      const campo = erro.meta?.target?.includes('email') ? 'Email' : 'CPF/CNPJ';
      return res.status(409).json({ erro: `${campo} já cadastrado` });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar usuário' });
  }
}

// DELETE /api/usuario/:id
async function deletarUsuario(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    // O schema usa onDelete: Cascade — apagar o usuário apaga junto
    // suas contas, transações, metas, perfis vinculados e formulários.
    await prisma.usuario.delete({ where: { id_usuario: id } });

    res.json({ mensagem: 'Usuário removido com sucesso' });
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover usuário' });
  }
}

module.exports = {
  criarUsuario,
  login,
  buscarUsuario,
  atualizarUsuario,
  deletarUsuario,
};
