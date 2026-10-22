// Conteúdo da tela /meu-perfil: para cada perfil, o contexto brasileiro,
// as dicas e a meta sugerida.
//
// Só tem TEXTO e regras simples aqui. A conta pesada fica em
// perfil-calculos.js; o desenho da tela, em meu-perfil.js.
//
// Todos os números citados foram conferidos em 2026. A fonte de cada um
// está em Docs/Perfis/analise-funcionalidades-por-perfil.md — se for
// atualizar um valor, atualize lá também.

const CONTEUDO_PERFIS = {
  clt: {
    titulo: 'Ferramentas para quem tem carteira assinada',
    contexto:
      'Salário fixo dá previsibilidade, mas não impede o aperto: em 2026, cerca de 8 em cada 10 famílias ' +
      'brasileiras têm alguma dívida, e o cartão de crédito é a principal delas. O 13º é o maior dinheiro ' +
      'extra do ano — planejar antes de ele cair faz diferença.',
    dicas: [
      {
        icone: 'fa-calendar-days',
        titulo: 'O 13º vem em duas parcelas',
        texto:
          'A 1ª, até 30 de novembro, é metade do valor e não tem desconto. A 2ª, até 20 de dezembro, vem com ' +
          'o INSS e o Imposto de Renda do 13º inteiro — por isso é menor. Em 2026 o dia 20 cai num domingo.',
      },
      {
        icone: 'fa-file-invoice-dollar',
        titulo: 'Imposto de Renda mudou em 2026',
        texto:
          'Quem ganha até R$ 5.000 por mês ficou isento, e quem ganha até R$ 7.350 paga menos. ' +
          'Confira no seu holerite se o desconto diminuiu.',
      },
      {
        icone: 'fa-credit-card',
        titulo: 'Cuidado com o pagamento mínimo do cartão',
        texto:
          'O cartão é a dívida de mais de 80% das famílias endividadas. Pagar só o mínimo joga o resto ' +
          'para o rotativo, um dos juros mais caros do país.',
      },
      {
        icone: 'fa-landmark',
        titulo: 'Saque-aniversário do FGTS tem um custo',
        texto:
          'Quem adere a ele e é demitido sem justa causa não pode sacar o saldo do FGTS, só a multa de 40%. ' +
          'Pense nisso antes de usar o FGTS como dinheiro extra.',
      },
    ],
    meta: (d) => ({
      titulo: 'Reserva de emergência',
      valor: d.gastoMedioMensal * 6,
      meses: 12,
      porque: 'Seis meses dos seus gastos: o tempo médio para atravessar uma demissão ou um imprevisto grande.',
    }),
  },

  autonomo: {
    titulo: 'Ferramentas para quem trabalha por conta própria',
    contexto:
      'Quase 4 em cada 10 pessoas que trabalham no Brasil são informais (IBGE, 2026). Sem salário fixo, ' +
      'sem 13º e sem FGTS, o desafio é transformar uma renda que sobe e desce em um "salário" previsível — ' +
      'e não perder a proteção do INSS.',
    dicas: [
      {
        icone: 'fa-receipt',
        titulo: 'DAS do MEI em 2026',
        texto:
          'R$ 82,05 (comércio ou indústria), R$ 86,05 (serviços) ou R$ 87,05 (os dois), todo dia 20. ' +
          'É ele que garante aposentadoria, auxílio-doença e salário-maternidade.',
      },
      {
        icone: 'fa-chart-line',
        titulo: 'Limite do MEI: R$ 81 mil por ano',
        texto:
          'Dá em média R$ 6.750 por mês. Passar do limite obriga a mudar de categoria e pagar mais imposto — ' +
          'acompanhe quanto já entrou no ano.',
      },
      {
        icone: 'fa-store',
        titulo: 'Separe o dinheiro do negócio',
        texto:
          'Crie no Verdanz uma conta só para o trabalho, além da Carteira. Misturar as duas é o jeito mais ' +
          'rápido de não saber se o negócio dá lucro.',
      },
      {
        icone: 'fa-piggy-bank',
        titulo: 'Sua reserva precisa ser maior',
        texto:
          'Quem tem salário fixo costuma mirar 6 meses de gastos. Com renda variável, o ideal é de 6 a 12 meses.',
      },
    ],
    meta: (d) => ({
      titulo: 'Reserva para os meses fracos',
      valor: d.gastoMedioMensal * 6,
      meses: 18,
      porque: 'Seis meses dos seus gastos, juntando nos meses bons para cobrir os fracos.',
    }),
  },

  estudante: {
    titulo: 'Ferramentas para quem estuda',
    contexto:
      'Com mesada, bolsa ou estágio, o dinheiro costuma chegar uma vez por mês e acabar em pequenos gastos — ' +
      'lanche, delivery, assinaturas. Criar o hábito agora evita começar a vida profissional já endividado.',
    dicas: [
      {
        icone: 'fa-coins',
        titulo: 'Os pequenos gastos somam',
        texto:
          'R$ 15 de lanche três vezes por semana viram cerca de R$ 195 no mês. Registre tudo por uma semana e veja ' +
          'para onde o dinheiro vai.',
      },
      {
        icone: 'fa-graduation-cap',
        titulo: 'Pé-de-Meia (ensino médio público)',
        texto:
          'Para quem está no CadÚnico com renda de até meio salário mínimo por pessoa: R$ 200 na matrícula, ' +
          'R$ 1.800 por ano de frequência e R$ 1.000 por ano concluído, que fica guardado até o fim do ensino médio.',
      },
      {
        icone: 'fa-id-card',
        titulo: 'Direitos de quem faz estágio',
        texto:
          'No estágio não obrigatório, a bolsa e o auxílio-transporte são obrigatórios por lei. Depois de um ano, ' +
          'você tem 30 dias de recesso remunerado.',
      },
      {
        icone: 'fa-credit-card',
        titulo: 'Limite do cartão não é dinheiro seu',
        texto:
          'O primeiro cartão costuma vir com um limite maior que a renda. Use só para o que você já tem como pagar.',
      },
    ],
    meta: (d) => ({
      titulo: 'Guardar parte da mesada',
      valor: d.rendaMensalEstudante * 0.15 * 6,
      meses: 6,
      porque: 'Guardar 15% do que você recebe, por seis meses, para uma compra que você quer sem precisar parcelar.',
    }),
  },

  domestico: {
    titulo: 'Ferramentas para quem cuida das contas da casa',
    contexto:
      'Quem administra a casa lida com muitos vencimentos ao mesmo tempo. Uma conta esquecida custa multa e ' +
      'juros e, no caso da luz e da água, pode levar ao corte. Saber quanto sobra depois das contas fixas é o ' +
      'primeiro passo de qualquer orçamento familiar.',
    dicas: [
      {
        icone: 'fa-bolt',
        titulo: 'Tarifa Social de energia',
        texto:
          'Famílias do CadÚnico com renda de até meio salário mínimo por pessoa (R$ 810,50 em 2026) não pagam ' +
          'a energia até 80 kWh por mês. Desde 2026 existe também um desconto para renda de até 1 salário mínimo ' +
          'por pessoa. Confira com a sua distribuidora.',
      },
      {
        icone: 'fa-calendar-days',
        titulo: 'Escolha o dia de vencimento',
        texto:
          'Muitas empresas de luz, água e internet deixam trocar a data de vencimento. Coloque as contas logo ' +
          'depois do dia em que o dinheiro entra.',
      },
      {
        icone: 'fa-triangle-exclamation',
        titulo: 'Atraso custa caro',
        texto: 'Contas de consumo pagas com atraso cobram multa de até 2% mais juros de 1% ao mês.',
      },
      {
        icone: 'fa-users',
        titulo: 'Combine o orçamento com a família',
        texto:
          'Se alguém repassa um valor para as despesas, mostre a essa pessoa o total das contas fixas. Fica mais ' +
          'fácil combinar um repasse que cubra o mês inteiro.',
      },
    ],
    meta: (d) => ({
      titulo: 'Fundo de imprevistos da casa',
      valor: (d.totalContasFixas || d.gastoMedioMensal) * 3,
      meses: 6,
      porque: 'Três meses das contas da casa, para um conserto ou uma conta mais alta não virar dívida.',
    }),
  },

  desempregado: {
    titulo: 'Ferramentas para quem está buscando trabalho',
    contexto:
      'Perder a renda é o momento em que mais se precisa de clareza: quanto dinheiro existe, quanto ainda vai ' +
      'entrar e por quanto tempo ele dura. O seguro-desemprego e o FGTS ajudam, mas têm prazos e regras.',
    dicas: [
      {
        icone: 'fa-calendar-days',
        titulo: 'Prazo do seguro-desemprego',
        texto:
          'O pedido é feito de 7 a 120 dias depois da demissão, pela Carteira de Trabalho Digital ou pelo gov.br. ' +
          'Passou do prazo, perde o direito.',
      },
      {
        icone: 'fa-landmark',
        titulo: 'FGTS na demissão sem justa causa',
        texto:
          'Você saca o saldo mais a multa de 40%. Quem tinha aderido ao saque-aniversário só recebe a multa.',
      },
      {
        icone: 'fa-scissors',
        titulo: 'Corte primeiro o que não é essencial',
        texto:
          'Moradia, comida, contas de casa e transporte para entrevistas vêm antes de tudo. Lazer e compras são ' +
          'os primeiros a esperar, e cada real cortado faz o dinheiro durar mais.',
      },
      {
        icone: 'fa-triangle-exclamation',
        titulo: 'Evite empréstimo para pagar o dia a dia',
        texto:
          'Pegar dinheiro emprestado sem renda certa para pagar empurra o problema para frente com juros. ' +
          'Se já tem dívidas, procure os feirões de renegociação antes que elas cresçam.',
      },
    ],
    // Sem meta sugerida: agora o foco é fazer o dinheiro durar, não guardar.
    meta: null,
  },

  aposentado: {
    titulo: 'Ferramentas para quem é aposentado ou pensionista',
    contexto:
      'A renda é fixa, mas os gastos com saúde tendem a crescer. Aposentados também são o principal alvo de ' +
      'golpes e de ofertas de empréstimo consignado — saber quanto um empréstimo realmente custa é proteção.',
    dicas: [
      {
        icone: 'fa-phone-slash',
        titulo: 'O INSS não manda links nem liga oferecendo empréstimo',
        texto:
          'Mensagens por WhatsApp, SMS ou ligações "do INSS" com links ou ofertas são golpe. Nunca passe senha ' +
          'ou código recebido por mensagem.',
      },
      {
        icone: 'fa-user-lock',
        titulo: 'Seu benefício nasce bloqueado para empréstimo',
        texto:
          'Nenhum banco pode fazer consignado no seu benefício sem que você desbloqueie no Meu INSS. Se aparecer ' +
          'um desconto que você não pediu, reclame no 135.',
      },
      {
        icone: 'fa-calendar-days',
        titulo: 'Dia do pagamento',
        texto:
          'Depende do último número do benefício, antes do dígito. Confira o seu no aplicativo Meu INSS ou pelo 135.',
      },
      {
        icone: 'fa-pills',
        titulo: 'Remédios de graça na Farmácia Popular',
        texto:
          'Remédios para pressão alta, diabetes e asma saem de graça com receita médica. Veja na farmácia ' +
          'credenciada se os seus estão na lista.',
      },
    ],
    meta: (d) => ({
      titulo: 'Reserva para saúde',
      valor: d.gastoSaudeMedio > 0 ? d.gastoSaudeMedio * 12 : d.gastoMedioMensal * 2,
      meses: 12,
      porque:
        d.gastoSaudeMedio > 0
          ? 'Um ano dos seus gastos com saúde, para uma consulta ou exame fora do plano não pesar no mês.'
          : 'Dois meses dos seus gastos, separados para consultas, exames e remédios fora do previsto.',
    }),
  },
};
