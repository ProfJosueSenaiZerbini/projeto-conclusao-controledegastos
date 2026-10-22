// Tela de Transações: lista o que entrou e saiu, filtra a lista, marca
// gastos como pagos e registra novos lançamentos pelo painel lateral.

const listaTransacoes = document.getElementById('listaTransacoes');
const saldoTotal = document.getElementById('saldoTotal');
const saldoPrevisto = document.getElementById('saldoPrevisto');
const formTransacao = document.getElementById('formTransacao');
const salvarTransacao = document.getElementById('salvarTransacao');
const selectCategoria = document.getElementById('categoriaTransacao');
const selectConta = document.getElementById('contaTransacao');
const campoData = document.getElementById('dataTransacao');
const campoPago = document.getElementById('campoPago');
const caixaPago = document.getElementById('pagoTransacao');
const resumoConta = document.getElementById('resumoConta');
const resumoData = document.getElementById('resumoData');
const botaoDespesa = document.getElementById('botaoDespesa');
const botaoReceita = document.getElementById('botaoReceita');

const painel = criarPainel('painelTransacao', 'fundoPainel');
document.getElementById('fecharPainel').addEventListener('click', painel.fechar);

// Guardadas em memória para não pedir à API a cada filtro ou abertura.
let categorias = [];
let contas = [];
let transacoes = [];
let tipoSelecionado = 'despesa';

// Ids das transações abertas (expandidas). Ficam abertas mesmo quando a
// lista é desenhada de novo — ao filtrar ou depois de marcar como pago.
const abertas = new Set();

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function dataDe(t) {
  return String(t.data_transacao).slice(0, 10);
}

// A descrição é opcional: sem ela, o nome da categoria vira o título.
function tituloDe(t) {
  return t.descricao || t.categoria.nome_categoria;
}

// ---- AGRUPAMENTO POR DIA ----
//
// Em vez de uma tabela com coluna de data repetida em toda linha, as
// transações são agrupadas sob um título por dia. Menos repetição na
// tela e mais fácil de bater o olho.

function rotuloDoDia(iso) {
  const dias = diasAte(iso);

  if (dias === 0) return 'Hoje';
  if (dias === -1) return 'Ontem';
  if (dias === 1) return 'Amanhã';
  return formatarData(iso);
}

// ---- APARÊNCIA DE CADA STATUS ----
// Etiqueta, cores e ícone de cada situação (ver statusTransacao, em auth.js).

const ESTILO_STATUS = {
  pago: { etiqueta: '', fundo: 'bg-blue-50 text-blue-500', icone: 'fa-solid fa-arrow-down' },
  pendente: { etiqueta: 'Pendente', cor: 'bg-amber-50 text-amber-600', fundo: 'bg-amber-50 text-amber-500', icone: 'fa-regular fa-clock' },
  atrasado: { etiqueta: 'Atrasado', cor: 'bg-red-50 text-red-600', fundo: 'bg-red-50 text-red-500', icone: 'fa-solid fa-triangle-exclamation' },
  recebido: { etiqueta: '', fundo: 'bg-green-50 text-green-500', icone: 'fa-solid fa-arrow-up' },
  previsto: { etiqueta: 'Previsto', cor: 'bg-gray-100 text-gray-500', fundo: 'bg-gray-100 text-gray-400', icone: 'fa-regular fa-calendar' },
};

function etiquetaStatus(status) {
  const estilo = ESTILO_STATUS[status];
  if (!estilo.etiqueta) return '';
  return `<span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${estilo.cor}">${estilo.etiqueta}</span>`;
}

// "vence em 5 dias", "venceu há 3 dias"...
function textoPrazo(t) {
  const dias = diasAte(t.data_transacao);
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === -1) return 'venceu ontem';
  return `venceu há ${-dias} dias`;
}

// ---- LINHA DA TRANSAÇÃO (com a parte que expande) ----

