// Regras de saldo que dependem do calendário.
//
// O saldo GUARDADO no banco (Conta.saldo) muda só quando a pessoa faz
// alguma coisa: lança um ganho, lança um gasto já pago, marca ou desmarca
// um gasto como pago. Cada uma dessas ações atualiza o saldo na mesma
// operação atômica da transação (ver transacaoController.js).
//
//   Conta.saldo = saldo inicial + ganhos lançados − gastos pagos
//
// O que depende do DIA DE HOJE não pode ficar guardado, porque mudaria
// sozinho à meia-noite (e precisaria de um programa rodando para
// atualizar). Por isso é calculado aqui, na hora de mostrar:
//
//   saldo atual    = Conta.saldo − ganhos com data futura (ainda não chegaram)
//   saldo previsto = Conta.saldo − gastos ainda não pagos
//
// Contas importadas do banco não entram nessa conta: o saldo delas é o
// que o banco informa.

// O dia de hoje no relógio do servidor, como data "pura" (sem horário).
// new Date() sozinho guardaria a data em UTC: às 22h no Brasil já seria
// o dia seguinte.
function hojeSemHorario() {
  const agora = new Date();
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

// Centavos inteiros, para somar e subtrair dinheiro sem os erros de
// arredondamento do JavaScript (0.1 + 0.2 = 0.30000000000000004).
function emCentavos(valor) {
  return Math.round(Number(valor || 0) * 100);
}

// Soma, por conta, os ganhos futuros e os gastos não pagos.
// Devolve um Map: id_conta → { ganhosFuturos, gastosNaoPagos } (em centavos).
// `cliente` é o prisma ou o `tx` de um $transaction.
async function calcularAjustes(cliente, idsContas) {
  const ajustes = new Map(idsContas.map((id) => [id, { ganhosFuturos: 0, gastosNaoPagos: 0 }]));
  if (idsContas.length === 0) return ajustes;

  const [ganhosFuturos, gastosNaoPagos] = await Promise.all([
    cliente.transacao.groupBy({
      by: ['id_conta'],
      where: {
        id_conta: { in: idsContas },
        data_transacao: { gt: hojeSemHorario() },
        categoria: { tipo: 'receita' },
      },
      _sum: { valor_transacao: true },
    }),
    cliente.transacao.groupBy({
      by: ['id_conta'],
      where: {
        id_conta: { in: idsContas },
        data_pagamento: null,
        categoria: { tipo: 'despesa' },
      },
      _sum: { valor_transacao: true },
    }),
  ]);

  ganhosFuturos.forEach((g) => {
    ajustes.get(g.id_conta).ganhosFuturos = emCentavos(g._sum.valor_transacao);
  });
  gastosNaoPagos.forEach((g) => {
    ajustes.get(g.id_conta).gastosNaoPagos = emCentavos(g._sum.valor_transacao);
  });

  return ajustes;
}

// Devolve a conta com `saldo` (o de hoje) e `saldo_previsto` em números
// comuns, prontos para o JSON.
function comSaldos(conta, ajustes) {
  const guardado = emCentavos(conta.saldo);

  if (conta.id_conexao) {
    return { ...conta, saldo: guardado / 100, saldo_previsto: guardado / 100 };
  }

  const { ganhosFuturos, gastosNaoPagos } = ajustes.get(conta.id_conta) || {
    ganhosFuturos: 0,
    gastosNaoPagos: 0,
  };

  return {
    ...conta,
    saldo: (guardado - ganhosFuturos) / 100,
    saldo_previsto: (guardado - gastosNaoPagos) / 100,
  };
}

module.exports = { hojeSemHorario, emCentavos, calcularAjustes, comSaldos };
