// Cálculos das ferramentas de cada perfil (tela /meu-perfil).
//
// Só tem CONTA aqui: nenhuma função mexe na tela nem chama a API. Isso
// permite testar tudo pelo Node, sem abrir o navegador:
//
//     node Docs/Testes/teste-calculos-perfil.js
//
// ---- VALORES OFICIAIS DE 2026 ----
// Ficam todos juntos nesta constante, com o ano no nome, por um motivo
// prático: esses números mudam todo janeiro (salário mínimo, INSS,
// seguro-desemprego, MEI). Quem for atualizar mexe só aqui.
//
// De onde veio cada valor está em Docs/Perfis/analise-funcionalidades-por-perfil.md.

const VALORES_2026 = {
  salarioMinimo: 1621.0,

  // INSS do empregado (CLT): alíquota progressiva por faixa.
  // Cada faixa só cobra a sua alíquota sobre a parte do salário que
  // cai dentro dela — como degraus de uma escada.
  faixasINSS: [
    { ate: 1621.0, aliquota: 0.075 },
    { ate: 2902.84, aliquota: 0.09 },
    { ate: 4354.27, aliquota: 0.12 },
    { ate: 8475.55, aliquota: 0.14 }, // teto: acima disso não desconta mais
  ],

  // Seguro-desemprego: valor da parcela pela média dos 3 últimos salários.
  seguroDesemprego: {
    faixa1Ate: 2222.17, // até aqui: 80% da média
    faixa2Ate: 3703.99, // até aqui: R$ 1.777,74 + 50% do que passar da faixa 1
    baseFaixa2: 1777.74,
    teto: 2518.65,
    // O piso é o salário mínimo: nenhuma parcela é menor que ele.
  },

  // MEI: guia mensal (DAS) e limite de faturamento por ano.
  dasMEI: { comercio: 82.05, servicos: 86.05, ambos: 87.05 },
  diaVencimentoDAS: 20,
  limiteAnualMEI: 81000,

  // Contas de consumo pagas com atraso: multa de até 2% + juros de 1% ao mês.
  multaAtraso: 0.02,
  jurosAtrasoMes: 0.01,
};

// Arredonda para centavos. Sem isso, 0.1 + 0.2 vira 0.30000000000000004
// e os valores aparecem com "sujeira" na tela.
function centavos(valor) {
  return Math.round(valor * 100) / 100;
}

// ================================
// CLT
// ================================

// Desconto do INSS de um empregado, pela tabela progressiva.
// Exemplo com R$ 3.000: 7,5% sobre os primeiros 1.621, 9% sobre o que vai
// de 1.621 a 2.902,84, e 12% só sobre os 97,16 que passam de 2.902,84.
function descontoINSS(salario) {
  let desconto = 0;
  let inicioDaFaixa = 0;

  for (const faixa of VALORES_2026.faixasINSS) {
    if (salario <= inicioDaFaixa) break;
    const parteNaFaixa = Math.min(salario, faixa.ate) - inicioDaFaixa;
    desconto += parteNaFaixa * faixa.aliquota;
    inicioDaFaixa = faixa.ate;
  }

  return centavos(desconto);
}

// 13º salário: 1/12 do salário por mês trabalhado no ano.
// (Mês com 15 dias ou mais de trabalho conta como mês inteiro.)
//
// A 1ª parcela (até 30/11) é metade do bruto, SEM desconto nenhum.
// O INSS do 13º inteiro sai todo da 2ª parcela (até 20/12) — por isso
// ela vem bem menor, e é aí que muita gente se assusta.
//
// O Imposto de Renda também sai da 2ª parcela, mas NÃO é calculado aqui:
// ele depende de dependentes, pensão e de regras que mudaram em 2026.
// A tela avisa isso em vez de mostrar um número que pode estar errado.
function decimoTerceiro(salario, mesesTrabalhados) {
  const meses = Math.min(12, Math.max(0, Math.floor(mesesTrabalhados)));
  const bruto = centavos((salario * meses) / 12);
  const primeiraParcela = centavos(bruto / 2);
  const inss = descontoINSS(bruto);
  const segundaParcela = centavos(bruto - primeiraParcela - inss);

  return { bruto, primeiraParcela, inss, segundaParcela };
}

// ================================
// DESEMPREGADO
// ================================

