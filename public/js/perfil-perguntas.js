// Dados da pesquisa de perfil: os 6 perfis, as perguntas e a regra
// que transforma as respostas em sugestão.
//
// Fica separado de perfil.js de propósito: aqui só tem CONTEÚDO.
// Para trocar o texto de uma pergunta ou o peso de uma resposta,
// mexe-se só neste arquivo, sem risco de quebrar o fluxo da tela.

// ---- OS 6 PERFIS ----
// A chave (clt, autonomo...) é o que o sistema guarda. O resto é texto
// para a tela. Ícones do Font Awesome, os mesmos usados no dashboard.

const PERFIS = {
  clt: {
    nome: 'CLT',
    resumo: 'Trabalhador de carteira assinada',
    descricao: 'Salário fixo todo mês. Foco em entender para onde o dinheiro vai e guardar uma parte com disciplina.',
    icone: 'fa-briefcase',
  },
  autonomo: {
    nome: 'Autônomo',
    resumo: 'Trabalha por conta própria',
    descricao: 'Renda que muda de mês para mês. Foco em separar o pessoal do trabalho e criar reserva para os meses fracos.',
    icone: 'fa-laptop',
  },
  estudante: {
    nome: 'Estudante',
    resumo: 'Focado nos estudos e no futuro',
    descricao: 'Mesada, bolsa ou estágio. Foco em controlar os pequenos gastos e não estourar o orçamento.',
    icone: 'fa-graduation-cap',
  },
  domestico: {
    nome: 'Doméstico',
    resumo: 'Cuida das despesas do lar',
    descricao: 'Responsável pelas contas da casa e da família. Foco em pagar tudo em dia e saber quanto sobra no mês.',
    icone: 'fa-house',
  },
  desempregado: {
    nome: 'Desempregado',
    resumo: 'Buscando novas oportunidades',
    descricao: 'Renda pequena ou incerta no momento. Foco em fazer o dinheiro durar e saber até quando ele dura.',
    icone: 'fa-magnifying-glass',
  },
  aposentado: {
    nome: 'Aposentado',
    resumo: 'Aproveitando uma nova fase',
    descricao: 'Renda fixa de aposentadoria ou pensão. Foco em fazer o dinheiro render o mês inteiro, sem sustos.',
    icone: 'fa-umbrella-beach',
  },
};

// ---- AS PERGUNTAS ----
//
// As perguntas vêm ANTES da escolha do perfil, então todas foram pensadas
// para os 6 perfis ao mesmo tempo: em quase todas existe pelo menos uma
// alternativa "com a cara" de cada perfil.
//
// Como funciona a pontuação: cada alternativa dá pontos para um ou mais
// perfis. No fim, soma-se tudo e os perfis com mais pontos são sugeridos.
//
// Os pesos:
//   4 = situação que a própria pessoa marcou na pergunta 2
//   3 = resposta que praticamente define o perfil
//   2 = forte indício
//   1 = indício leve, ajuda a desempatar
//
// Por que dá para sugerir de 1 a 3 perfis: a vida real mistura perfis
// (quem estuda e trabalha de carteira assinada, a aposentada que cuida
// da casa, o desempregado que faz bicos). A pergunta 2 é de múltipla
// escolha justamente para captar essa mistura, com peso 4. Quem marca
// "Nenhuma destas" ali acaba recebendo um perfil só.
//
// `multipla: true` deixa marcar várias alternativas. A alternativa com
// `exclusiva: true` ("Nenhuma destas") desmarca as outras.
//
// Cada pergunta e cada alternativa têm um ícone (Font Awesome) e um
// texto de apoio, no mesmo formato da tela Perguntas.html.

