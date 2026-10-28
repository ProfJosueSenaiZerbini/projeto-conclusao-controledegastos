const prisma = require('../prisma');
const { hojeSemHorario } = require('../saldo');

// Transforma os Decimal do Prisma em números comuns para o JSON.
function comValorNumerico(transacao) {
  return { ...transacao, valor_transacao: Number(transacao.valor_transacao) };
}

// O que a tela precisa saber da transação e da conta dela. id_conexao
// diz se a conta é importada (aí o "pago" vem do banco, sem botão).
const INCLUIR = {
  categoria: true,
  conta: { select: { id_conta: true, nome: true, id_conexao: true } },
};

// POST /api/transacao
//
// REGRA DO SALDO: um ganho entra no saldo ao ser lançado; um gasto só sai
// do saldo quando está PAGO. Um gasto lançado como "não pago" (uma conta a
// pagar) fica registrado, mas o saldo não muda até alguém marcar como pago.
//
// O saldo pode ficar negativo: o dinheiro das contas manuais é informado
// pela própria pessoa, então o Verdanz não recusa o gasto.
async function criarTransacao(req, res) {
  try {
    const { valor_transacao, data_transacao, descricao, id_categoria, id_conta, pago } = req.body;

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
    const hoje = hojeSemHorario();
    const data = data_transacao ? new Date(data_transacao) : hoje;
    if (Number.isNaN(data.getTime())) {
      return res.status(400).json({ erro: 'Data inválida' });
    }

    if (pago !== undefined && typeof pago !== 'boolean') {
      return res.status(400).json({ erro: 'O campo "pago" deve ser verdadeiro ou falso' });
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

    // Conta importada recebe transações só do banco, pela sincronização.
    // Um lançamento à mão nela faria o saldo discordar do extrato real.
    if (conta.id_conexao) {
      return res.status(400).json({
        erro: `A conta "${conta.nome}" é importada do banco e recebe transações só pela sincronização. Escolha outra conta.`,
      });
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

      // "Metas" é lançada só pelo "Adicionar valor" da tela de Metas, que
      // também soma o valor na meta. À mão, o dinheiro sairia da conta sem
      // entrar em meta nenhuma.
      if (categoria.nome_categoria === 'Metas') {
        throw new Error('CATEGORIA_SO_DE_METAS');
      }

      // O sinal NÃO vem da transação — vem do tipo da categoria.
      // Uma transação em "Salário" é necessariamente receita.
      // Por isso `tipo_transacao` foi removido do modelo (3FN).
      let dataPagamento = null;

      if (categoria.tipo === 'receita') {
        await tx.conta.update({
          where: { id_conta: idConta },
          data: { saldo: { increment: valor } },
        });
      } else {
        // Sem a informação na requisição, vale o mais comum: um gasto de
        // hoje ou de antes já foi pago; um gasto com data futura é uma
        // conta a pagar.
        const estaPago = pago !== undefined ? pago : data <= hoje;

        if (estaPago) {
          // Pago com data futura = pagou adiantado, hoje.
          dataPagamento = data <= hoje ? data : hoje;

          await tx.conta.update({
            where: { id_conta: idConta },
            data: { saldo: { decrement: valor } },
          });
        }
      }

      return tx.transacao.create({
        data: {
          valor_transacao: valor,
          data_transacao: data,
          descricao: descricao?.trim() || null,
          id_categoria: idCategoria,
          id_conta: idConta,
          data_pagamento: dataPagamento,
        },
        include: INCLUIR,
      });
    });

    res.status(201).json(comValorNumerico(transacao));
  } catch (erro) {
    if (erro.message === 'CATEGORIA_NAO_ENCONTRADA') {
      return res.status(400).json({ erro: 'Categoria não encontrada' });
    }

    if (erro.message === 'CATEGORIA_SO_DE_METAS') {
      return res.status(400).json({
        erro: 'Para guardar dinheiro numa meta, use "Adicionar valor" na tela de Metas',
      });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao registrar transação' });
  }
}

// PATCH /api/transacao/:id/pagamento   corpo: { "pago": true } ou { "pago": false }
//
// Marcar como pago tira o valor do saldo; desmarcar devolve. As duas
// escritas (a data de pagamento e o saldo) vão no mesmo $transaction.
async function marcarPagamento(req, res) {
  try {
    const id = Number(req.params.id);
    const { pago } = req.body;

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    if (typeof pago !== 'boolean') {
      return res.status(400).json({ erro: 'Envie "pago": true ou "pago": false' });
    }

    const transacao = await prisma.transacao.findUnique({
      where: { id_transacao: id },
      include: { categoria: true, conta: true },
    });

    if (!transacao) {
      return res.status(404).json({ erro: 'Transação não encontrada' });
    }

    if (transacao.conta.id_usuario !== req.usuario.id_usuario) {
      return res.status(403).json({ erro: 'Acesso negado a transação de outro usuário' });
    }

    // Numa conta importada, quem diz o que foi pago é o banco: as
    // transações dela são dinheiro que já se movimentou de verdade.
    if (transacao.conta.id_conexao) {
      return res.status(400).json({
        erro: 'Transações de conta importada vêm do banco e não podem ser marcadas como pagas ou não pagas',
      });
    }

    if (transacao.categoria.tipo !== 'despesa') {
      return res.status(400).json({ erro: 'Só gastos podem ser marcados como pagos' });
    }

    // O dinheiro guardado numa meta já saiu da conta. Desmarcar devolveria
    // o valor à conta sem tirar da meta.
    if (transacao.categoria.nome_categoria === 'Metas') {
      return res.status(400).json({ erro: 'Gastos de meta já saem pagos e não podem ser alterados' });
    }

    const valor = transacao.valor_transacao;

    const atualizada = await prisma.$transaction(async (tx) => {
      // A condição sobre data_pagamento vai no WHERE: se dois cliques
      // chegarem juntos, só o primeiro muda a linha (count = 1) e só ele
      // mexe no saldo. O segundo encontra count = 0 e para.
      const { count } = await tx.transacao.updateMany({
        where: { id_transacao: id, data_pagamento: pago ? null : { not: null } },
        data: { data_pagamento: pago ? hojeSemHorario() : null },
      });

      if (count === 0) {
        throw new Error(pago ? 'JA_PAGO' : 'JA_NAO_PAGO');
      }

      await tx.conta.update({
        where: { id_conta: transacao.id_conta },
        data: { saldo: pago ? { decrement: valor } : { increment: valor } },
      });

      return tx.transacao.findUnique({ where: { id_transacao: id }, include: INCLUIR });
    });

    res.json(comValorNumerico(atualizada));
  } catch (erro) {
    if (erro.message === 'JA_PAGO') {
      return res.status(409).json({ erro: 'Este gasto já está marcado como pago' });
    }

    if (erro.message === 'JA_NAO_PAGO') {
      return res.status(409).json({ erro: 'Este gasto já está como não pago' });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar o pagamento' });
  }
}

// GET /api/usuario/:id/transacao
async function listarTransacoes(req, res) {
  try {
    // Transacao não tem id_usuario (removido por 3FN). O caminho até o
    // dono passa pela conta: toda conta pertence a um usuário.
    const transacoes = await prisma.transacao.findMany({
      where: { conta: { id_usuario: req.usuario.id_usuario } },
      include: INCLUIR,
      orderBy: [{ data_transacao: 'desc' }, { id_transacao: 'desc' }],
    });

    res.json(transacoes.map(comValorNumerico));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar transações' });
  }
}

module.exports = { criarTransacao, marcarPagamento, listarTransacoes };