// Valor de cada parcela do seguro-desemprego.
function parcelaSeguroDesemprego(mediaSalarial) {
  const s = VALORES_2026.seguroDesemprego;
  let valor;

  if (mediaSalarial <= s.faixa1Ate) {
    valor = mediaSalarial * 0.8;
  } else if (mediaSalarial <= s.faixa2Ate) {
    valor = s.baseFaixa2 + (mediaSalarial - s.faixa1Ate) * 0.5;
  } else {
    valor = s.teto;
  }

  // Nunca abaixo do salário mínimo, nunca acima do teto.
  valor = Math.max(VALORES_2026.salarioMinimo, Math.min(valor, s.teto));
  return centavos(valor);
}

// Quantas parcelas a pessoa recebe (Lei 13.134/2015). Depende de quantos
// meses trabalhou com carteira nos últimos 36 meses e de quantas vezes
// já pediu o seguro. Quem pede pela 1ª vez precisa de mais tempo de
// trabalho — a regra é mais dura na primeira solicitação.
//
// solicitacao: 1 (primeira), 2 (segunda) ou 3 (terceira em diante).
// Devolve 0 quando a pessoa não tem direito.
function parcelasSeguroDesemprego(mesesTrabalhados, solicitacao) {
  const minimo = { 1: 12, 2: 9, 3: 6 }[Math.min(3, Math.max(1, solicitacao))];

  if (mesesTrabalhados < minimo) return 0;
  if (mesesTrabalhados >= 24) return 5;
  if (mesesTrabalhados >= 12) return 4;
  return 3; // só chega aqui na 2ª (9 a 11 meses) ou 3ª+ (6 a 11 meses)
}

// Por quantos meses o dinheiro dura.
//
// Simula mês a mês: soma o que entra (parcelas do seguro, bicos) e
// tira o gasto. Para quando o dinheiro não cobre o mês seguinte.
// O resultado tem casas decimais: 3,5 = três meses e meio.
//
// entradas: lista do que entra em cada mês, a partir do próximo.
//           Ex.: [1800, 1800, 1800] = 3 parcelas de seguro.
// Devolve Infinity quando entra mais do que sai (o dinheiro não acaba).
function mesesQueODinheiroDura(saldo, gastoMensal, entradas = [], rendaFixaMensal = 0) {
  if (gastoMensal <= 0) return Infinity;

  let restante = saldo;
  for (let mes = 0; mes < 120; mes++) {
    const entra = (entradas[mes] || 0) + rendaFixaMensal;
    const precisa = gastoMensal - entra;

    if (precisa <= 0) {
      // Neste mês entra mais do que sai. Se for renda fixa (e não uma
      // parcela que acaba), o dinheiro nunca acaba.
      if (mes >= entradas.length) return Infinity;
      restante -= precisa; // sobra vira saldo
      continue;
    }

    if (restante < precisa) {
      return Math.max(0, mes + restante / precisa);
    }
    restante -= precisa;
  }
  return Infinity;
}

// ================================
// AUTÔNOMO
// ================================

// "Salário" que o autônomo pode se pagar com segurança: a média da
// METADE MAIS FRACA dos meses (com 6 meses, os 3 piores; com 3 meses,
// os 2 piores). A ideia é viver como se todo mês fosse um mês fraco, e
// guardar o que vier a mais nos meses bons — é isso que cobre os meses
// ruins sem cair no cartão de crédito.
//
// Por que "metade" e não "os 3 piores": com só 3 meses de histórico,
// "os 3 piores" seriam todos os meses, e o salário seguro viraria a
// média comum — sem proteção nenhuma.
//
// receitasPorMes: lista com o total recebido em cada mês (só meses com dado).
function salarioSeguroAutonomo(receitasPorMes) {
  const meses = receitasPorMes.filter((v) => v > 0);
  if (meses.length === 0) return null;

  const ordenados = [...meses].sort((a, b) => a - b);
  const maisFracos = ordenados.slice(0, Math.ceil(ordenados.length / 2));

  const media = meses.reduce((a, b) => a + b, 0) / meses.length;
  const salario = maisFracos.reduce((a, b) => a + b, 0) / maisFracos.length;

  return {
    media: centavos(media),
    menorMes: centavos(ordenados[0]),
    maiorMes: centavos(ordenados[ordenados.length - 1]),
    salarioSeguro: centavos(salario),
    mesesAnalisados: meses.length,
  };
}