const PERGUNTAS = [
  {
    icone: 'fa-user',
    texto: 'Qual frase mais combina com o seu dia a dia hoje?',
    ajuda: 'Escolha a que descreve sua ocupação principal. As outras situações você marca na próxima pergunta.',
    alternativas: [
      { icone: 'fa-briefcase', texto: 'Trabalho de carteira assinada', sub: 'Tenho um emprego registrado em uma empresa.', pontos: { clt: 3 } },
      { icone: 'fa-laptop', texto: 'Trabalho por conta própria', sub: 'Freelancer, MEI, prestador de serviço ou vendas.', pontos: { autonomo: 3 } },
      { icone: 'fa-graduation-cap', texto: 'Estudo', sub: 'Escola, faculdade ou curso técnico.', pontos: { estudante: 3 } },
      { icone: 'fa-house', texto: 'Cuido da casa e da família', sub: 'Organizo as despesas do lar.', pontos: { domestico: 3 } },
      { icone: 'fa-magnifying-glass', texto: 'Estou procurando trabalho', sub: 'Sem emprego fixo no momento.', pontos: { desempregado: 3 } },
      { icone: 'fa-umbrella-beach', texto: 'Sou aposentado(a) ou pensionista', sub: 'Já encerrei minha vida de trabalho.', pontos: { aposentado: 3 } },
    ],
  },
  {
    icone: 'fa-layer-group',
    texto: 'Quais destas situações também fazem parte da sua vida?',
    ajuda: 'Pode marcar mais de uma. É aqui que descobrimos se mais de um perfil combina com você.',
    multipla: true,
    alternativas: [
      { icone: 'fa-book', texto: 'Estou estudando', sub: 'Escola, faculdade ou curso.', pontos: { estudante: 4 } },
      { icone: 'fa-id-card', texto: 'Tenho carteira assinada', sub: 'Mesmo que não seja minha atividade principal.', pontos: { clt: 4 } },
      { icone: 'fa-screwdriver-wrench', texto: 'Faço bicos ou trabalhos por fora', sub: 'Freelas, vendas ou serviços avulsos.', pontos: { autonomo: 4 } },
      { icone: 'fa-file-invoice', texto: 'Sou responsável pelas contas da casa', sub: 'Luz, água, aluguel e mercado passam por mim.', pontos: { domestico: 4 } },
      { icone: 'fa-magnifying-glass-dollar', texto: 'Estou procurando um (novo) emprego', sub: 'Enviando currículos ou fazendo entrevistas.', pontos: { desempregado: 4 } },
      { icone: 'fa-hand-holding-heart', texto: 'Recebo aposentadoria ou pensão', sub: 'INSS, previdência ou pensão.', pontos: { aposentado: 4 } },
      { icone: 'fa-ban', texto: 'Nenhuma destas', sub: 'Só a resposta anterior me descreve.', pontos: {}, exclusiva: true },
    ],
  },
  {
    icone: 'fa-wallet',
    texto: 'De onde vem a maior parte do dinheiro que você usa?',
    ajuda: 'Pense no dinheiro que paga a maior parte das suas despesas.',
    alternativas: [
      { icone: 'fa-building', texto: 'Salário de uma empresa', sub: 'Cai na conta todo mês.', pontos: { clt: 3 } },
      { icone: 'fa-handshake', texto: 'Clientes ou vendas', sub: 'Recebo por serviço feito ou produto vendido.', pontos: { autonomo: 3 } },
      { icone: 'fa-piggy-bank', texto: 'Mesada, bolsa ou estágio', sub: 'Valor que recebo enquanto estudo.', pontos: { estudante: 3 } },
      { icone: 'fa-people-roof', texto: 'Repasse de alguém da família', sub: 'Recebo um valor para cuidar das despesas da casa.', pontos: { domestico: 3 } },
      { icone: 'fa-landmark', texto: 'Aposentadoria ou pensão', sub: 'Benefício do INSS ou previdência.', pontos: { aposentado: 3 } },
      { icone: 'fa-coins', texto: 'Seguro-desemprego, reservas ou bicos', sub: 'O que guardei ou o que aparece de vez em quando.', pontos: { desempregado: 3 } },
    ],
  },
  {
    icone: 'fa-calendar-days',
    texto: 'Como é a entrada de dinheiro ao longo do mês?',
    ajuda: 'Escolha a opção que mais se parece com os últimos meses.',
    alternativas: [
      { icone: 'fa-calendar-check', texto: 'Sempre no mesmo dia e no mesmo valor', sub: 'Já sei quanto e quando vou receber.', pontos: { clt: 1, aposentado: 1 } },
      { icone: 'fa-chart-line', texto: 'Varia bastante', sub: 'Tem mês bom e mês fraco, em dias diferentes.', pontos: { autonomo: 2 } },
      { icone: 'fa-hand-holding-dollar', texto: 'Depende de quando a família repassa', sub: 'O valor chega por outra pessoa.', pontos: { estudante: 1, domestico: 1 } },
      { icone: 'fa-hourglass-half', texto: 'Não tenho entrada certa agora', sub: 'Só entra dinheiro de vez em quando.', pontos: { desempregado: 2 } },
    ],
  },
  {
    icone: 'fa-circle-exclamation',
    texto: 'Qual é a sua maior preocupação com dinheiro hoje?',
    ajuda: 'Escolha a que mais tira o seu sono.',
    alternativas: [
      { icone: 'fa-ghost', texto: 'O dinheiro some antes do fim do mês', sub: 'Recebo, mas não sei para onde ele vai.', pontos: { clt: 2 } },
      { icone: 'fa-cloud-rain', texto: 'Guardar para os meses fracos', sub: 'Quando entra pouco, fico apertado.', pontos: { autonomo: 2 } },
      { icone: 'fa-file-invoice-dollar', texto: 'Pagar as contas da casa em dia', sub: 'Não quero esquecer nenhum vencimento.', pontos: { domestico: 2 } },
      { icone: 'fa-hourglass-end', texto: 'Fazer o dinheiro durar', sub: 'Até eu conseguir uma renda certa.', pontos: { desempregado: 2 } },
      { icone: 'fa-pills', texto: 'Ter reserva para saúde e remédios', sub: 'Evitar sustos com gastos médicos.', pontos: { aposentado: 2 } },
      { icone: 'fa-mug-hot', texto: 'Parar de gastar em pequenas compras', sub: 'Lanche aqui, assinatura ali, e o dinheiro acaba.', pontos: { estudante: 2 } },
    ],
  },
  {
    icone: 'fa-utensils',
    texto: 'Para onde vai a maior parte do seu dinheiro?',
    ajuda: 'Escolha o tipo de gasto que mais pesa no seu mês.',
    alternativas: [
      { icone: 'fa-house-chimney', texto: 'Contas da casa e mercado', sub: 'Luz, água, aluguel e compras do mês.', pontos: { domestico: 2, aposentado: 1 } },
      { icone: 'fa-heart-pulse', texto: 'Saúde e medicamentos', sub: 'Consultas, remédios e plano de saúde.', pontos: { aposentado: 2 } },
      { icone: 'fa-gamepad', texto: 'Lanches, lazer e assinaturas', sub: 'Saídas, streaming e compras por impulso.', pontos: { estudante: 2, clt: 1 } },
      { icone: 'fa-bus', texto: 'Transporte e alimentação do trabalho', sub: 'O custo de ir e voltar todo dia.', pontos: { clt: 2 } },
      { icone: 'fa-toolbox', texto: 'Materiais e custos do meu trabalho', sub: 'Ferramentas, internet, estoque ou impostos.', pontos: { autonomo: 2 } },
      { icone: 'fa-basket-shopping', texto: 'Só o essencial para me manter', sub: 'Corto tudo o que não é necessário.', pontos: { desempregado: 2 } },
    ],
  },
  {
    icone: 'fa-bullseye',
    texto: 'O que você mais quer alcançar com o Verdanz?',
    ajuda: 'Isso também nos ajuda a sugerir metas para você depois.',
    alternativas: [
      { icone: 'fa-shield-halved', texto: 'Montar uma reserva de emergência', sub: 'Guardar um pouco todo mês.', pontos: { clt: 2 } },
      { icone: 'fa-scale-balanced', texto: 'Separar o pessoal do trabalho', sub: 'Saber o que é meu e o que é do negócio.', pontos: { autonomo: 2 } },
      { icone: 'fa-people-group', texto: 'Organizar o orçamento da família', sub: 'Saber quanto sobra depois das contas.', pontos: { domestico: 2 } },
      { icone: 'fa-stopwatch', texto: 'Saber quanto tempo meu dinheiro dura', sub: 'Planejar até a próxima renda.', pontos: { desempregado: 2 } },
      { icone: 'fa-seedling', texto: 'Aprender a controlar meus gastos', sub: 'Criar o hábito desde já.', pontos: { estudante: 2 } },
      { icone: 'fa-mug-saucer', texto: 'Ter tranquilidade no fim do mês', sub: 'Pagar tudo sem sustos.', pontos: { aposentado: 2 } },
    ],
  },
];