function linhaTransacao(t) {
  const status = statusTransacao(t);
  const estilo = ESTILO_STATUS[status];
  const ehReceita = t.categoria.tipo === 'receita';
  const aberta = abertas.has(t.id_transacao);
  const idDetalhe = 'detalhe-' + t.id_transacao;

  const corValor = ehReceita ? 'text-green-600' : 'text-gray-900';
  const sinal = ehReceita ? '+' : '−';

  // O cabeçalho é um <button>: dá para abrir com o teclado (Tab + Enter),
  // e o aria-expanded avisa o leitor de tela se está aberto ou fechado.
  return `
    <div class="rounded-xl ${aberta ? 'bg-gray-50' : ''}">
      <button type="button" data-abrir="${t.id_transacao}" aria-expanded="${aberta}" aria-controls="${idDetalhe}"
              class="w-full flex justify-between items-center p-3 text-left hover:bg-gray-50 rounded-xl transition-colors">
        <span class="flex items-center gap-4 min-w-0">
          <span class="w-10 h-10 rounded-full ${estilo.fundo} flex items-center justify-center flex-shrink-0">
            <i class="${estilo.icone}"></i>
          </span>
          <span class="min-w-0">
            <span class="block font-medium text-gray-800 text-sm truncate">${escapar(tituloDe(t))}</span>
            <span class="block text-xs text-gray-400 truncate">${escapar(t.categoria.nome_categoria)} · ${escapar(t.conta.nome)}</span>
          </span>
        </span>
        <span class="flex items-center gap-3 flex-shrink-0 ml-3">
          <span class="text-right">
            <span class="block font-medium ${corValor} text-sm">${sinal} ${formatarMoeda(t.valor_transacao)}</span>
            ${etiquetaStatus(status)}
          </span>
          <i class="fa-solid fa-chevron-down text-xs text-gray-400 transition-transform ${aberta ? 'rotate-180' : ''}"></i>
        </span>
      </button>
      <div id="${idDetalhe}" class="${aberta ? '' : 'hidden'} px-4 pb-4 pt-1">
        ${detalheTransacao(t, status)}
      </div>
    </div>`;
}

function itemDetalhe(rotulo, valor) {
  return `
    <div>
      <dt class="text-xs text-gray-400">${rotulo}</dt>
      <dd class="text-sm text-gray-800 font-medium">${valor}</dd>
    </div>`;
}

function detalheTransacao(t, status) {
  const ehReceita = t.categoria.tipo === 'receita';
  const importada = Boolean(t.conta.id_conexao);
  const deMeta = t.categoria.nome_categoria === 'Metas';
  const itens = [];

  if (ehReceita) {
    itens.push(itemDetalhe('Data', formatarData(t.data_transacao)));
    itens.push(
      itemDetalhe(
        'Status',
        status === 'previsto' ? `Previsto · entra no saldo em ${formatarData(t.data_transacao)}` : 'Recebido'
      )
    );
  } else {
    itens.push(itemDetalhe('Vencimento', formatarData(t.data_transacao)));
    itens.push(
      itemDetalhe(
        'Status',
        status === 'pago'
          ? `Pago em ${formatarData(t.data_pagamento)}`
          : `${status === 'atrasado' ? 'Atrasado' : 'Pendente'} · ${textoPrazo(t)}`
      )
    );
  }

  itens.push(itemDetalhe('Conta', escapar(t.conta.nome)));
  itens.push(itemDetalhe('Categoria', escapar(t.categoria.nome_categoria)));

  // O botão só existe para gastos lançados à mão. Numa conta importada,
  // quem diz o que foi pago é o banco; um gasto de meta já sai pago.
  let acao = '';

  if (!ehReceita && importada) {
    acao = '<p class="text-xs text-gray-400"><i class="fa-solid fa-building-columns mr-1"></i> Conta importada do banco: o pagamento vem do banco.</p>';
  } else if (!ehReceita && deMeta) {
    acao = '<p class="text-xs text-gray-400"><i class="fa-solid fa-bullseye mr-1"></i> Dinheiro guardado numa meta: já saiu da conta.</p>';
  } else if (!ehReceita && status === 'pago') {
    acao = `
      <button type="button" data-pagar="${t.id_transacao}" data-pago="false"
              class="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium transition hover:bg-gray-100">
        <i class="fa-solid fa-rotate-left mr-1"></i> Desmarcar pagamento
      </button>`;
  } else if (!ehReceita) {
    acao = `
      <button type="button" data-pagar="${t.id_transacao}" data-pago="true"
              class="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold transition hover:bg-green-700">
        <i class="fa-solid fa-check mr-1"></i> Marcar como pago
      </button>`;
  }

  return `
    <dl class="grid grid-cols-2 gap-3 mb-3">${itens.join('')}</dl>
    ${acao}`;
}

// ---- FILTROS ----
//
// Os filtros trabalham sobre a lista que já está na memória: escolher um
// filtro não chama a API de novo. Para o tamanho de um TCC isso é o mais
// simples; com milhares de transações, o filtro iria para o servidor.

const filtroTipo = document.getElementById('filtroTipo');
const filtroStatus = document.getElementById('filtroStatus');
const filtroConta = document.getElementById('filtroConta');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroOrdem = document.getElementById('filtroOrdem');
const filtroNome = document.getElementById('filtroNome');
const filtroDia = document.getElementById('filtroDia');
const contagemFiltro = document.getElementById('contagemFiltro');