// ================================
// ESTUDANTE
// ================================

// Divide a mesada (ou bolsa) do mês em limites por semana.
// Usa os dias reais do mês: fevereiro tem 4 semanas, outubro tem 4,4.
function limiteSemanal(valorMensal, diasNoMes) {
  return centavos((valorMensal / diasNoMes) * 7);
}

// Situação do gasto na semana: 'ok', 'atencao' (passou de 80%) ou 'estourou'.
// 80% é o ponto de alerta que a persona Ana pediu: dá tempo de segurar
// antes de estourar.
function situacaoDoLimite(gasto, limite) {
  if (limite <= 0) return 'ok';
  const uso = gasto / limite;
  if (uso > 1) return 'estourou';
  if (uso >= 0.8) return 'atencao';
  return 'ok';
}

// ================================
// DOMÉSTICO
// ================================

// Quantos dias faltam para o vencimento (dia do mês) a partir de hoje.
// Se o dia já passou neste mês, conta até o mesmo dia do mês que vem.
// Dias que não existem no mês (31 em abril) caem no último dia do mês.
function diasAteVencimento(diaVencimento, hoje) {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();

  function dataNoMes(a, m) {
    const ultimoDia = new Date(a, m + 1, 0).getDate();
    return new Date(a, m, Math.min(diaVencimento, ultimoDia));
  }

  const inicioDeHoje = new Date(ano, mes, hoje.getDate());
  let vencimento = dataNoMes(ano, mes);
  if (vencimento < inicioDeHoje) vencimento = dataNoMes(ano, mes + 1);

  return Math.round((vencimento - inicioDeHoje) / 86400000);
}

// Quanto custa pagar uma conta com atraso: multa fixa + juros por dia.
function custoDoAtraso(valor, diasDeAtraso) {
  if (diasDeAtraso <= 0) return 0;
  const multa = valor * VALORES_2026.multaAtraso;
  const juros = valor * VALORES_2026.jurosAtrasoMes * (diasDeAtraso / 30);
  return centavos(multa + juros);
}

// ================================
// APOSENTADO
// ================================

// Quanto um empréstimo realmente custa.
//
// A propaganda mostra o valor da parcela ("só R$ 150 por mês"); esta
// conta mostra o total pago, quanto disso é juro e a taxa mensal
// embutida. A taxa é encontrada por tentativa: chuta-se uma taxa, vê se
// as parcelas pagariam exatamente o valor emprestado, e ajusta o chute
// (método da bissecção) até acertar.
function custoDoEmprestimo(valorRecebido, parcela, numeroParcelas) {
  const totalPago = centavos(parcela * numeroParcelas);
  const juros = centavos(totalPago - valorRecebido);

  // Valor presente das parcelas a uma taxa i: é o "preço hoje" delas.
  function valorPresente(i) {
    if (i === 0) return parcela * numeroParcelas;
    return (parcela * (1 - Math.pow(1 + i, -numeroParcelas))) / i;
  }

  let taxaMensal = 0;
  if (totalPago > valorRecebido) {
    let baixa = 0;
    let alta = 1; // 100% ao mês: nenhum empréstimo real passa disso
    for (let passo = 0; passo < 100; passo++) {
      const meio = (baixa + alta) / 2;
      if (valorPresente(meio) > valorRecebido) baixa = meio;
      else alta = meio;
    }
    taxaMensal = (baixa + alta) / 2;
  }

  return {
    totalPago,
    juros,
    taxaMensal, // 0.02 = 2% ao mês
    taxaAnual: Math.pow(1 + taxaMensal, 12) - 1,
  };
}

// No navegador `module` não existe e esta parte é ignorada.
// No Node, ela libera as funções para o arquivo de teste.
if (typeof module !== 'undefined') {
  module.exports = {
    VALORES_2026,
    descontoINSS,
    decimoTerceiro,
    parcelaSeguroDesemprego,
    parcelasSeguroDesemprego,
    mesesQueODinheiroDura,
    salarioSeguroAutonomo,
    limiteSemanal,
    situacaoDoLimite,
    diasAteVencimento,
    custoDoAtraso,
    custoDoEmprestimo,
  };
}