// ---- REGRAS DA SUGESTÃO ----
// As mesmas regras valem para a sugestão e para a escolha do usuário:
// pelo menos 1 perfil, no máximo 3.
const MINIMO_PERFIS = 1;
const MAXIMO_PERFIS = 3;

// Um perfil só é sugerido se tiver pelo menos 25% dos pontos do primeiro
// colocado. Sem esse corte, um perfil que ganhou 1 ou 2 pontinhos numa
// pergunta qualquer apareceria ao lado de um que ganhou 14 — e a sugestão
// perderia o sentido. O valor foi escolhido testando as 6 personas:
// marcar uma situação na pergunta 2 (4 pontos) passa do corte; pontinhos
// soltos (1 ou 2) não passam.
const CORTE_SUGESTAO = 0.25;

// Soma os pontos de cada perfil.
// Recebe as respostas no formato { indiceDaPergunta: [indicesDasAlternativas] }.
function calcularPlacar(respostas) {
  // Começa todo mundo com zero pontos.
  const placar = {};
  Object.keys(PERFIS).forEach((chave) => (placar[chave] = 0));

  PERGUNTAS.forEach((pergunta, indicePergunta) => {
    const marcadas = respostas[indicePergunta] || [];

    marcadas.forEach((indiceAlternativa) => {
      const pontos = pergunta.alternativas[indiceAlternativa].pontos;
      Object.entries(pontos).forEach(([perfil, valor]) => (placar[perfil] += valor));
    });
  });

  return placar;
}

