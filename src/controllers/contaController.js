const prisma = require('../prisma');
const { calcularAjustes, comSaldos, emCentavos } = require('../saldo');

// Devolve a conta com `saldo` (o de hoje) e `saldo_previsto`, em números
// comuns. O Prisma devolve Decimal (um objeto) para não perder precisão em
// dinheiro; o JSON precisa de um número que o navegador saiba formatar.
// O cálculo dos dois saldos está explicado em src/saldo.js.
async function comSaldoNumerico(conta) {
  const ajustes = await calcularAjustes(prisma, [conta.id_conta]);
  return comSaldos(conta, ajustes);
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

// Contas importadas de um banco espelham o extrato real. Editar o saldo
// ou apagar uma delas faria o Verdanz discordar do banco (e a próxima
// sincronização traria a conta de volta). Quem atualiza é o banco.
const MENSAGEM_CONTA_IMPORTADA = {
  editar: 'Contas importadas são atualizadas pelo banco. Use "Sincronizar" na tela de Contas.',
  excluir: 'Para remover uma conta importada, desconecte o banco na tela de Contas.',
};

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

      // Pode ser negativo: o dinheiro das contas manuais é informado pela
      // própria pessoa (quem começa no cheque especial, por exemplo).
      if (!Number.isFinite(saldoInicial)) {
        return res.status(400).json({ erro: 'Saldo inválido' });
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

    res.status(201).json(await comSaldoNumerico(conta));
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
      // O nome do banco vai junto para a tela mostrar o selo nas contas
      // importadas. Nas contas manuais, `conexao` vem null.
      include: { conexao: { select: { banco: true } } },
      orderBy: { id_conta: 'asc' },
    });

    // Uma consulta só para todas as contas, em vez de uma por conta.
    const ajustes = await calcularAjustes(prisma, contas.map((c) => c.id_conta));
    res.json(contas.map((c) => comSaldos(c, ajustes)));
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

    if (resultado.conta.id_conexao) {
      return res.status(400).json({ erro: MENSAGEM_CONTA_IMPORTADA.editar });
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

      // Pode ser negativo, como o saldo inicial.
      if (!Number.isFinite(novoSaldo)) {
        return res.status(400).json({ erro: 'Saldo inválido' });
      }

      // A pessoa informa o saldo de HOJE. O banco guarda também os ganhos
      // com data futura (ver src/saldo.js), então eles são somados aqui;
      // senão, o saldo mostrado depois da edição ficaria menor que o digitado.
      const ajustes = await calcularAjustes(prisma, [id]);
      dados.saldo = (emCentavos(novoSaldo) + ajustes.get(id).ganhosFuturos) / 100;
    }

    const conta = await prisma.conta.update({
      where: { id_conta: id },
      data: dados,
    });

    res.json(await comSaldoNumerico(conta));
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

    if (resultado.conta.id_conexao) {
      return res.status(400).json({ erro: MENSAGEM_CONTA_IMPORTADA.excluir });
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