function transacoesFiltradas() {
  const tipo = filtroTipo.value;
  const status = filtroStatus.value;
  const conta = filtroConta.value;
  const categoria = filtroCategoria.value;
  const dia = filtroDia.value;

  const lista = transacoes.filter((t) => {
    if (tipo !== 'todos' && t.categoria.tipo !== tipo) return false;
    // Pago / pendente / atrasado só existem em gastos.
    if (status !== 'todos' && (t.categoria.tipo !== 'despesa' || statusTransacao(t) !== status)) return false;
    if (conta !== 'todas' && t.conta.id_conta !== Number(conta)) return false;
    if (categoria !== 'todas' && t.categoria.id_categoria !== Number(categoria)) return false;
    if (dia && dataDe(t) !== dia) return false;
    return true;
  });

  // ORDEM: a data decide a ordem dos dias (mais recentes ou mais
  // antigas). Dentro de um mesmo dia, A-Z / Z-A ordena pelo nome. É assim
  // que A-Z combina com os outros filtros sem desmanchar o agrupamento
  // por dia. localeCompare em 'pt-BR' põe "Água" junto do "A", e não
  // depois do "Z".
  const recentes = filtroOrdem.value === 'recentes';
  const nome = filtroNome.value;

  return lista.sort((a, b) => {
    if (dataDe(a) !== dataDe(b)) {
      return (dataDe(a) < dataDe(b) ? -1 : 1) * (recentes ? -1 : 1);
    }

    if (nome !== 'padrao') {
      const comparacao = tituloDe(a).localeCompare(tituloDe(b), 'pt-BR', { sensitivity: 'base' });
      if (comparacao !== 0) return nome === 'az' ? comparacao : -comparacao;
    }

    return recentes ? b.id_transacao - a.id_transacao : a.id_transacao - b.id_transacao;
  });
}

// Categorias do filtro acompanham o tipo: escolhendo "Ganhos", só
// aparecem categorias de ganho.
function preencherFiltroCategoria() {
  const atual = filtroCategoria.value;
  const lista = categorias.filter((c) => filtroTipo.value === 'todos' || c.tipo === filtroTipo.value);

  filtroCategoria.innerHTML =
    '<option value="todas">Todas</option>' +
    lista.map((c) => `<option value="${c.id_categoria}">${escapar(c.nome_categoria)}</option>`).join('');

  // Se a categoria escolhida não existe no tipo novo, volta para "Todas".
  filtroCategoria.value = lista.some((c) => String(c.id_categoria) === atual) ? atual : 'todas';
}

function preencherFiltroConta() {
  const atual = filtroConta.value;

  filtroConta.innerHTML =
    '<option value="todas">Todas</option>' +
    contas.map((c) => `<option value="${c.id_conta}">${escapar(c.nome)}</option>`).join('');

  filtroConta.value = contas.some((c) => String(c.id_conta) === atual) ? atual : 'todas';
}

filtroTipo.addEventListener('change', () => {
  // Status é coisa de gasto: com "Ganhos", o filtro de status não se aplica.
  filtroStatus.disabled = filtroTipo.value === 'receita';
  if (filtroStatus.disabled) filtroStatus.value = 'todos';

  preencherFiltroCategoria();
  desenharLista();
});

[filtroStatus, filtroConta, filtroCategoria, filtroOrdem, filtroNome, filtroDia].forEach((campo) =>
  campo.addEventListener('change', desenharLista)
);

function limparFiltros() {
  filtroTipo.value = 'todos';
  filtroStatus.value = 'todos';
  filtroStatus.disabled = false;
  filtroConta.value = 'todas';
  filtroOrdem.value = 'recentes';
  filtroNome.value = 'padrao';
  filtroDia.value = '';
  preencherFiltroCategoria();
  filtroCategoria.value = 'todas';
  desenharLista();
}

document.getElementById('limparFiltros').addEventListener('click', limparFiltros);

// ---- DESENHAR A LISTA ----

const listaVazia = `
  <div class="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center gap-2 py-16">
    <i class="fa-solid fa-receipt text-3xl text-gray-300"></i>
    <p class="text-sm text-gray-400">Nenhuma transação registrada ainda</p>
  </div>`;

const semResultado = `
  <div class="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center gap-2 py-16">
    <i class="fa-solid fa-filter text-3xl text-gray-300"></i>
    <p class="text-sm text-gray-400">Nenhuma transação com esses filtros</p>
    <button type="button" data-limpar class="mt-2 text-sm text-blue-600 font-medium hover:underline">Limpar filtros</button>
  </div>`;

