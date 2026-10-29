// Testes dos cálculos das ferramentas de perfil (public/js/perfil-calculos.js).
//
// Como rodar, na pasta do projeto:
//
//     node Docs/Testes/teste-calculos-perfil.js
//
// Cada linha compara o resultado da função com um valor calculado à mão.
// Se algum número oficial mudar (todo janeiro), os valores esperados
// daqui precisam mudar junto.

const assert = require('assert');
const c = require('../../public/js/perfil-calculos.js');

let passou = 0;

function testar(descricao, funcao) {
  try {
    funcao();
    passou++;
    console.log('  ok   ' + descricao);
  } catch (erro) {
    console.log('  FALHOU ' + descricao + '\n         ' + erro.message);
    process.exitCode = 1;
  }
}

// Compara com tolerância de 1 centavo (arredondamento de ponto flutuante).
function perto(recebido, esperado, tolerancia = 0.011) {
  assert.ok(Math.abs(recebido - esperado) <= tolerancia, `esperado ${esperado}, veio ${recebido}`);
}

console.log('\nINSS (CLT)');
testar('salário mínimo paga só 7,5%', () => perto(c.descontoINSS(1621), 121.58));
testar('R$ 3.000 passa por três faixas', () => perto(c.descontoINSS(3000), 248.6));
testar('teto: desconto máximo de R$ 988,09', () => perto(c.descontoINSS(8475.55), 988.09));
testar('acima do teto não desconta mais', () => perto(c.descontoINSS(20000), 988.09));

console.log('\n13º salário');
testar('12 meses de R$ 3.000', () => {
  const d = c.decimoTerceiro(3000, 12);
  perto(d.bruto, 3000);
  perto(d.primeiraParcela, 1500);
  perto(d.inss, 248.6);
  perto(d.segundaParcela, 1251.4);
});
testar('6 meses = metade do 13º', () => perto(c.decimoTerceiro(3000, 6).bruto, 1500));

console.log('\nSeguro-desemprego');
testar('média baixa recebe o piso (salário mínimo)', () => perto(c.parcelaSeguroDesemprego(1500), 1621));
testar('média de R$ 3.000 cai na faixa do meio', () => perto(c.parcelaSeguroDesemprego(3000), 2166.66));
testar('média alta recebe o teto', () => perto(c.parcelaSeguroDesemprego(5000), 2518.65));
testar('as faixas se encontram sem "degrau"', () => {
  perto(c.parcelaSeguroDesemprego(3703.99), 2518.65);
});
testar('1º pedido: 11 meses não dá direito', () => assert.strictEqual(c.parcelasSeguroDesemprego(11, 1), 0));
testar('1º pedido: 12 meses = 4 parcelas', () => assert.strictEqual(c.parcelasSeguroDesemprego(12, 1), 4));
testar('1º pedido: 24 meses = 5 parcelas', () => assert.strictEqual(c.parcelasSeguroDesemprego(24, 1), 5));
testar('2º pedido: 9 meses = 3 parcelas', () => assert.strictEqual(c.parcelasSeguroDesemprego(9, 2), 3));
testar('3º pedido: 6 meses = 3 parcelas', () => assert.strictEqual(c.parcelasSeguroDesemprego(6, 3), 3));
testar('3º pedido: 5 meses não dá direito', () => assert.strictEqual(c.parcelasSeguroDesemprego(5, 3), 0));

console.log('\nQuanto tempo o dinheiro dura');
testar('R$ 3.000 gastando R$ 1.000 = 3 meses', () => perto(c.mesesQueODinheiroDura(3000, 1000), 3, 0.001));
testar('com 2 parcelas de seguro, dura mais', () =>
  perto(c.mesesQueODinheiroDura(3000, 2000, [1621, 1621]), 3.121, 0.001));
testar('renda fixa maior que o gasto: não acaba', () =>
  assert.strictEqual(c.mesesQueODinheiroDura(1000, 1500, [], 2000), Infinity));
testar('sem saldo: 0 meses', () => perto(c.mesesQueODinheiroDura(0, 1000), 0, 0.001));

