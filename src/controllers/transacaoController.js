const prisma = require('../prisma');

// Transforma os Decimal do Prisma em números comuns para o JSON.
function comValorNumerico(transacao) {
  return { ...transacao, valor_transacao: Number(transacao.valor_transacao) };
}

// POST /api/transacao
async function criarTransacao(req, res) {
  try {
    const { valor_transacao, data_transacao, descricao, id_categoria, id_conta } = req.body;

    // ---- VALIDAÇÕES (antes de encostar no banco) ----

    const valor = Number(valor_transacao);
    if (!Number.isFinite(valor) || valor <= 0) {
      return res.status(400).json({ erro: 'O valor deve ser um número maior que zero' });
    }

    const idCategoria = Number(id_categoria);
    const idConta = Number(id_conta);

    if (!Number.isInteger(idCategoria) || !Number.isInteger(idConta)) {
      return res.status(400).json({ erro: 'Categoria e conta são obrigatórias' });
    }

    // O campo é @db.Date no schema; o Prisma espera um objeto Date,
    // não a string "2026-09-06" que chega do formulário.
    const data = data_transacao ? new Date(data_transacao) : new Date();
    if (Number.isNaN(data.getTime())) {
      return res.status(400).json({ erro: 'Data inválida' });
    }

    // A conta é de quem está pedindo? Sem isso, alguém lançaria
    // transações na conta de outra pessoa.
    const conta = await prisma.conta.findUnique({ where: { id_conta: idConta } });

    if (!conta) {
      return res.status(404).json({ erro: 'Conta não encontrada' });
    }

    if (conta.id_usuario !== req.usuario.id_usuario) {
      return res.status(403).json({ erro: 'Acesso negado a conta de outro usuário' });
    }

    // ---- A OPERAÇÃO ATÔMICA ----
    //
    // Criar a transação e atualizar o saldo da conta são DUAS escritas
    // que precisam acontecer juntas. Se a segunda falhasse depois da
    // primeira, o saldo ficaria divergente do histórico para sempre,
    // sem nada indicando o erro.
    //
    // Dentro do $transaction, ou tudo é gravado, ou nada é.
    const transacao = await prisma.$transaction(async (tx) => {
      const categoria = await tx.categoria.findUnique({
        where: { id_categoria: idCategoria },
      });

      // Lançar erro aqui desfaz a transação inteira automaticamente.
      if (!categoria) {
        throw new Error('CATEGORIA_NAO_ENCONTRADA');
      }

      const novaTransacao = await tx.transacao.create({
        data: {
          valor_transacao: valor,
          data_transacao: data,
          descricao: descricao?.trim() || null,
          id_categoria: idCategoria,
          id_conta: idConta,
        },
        include: { categoria: true },
      });

      // O sinal NÃO vem da transação — vem do tipo da categoria.
      // Uma transação em "Salário" é necessariamente receita.
      // Por isso `tipo_transacao` foi removido do modelo (3FN).
      await tx.conta.update({
        where: { id_conta: idConta },
        data: {
          saldo:
            categoria.tipo === 'receita'
              ? { increment: valor }
              : { decrement: valor },
        },
      });

      return novaTransacao;
    });

    res.status(201).json(comValorNumerico(transacao));
  } catch (erro) {
    if (erro.message === 'CATEGORIA_NAO_ENCONTRADA') {
      return res.status(400).json({ erro: 'Categoria não encontrada' });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao registrar transação' });
  }
}

// GET /api/usuario/:id/transacao
async function listarTransacoes(req, res) {
  try {
    // Transacao não tem id_usuario (removido por 3FN). O caminho até o
    // dono passa pela conta: toda conta pertence a um usuário.
    const transacoes = await prisma.transacao.findMany({
      where: { conta: { id_usuario: req.usuario.id_usuario } },
      include: {
        categoria: true,
        conta: { select: { id_conta: true, nome: true } },
      },
      orderBy: [{ data_transacao: 'desc' }, { id_transacao: 'desc' }],
    });

    res.json(transacoes.map(comValorNumerico));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar transações' });
  }
}

module.exports = { criarTransacao, listarTransacoes };