function desenharLista() {
  if (transacoes.length === 0) {
    listaTransacoes.innerHTML = listaVazia;
    contagemFiltro.textContent = '';
    return;
  }

  const lista = transacoesFiltradas();

  contagemFiltro.textContent =
    lista.length === transacoes.length
      ? `${transacoes.length} ${transacoes.length === 1 ? 'transação' : 'transações'}`
      : `Mostrando ${lista.length} de ${transacoes.length} transações`;

  if (lista.length === 0) {
    listaTransacoes.innerHTML = semResultado;
    return;
  }

  // Agrupa mantendo a ordem que a lista já tem.
  const grupos = new Map();
  lista.forEach((t) => {
    const rotulo = rotuloDoDia(t.data_transacao);
    if (!grupos.has(rotulo)) grupos.set(rotulo, []);
    grupos.get(rotulo).push(t);
  });

  let html = '';
  grupos.forEach((doDia, rotulo) => {
    html += `
      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-6 first:mt-0">${rotulo}</p>
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-1">
        ${doDia.map(linhaTransacao).join('')}
      </div>`;
  });

  listaTransacoes.innerHTML = html;
}

// Um único "ouvinte" de clique na lista inteira, em vez de um por linha:
// a lista é redesenhada o tempo todo, e assim nada precisa ser religado.
listaTransacoes.addEventListener('click', (evento) => {
  const botaoPagar = evento.target.closest('[data-pagar]');
  if (botaoPagar) {
    alterarPagamento(Number(botaoPagar.dataset.pagar), botaoPagar.dataset.pago === 'true', botaoPagar);
    return;
  }

  if (evento.target.closest('[data-limpar]')) {
    limparFiltros();
    return;
  }

  const botaoAbrir = evento.target.closest('[data-abrir]');
  if (botaoAbrir) {
    const id = Number(botaoAbrir.dataset.abrir);
    if (abertas.has(id)) abertas.delete(id);
    else abertas.add(id);
    desenharLista();
  }
});

async function carregarTransacoes() {
  const { ok, dados } = await chamarApi('/api/usuario/' + Sessao.idUsuario() + '/transacao');

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível carregar as transações.', 'erro');
    return;
  }

  transacoes = dados;
  desenharLista();
}

// ---- MARCAR COMO PAGO ----

async function alterarPagamento(id, pago, botao) {
  const t = transacoes.find((x) => x.id_transacao === id);
  botao.disabled = true;

  const { ok, dados } = await chamarApi(`/api/transacao/${id}/pagamento`, {
    method: 'PATCH',
    body: JSON.stringify({ pago }),
  });

  if (!ok) {
    botao.disabled = false;
    mostrarMensagem(dados.erro || 'Não foi possível atualizar o pagamento.', 'erro');
    return;
  }

  // Conta o que aconteceu com o saldo, para o número não mudar sem explicação.
  const valor = formatarMoeda(t.valor_transacao);
  mostrarMensagem(
    pago
      ? `"${tituloDe(t)}" marcado como pago. ${valor} saíram da conta "${t.conta.nome}".`
      : `Pagamento de "${tituloDe(t)}" desmarcado. ${valor} voltaram para a conta "${t.conta.nome}".`,
    'sucesso'
  );

  // O saldo mudou: recarrega a lista e as contas.
  carregarTransacoes();
  carregarContas();
}

// ---- CONTAS E CATEGORIAS ----

async function carregarContas() {
  const { ok, dados } = await chamarApi('/api/usuario/' + Sessao.idUsuario() + '/conta');

  if (!ok) return;

  contas = dados;

  const total = contas.reduce((soma, c) => soma + Number(c.saldo), 0);
  const previsto = contas.reduce((soma, c) => soma + Number(c.saldo_previsto), 0);
  saldoTotal.textContent = formatarMoeda(total);
  saldoTotal.classList.toggle('text-red-600', total < 0);
  saldoTotal.classList.toggle('text-gray-900', total >= 0);

  // O previsto só aparece quando é diferente: com tudo pago e nenhum
  // ganho futuro, os dois números são iguais.
  saldoPrevisto.textContent = previsto !== total ? `Previsto: ${formatarMoeda(previsto)}` : '';

  // Contas importadas do banco recebem transações só pela sincronização,
  // então não aparecem para lançamento manual. Elas continuam somando no
  // saldo total acima.
  selectConta.innerHTML = contas
    .filter((c) => !c.id_conexao)
    .map((c) => `<option value="${c.id_conta}">${escapar(c.nome)}</option>`)
    .join('');

  preencherFiltroConta();
  atualizarResumo();
}