// Devolve as chaves dos perfis sugeridos, do mais forte para o mais fraco.
// Sempre de 1 a 3 perfis (desde que a pessoa tenha respondido algo).
function calcularSugestao(respostas) {
  const placar = calcularPlacar(respostas);

  // Ordena do maior para o menor placar. Em caso de empate, vale a ordem
  // da lista PERFIS — o sort do JavaScript mantém a ordem original.
  const ordenados = Object.keys(placar)
    .filter((chave) => placar[chave] > 0)
    .sort((a, b) => placar[b] - placar[a]);

  if (ordenados.length === 0) return [];

  const maiorPlacar = placar[ordenados[0]];

  // O primeiro colocado sempre entra (garante o mínimo de 1).
  // Os outros só entram se passarem do corte, até o limite de 3.
  return ordenados
    .filter((chave, posicao) => posicao < MINIMO_PERFIS || placar[chave] >= maiorPlacar * CORTE_SUGESTAO)
    .slice(0, MAXIMO_PERFIS);
}

// Permite testar a regra de sugestão pelo Node (node teste.js) sem abrir
// o navegador. No navegador `module` não existe e esta parte é ignorada.
if (typeof module !== 'undefined') {
  module.exports = { PERFIS, PERGUNTAS, MINIMO_PERFIS, MAXIMO_PERFIS, calcularPlacar, calcularSugestao };
}
