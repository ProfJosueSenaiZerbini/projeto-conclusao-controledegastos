const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

// Remove tudo que não é dígito: "123.456.789-00" vira "12345678900".
// O banco guarda apenas números; pontos e traços são enfeite de tela.
function limparDocumento(valor) {
  return String(valor).replace(/\D/g, '');
}

// ---- DÍGITOS VERIFICADORES ----
//
// Os dois últimos números de um CPF (e de um CNPJ) não são sorteados:
// são calculados a partir dos anteriores, pela regra da Receita Federal.
// Refazendo a conta, dá para saber se o número é um documento que poderia
// ter sido emitido. Isso barra números inventados ("123.456.789-00"),
// erros de digitação e sequências repetidas ("111.111.111-11").
//
// A conta é sempre: multiplica cada dígito por um peso, soma tudo e tira
// o resto da divisão por 11. O que muda entre CPF e CNPJ são os pesos.

function cpfValido(cpf) {
  // Sequências repetidas passam na conta, mas a Receita não as emite.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Pesos decrescentes até 2: 10..2 para o 1º dígito, 11..2 para o 2º.
  function calcularDigito(base) {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }

  return (
    calcularDigito(cpf.slice(0, 9)) === Number(cpf[9]) &&
    calcularDigito(cpf.slice(0, 10)) === Number(cpf[10])
  );
}

function cnpjValido(cnpj) {
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  // Pesos de 2 a 9 que se repetem, da direita para a esquerda:
  // 5,4,3,2,9,8,7,6,5,4,3,2 no 1º dígito e 6,5,4,3,2,9,...,2 no 2º.
  function calcularDigito(base) {
    let soma = 0;
    let peso = base.length - 7;
    for (const digito of base) {
      soma += Number(digito) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  return (
    calcularDigito(cnpj.slice(0, 12)) === Number(cnpj[12]) &&
    calcularDigito(cnpj.slice(0, 13)) === Number(cnpj[13])
  );
}

// Devolve a mensagem de erro, ou null se o documento é válido.
// Recebe o documento já limpo (só dígitos).
function validarDocumento(documento) {
  if (documento.length === 11) {
    return cpfValido(documento) ? null : 'CPF inválido. Confira os números digitados.';
  }

  if (documento.length === 14) {
    return cnpjValido(documento) ? null : 'CNPJ inválido. Confira os números digitados.';
  }

  // CPF tem 11 dígitos, CNPJ tem 14. Não existe meio-termo.
  return 'CPF deve ter 11 dígitos e CNPJ deve ter 14';
}

// Campos que PODEM sair na resposta. Repare que `senha` não está aqui:
// mesmo com hash, o hash nunca deve trafegar para fora do servidor.
// Usar `select` é mais seguro do que apagar o campo depois — se um dia
// alguém adicionar uma coluna sensível no schema, ela não vaza por acidente.
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

    const erroDocumento = validarDocumento(documento);
    if (erroDocumento) {
      return res.status(400).json({ erro: erroDocumento });
    }

    // O número 10 é o "custo": quantas rodadas de embaralhamento o bcrypt faz.
    // Quanto maior, mais lento de gerar E mais lento de quebrar na força bruta.
    // 10 é o equilíbrio recomendado hoje.
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar o usuário e a Carteira dele são UMA operação só.
    //
    // O $transaction garante que ou as duas coisas acontecem, ou nenhuma.
    // Se a conta falhasse depois do usuário ter sido criado, existiria
    // alguém cadastrado sem lugar nenhum para registrar dinheiro — e nada
    // no sistema indicaria o problema.
    const usuario = await prisma.$transaction(async (tx) => {
      const novoUsuario = await tx.usuario.create({
        data: { nome_usuario, cpf_cnpj: documento, email, senha: senhaHash },
        select: camposPublicos,
      });

      await tx.conta.create({
        data: {
          nome: 'Carteira',
          saldo: 0.0,
          id_usuario: novoUsuario.id_usuario,
        },
      });

      return novoUsuario;
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

      const erroDocumento = validarDocumento(documento);
      if (erroDocumento) {
        return res.status(400).json({ erro: erroDocumento });
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