async function carregarCategorias() {
  const { ok, dados } = await chamarApi('/api/categoria');
  if (ok) categorias = dados;
  preencherCategorias();
  preencherFiltroCategoria();
}

// Mostra só as categorias do tipo escolhido. Quem está lançando um gasto
// não precisa ver "Salário" na lista.
//
// "Metas" também fica de fora: ela é lançada só pelo "Adicionar valor" da
// tela de Metas, que soma o valor na meta junto (o servidor recusa à mão).
function preencherCategorias() {
  const doTipo = categorias.filter((c) => c.tipo === tipoSelecionado && c.nome_categoria !== 'Metas');

  selectCategoria.innerHTML = doTipo
    .map((c) => `<option value="${c.id_categoria}">${escapar(c.nome_categoria)}</option>`)
    .join('');
}

// Atualiza o texto recolhido do <details>, para dar a informação sem
// obrigar a abrir: "Nubank · hoje".
function atualizarResumo() {
  const conta = contas.find((c) => c.id_conta === Number(selectConta.value));
  const data = campoData.value;

  // textContent (e não innerHTML) escapa sozinho e preserva os elementos.
  resumoConta.textContent = conta ? conta.nome : 'Conta';
  resumoData.textContent = !data || data === hojeTexto() ? 'hoje' : formatarData(data);
}

// "Já está pago" vem marcado para data de hoje ou de antes, e desmarcado
// para data futura. A pessoa pode trocar depois de escolher a data.
function sugerirPago() {
  caixaPago.checked = !campoData.value || campoData.value <= hojeTexto();
}

// ---- ALTERNÂNCIA GASTO / GANHO ----

function selecionarTipo(tipo) {
  tipoSelecionado = tipo;

  const ativoDespesa = tipo === 'despesa';

  botaoDespesa.className = ativoDespesa
    ? 'py-3 rounded-xl border-2 border-red-500 bg-red-50 text-red-600 font-semibold transition'
    : 'py-3 rounded-xl border-2 border-gray-200 text-gray-500 font-semibold transition hover:border-gray-300';

  botaoReceita.className = ativoDespesa
    ? 'py-3 rounded-xl border-2 border-gray-200 text-gray-500 font-semibold transition hover:border-gray-300'
    : 'py-3 rounded-xl border-2 border-green-500 bg-green-50 text-green-600 font-semibold transition';

  // Ganho não tem "pago": ele entra no saldo no dia dele.
  campoPago.classList.toggle('hidden', !ativoDespesa);

  preencherCategorias();
}

botaoDespesa.addEventListener('click', () => selecionarTipo('despesa'));
botaoReceita.addEventListener('click', () => selecionarTipo('receita'));
selectConta.addEventListener('change', atualizarResumo);
campoData.addEventListener('change', () => {
  atualizarResumo();
  sugerirPago();
});

// ---- ABRIR O PAINEL ----

document.getElementById('novaTransacao').addEventListener('click', function () {
  if (selectConta.options.length === 0) {
    mostrarMensagem('Crie uma conta antes de registrar transações.', 'erro');
    return;
  }

  formTransacao.reset();
  campoData.value = hojeTexto();
  selecionarTipo('despesa');
  sugerirPago();
  atualizarResumo();
  painel.abrir();
});

// ---- SALVAR ----
//
// Não existe mais a checagem de "saldo insuficiente": o dinheiro das
// contas manuais é informado pela própria pessoa, e o saldo pode ficar
// negativo.

formTransacao.addEventListener('submit', async function (evento) {
  evento.preventDefault();
  esconderMensagem();

  const valor = Number(document.getElementById('valorTransacao').value);

  if (!Number.isFinite(valor) || valor <= 0) {
    mostrarMensagem('Informe um valor maior que zero.', 'erro');
    return;
  }

  const corpo = {
    valor_transacao: valor,
    data_transacao: campoData.value,
    descricao: document.getElementById('descricaoTransacao').value,
    id_categoria: Number(selectCategoria.value),
    id_conta: Number(selectConta.value),
  };

  if (tipoSelecionado === 'despesa') {
    corpo.pago = caixaPago.checked;
  }

  salvarTransacao.disabled = true;

  const { ok, dados } = await chamarApi('/api/transacao', {
    method: 'POST',
    body: JSON.stringify(corpo),
  });

  salvarTransacao.disabled = false;

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível registrar a transação.', 'erro');
    return;
  }

  painel.fechar();

  // Recarrega os dois: a lista ganhou uma linha e o saldo pode ter mudado.
  carregarTransacoes();
  carregarContas();
});

carregarContas();
carregarCategorias();
carregarTransacoes();