console.log('\nAutônomo');
testar('com 3 meses, usa os 2 mais fracos (e não vira a média comum)', () => {
  const r = c.salarioSeguroAutonomo([2800, 1500, 4200]);
  perto(r.salarioSeguro, 2150);
  perto(r.media, 2833.33);
});
testar('com 5 meses, usa os 3 mais fracos', () => {
  const r = c.salarioSeguroAutonomo([3000, 1500, 6000, 2000, 4000]);
  perto(r.salarioSeguro, 2166.67);
  perto(r.media, 3300);
  perto(r.menorMes, 1500);
});
testar('sem dados: null', () => assert.strictEqual(c.salarioSeguroAutonomo([]), null));

console.log('\nEstudante');
testar('R$ 600 num mês de 30 dias = R$ 140 por semana', () => perto(c.limiteSemanal(600, 30), 140));
testar('80% do limite já é "atenção"', () => assert.strictEqual(c.situacaoDoLimite(112, 140), 'atencao'));
testar('passou do limite: "estourou"', () => assert.strictEqual(c.situacaoDoLimite(150, 140), 'estourou'));

console.log('\nDoméstico');
testar('vence dia 10, hoje é 15/10: faltam 26 dias', () =>
  assert.strictEqual(c.diasAteVencimento(10, new Date(2026, 9, 15)), 26));
testar('vence hoje: 0 dias', () => assert.strictEqual(c.diasAteVencimento(5, new Date(2026, 9, 5)), 0));
testar('dia 31 em fevereiro cai no dia 28', () =>
  assert.strictEqual(c.diasAteVencimento(31, new Date(2026, 1, 10)), 18));
testar('conta de R$ 180 com 10 dias de atraso: R$ 4,20 a mais', () => perto(c.custoDoAtraso(180, 10), 4.2));

// situacaoContaFixa: hoje = 15/10/2026 em todos os casos abaixo.
const dia15 = new Date(2026, 9, 15);
const situacao = (conta) => c.situacaoContaFixa(conta, dia15);
testar('venceu dia 10 e não foi paga: atrasada há 5 dias', () =>
  assert.deepStrictEqual(situacao({ dia: 10, criadaEm: '2026-09-01' }), { situacao: 'atrasada', dias: 5 }));
testar('venceu dia 10 e foi paga: próxima em 26 dias (10/11)', () =>
  assert.deepStrictEqual(situacao({ dia: 10, pagaEm: '2026-10', criadaEm: '2026-09-01' }), { situacao: 'paga', dias: 26 }));
testar('paga no mês passado não conta como paga neste', () =>
  assert.strictEqual(situacao({ dia: 10, pagaEm: '2026-09', criadaEm: '2026-09-01' }).situacao, 'atrasada'));
testar('vence dia 20: a vencer em 5 dias', () =>
  assert.deepStrictEqual(situacao({ dia: 20, criadaEm: '2026-09-01' }), { situacao: 'a_vencer', dias: 5 }));
testar('vence hoje: a vencer em 0 dias (ainda não atrasou)', () =>
  assert.deepStrictEqual(situacao({ dia: 15, criadaEm: '2026-09-01' }), { situacao: 'a_vencer', dias: 0 }));
testar('cadastrada depois do vencimento: só vale no mês que vem', () =>
  assert.deepStrictEqual(situacao({ dia: 10, criadaEm: '2026-10-12' }), { situacao: 'a_vencer', dias: 26 }));
testar('dia 31 em fevereiro vence no dia 28', () =>
  assert.deepStrictEqual(c.situacaoContaFixa({ dia: 31, criadaEm: '2026-01-01' }, new Date(2026, 1, 10)), {
    situacao: 'a_vencer',
    dias: 18,
  }));

console.log('\nAposentado');
testar('empréstimo de R$ 10.000 em 24x de R$ 528,71 = 2% ao mês', () => {
  const r = c.custoDoEmprestimo(10000, 528.71, 24);
  perto(r.totalPago, 12689.04);
  perto(r.taxaMensal, 0.02, 0.0001);
});
testar('sem juros: taxa zero', () => assert.strictEqual(c.custoDoEmprestimo(1200, 100, 12).taxaMensal, 0));

console.log(`\n${passou} testes passaram.` + (process.exitCode ? ' Há falhas acima.' : ''));
