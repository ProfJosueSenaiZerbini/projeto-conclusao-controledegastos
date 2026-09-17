const prisma = require('../prisma');

// Converte o Decimal do Prisma para número comum.
// O Prisma devolve Decimal (um objeto) para não perder precisão em dinheiro.
// Isso é correto no banco, mas o JSON precisa de um número que o
// JavaScript do navegador saiba formatar.
function comSaldoNumerico(conta) {
  return { ...conta, saldo: Number(conta.saldo) };
}

// Busca a conta e confere se ela é de quem está pedindo.
// Devolve { conta } em caso de sucesso ou { erro, status } para o controller responder.
async function buscarContaDoUsuario(id_conta, id_usuario) {
  const conta = await prisma.conta.findUnique({ where: { id_conta } });

  if (!conta) {
    return { status: 404, erro: 'Conta não encontrada' };
  }

  // O id da URL vem do cliente e pode ser mentira. Sem esta checagem,
  // bastaria trocar o número para mexer na conta de outra pessoa.
  if (conta.id_usuario !== id_usuario) {
    return { status: 403, erro: 'Acesso negado a conta de outro usuário' };
  }

  return { conta };
}

// POST /api/conta
async function criarConta(req, res) {
  try {
    const { nome, saldo } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'O nome da conta é obrigatório' });
    }

    // Saldo inicial é opcional — uma conta nova costuma começar zerada,
    // mas quem já tem dinheiro no banco quer informar quanto.
    let saldoInicial = 0;
    if (saldo !== undefined && saldo !== null && saldo !== '') {
      saldoInicial = Number(saldo);

      if (!Number.isFinite(saldoInicial)) {
        return res.status(400).json({ erro: 'Saldo inválido' });
      }

      // Mesma regra dos gastos: nenhuma conta fica negativa.
      if (saldoInicial < 0) {
        return res.status(400).json({ erro: 'O saldo inicial não pode ser negativo' });
      }
    }

    const conta = await prisma.conta.create({
      data: {
        nome: nome.trim(),
        saldo: saldoInicial,
        // O dono vem do TOKEN, nunca do body. Se viesse do body,
        // qualquer um criaria conta no nome de outra pessoa.
        id_usuario: req.usuario.id_usuario,
      },
    });

    res.status(201).json(comSaldoNumerico(conta));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar conta' });
  }
}

// GET /api/usuario/:id/conta
async function listarContas(req, res) {
  try {
    const contas = await prisma.conta.findMany({
      where: { id_usuario: req.usuario.id_usuario },
      orderBy: { id_conta: 'asc' },
    });

    res.json(contas.map(comSaldoNumerico));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar contas' });
  }
}

// PUT /api/conta/:id
async function atualizarConta(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const resultado = await buscarContaDoUsuario(id, req.usuario.id_usuario);
    if (resultado.erro) {
      return res.status(resultado.status).json({ erro: resultado.erro });
    }

    const { nome, saldo } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'O nome da conta é obrigatório' });
    }

    const dados = { nome: nome.trim() };

    // O saldo é opcional na edição: sem ele, só o nome muda.
    //
    // Editar o saldo serve para acertar o ponto de partida — a Carteira
    // nasce zerada no cadastro, mas a pessoa já tem dinheiro nela. É o
    // mesmo papel do saldo inicial ao criar uma conta: a partir do novo
    // valor, as transações continuam somando e subtraindo normalmente.
    if (saldo !== undefined && saldo !== null && saldo !== '') {
      const novoSaldo = Number(saldo);

      if (!Number.isFinite(novoSaldo)) {
        return res.status(400).json({ erro: 'Saldo inválido' });
      }

      // Mesma regra dos gastos: nenhuma conta fica negativa.
      if (novoSaldo < 0) {
        return res.status(400).json({ erro: 'O saldo não pode ser negativo' });
      }

      dados.saldo = novoSaldo;
    }

    const conta = await prisma.conta.update({
      where: { id_conta: id },
      data: dados,
    });

    res.json(comSaldoNumerico(conta));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar conta' });
  }
}

// DELETE /api/conta/:id
async function deletarConta(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const resultado = await buscarContaDoUsuario(id, req.usuario.id_usuario);
    if (resultado.erro) {
      return res.status(resultado.status).json({ erro: resultado.erro });
    }

    // O schema usa onDelete: Cascade — apagar a conta apaga junto todas
    // as transações dela. A tela avisa disso antes de confirmar.
    await prisma.conta.delete({ where: { id_conta: id } });

    res.json({ mensagem: 'Conta removida com sucesso' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover conta' });
  }
}

module.exports = {
  criarConta,
  listarContas,
  atualizarConta,
  deletarConta,
  buscarContaDoUsuario,
};
