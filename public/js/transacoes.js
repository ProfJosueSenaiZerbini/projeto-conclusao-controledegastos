// Tela de Transações: lista o que entrou e saiu, e registra novos
// lançamentos pelo painel lateral.

const listaTransacoes = document.getElementById('listaTransacoes');
const saldoTotal = document.getElementById('saldoTotal');
const formTransacao = document.getElementById('formTransacao');
const salvarTransacao = document.getElementById('salvarTransacao');
const selectCategoria = document.getElementById('categoriaTransacao');
const selectConta = document.getElementById('contaTransacao');
const resumoConta = document.getElementById('resumoConta');
const resumoData = document.getElementById('resumoData');
const botaoDespesa = document.getElementById('botaoDespesa');
const botaoReceita = document.getElementById('botaoReceita');

const painel = criarPainel('painelTransacao', 'fundoPainel');
document.getElementById('fecharPainel').addEventListener('click', painel.fechar);

// Guardadas em memória para não pedir à API a cada abertura do painel.
let categorias = [];
let contas = [];
let tipoSelecionado = 'despesa';

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// ---- AGRUPAMENTO POR DIA ----
//
// Em vez de uma tabela com coluna de data repetida em toda linha, as
// transações são agrupadas sob um título por dia. Menos repetição na
// tela e mais fácil de bater o olho.

function rotuloDoDia(iso) {
  const data = String(iso).slice(0, 10);

  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  const paraTexto = (d) => d.toISOString().slice(0, 10);

  if (data === paraTexto(hoje)) return 'Hoje';
  if (data === paraTexto(ontem)) return 'Ontem';
  return formatarData(iso);
}

function linhaTransacao(t) {
  const ehReceita = t.categoria.tipo === 'receita';
  const sinal = ehReceita ? '+' : '−';
  const cor = ehReceita ? 'text-green-600' : 'text-gray-900';
  const fundo = ehReceita ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500';
  const icone = ehReceita ? 'fa-arrow-up' : 'fa-arrow-down';

  // A descrição é opcional: sem ela, o nome da categoria vira o título.
  const titulo = t.descricao || t.categoria.nome_categoria;

  return `
    <div class="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors">
      <div class="flex items-center gap-4 min-w-0">
        <div class="w-10 h-10 rounded-full ${fundo} flex items-center justify-center flex-shrink-0">
          <i class="fa-solid ${icone}"></i>
        </div>
        <div class="min-w-0">
          <p class="font-medium text-gray-800 text-sm truncate">${escapar(titulo)}</p>
          <p class="text-xs text-gray-400 truncate">${escapar(t.categoria.nome_categoria)} · ${escapar(t.conta.nome)}</p>
        </div>
      </div>
      <p class="font-medium ${cor} text-sm flex-shrink-0 ml-3">${sinal} ${formatarMoeda(t.valor_transacao)}</p>
    </div>`;
}

const listaVazia = `
  <div class="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center gap-2 py-16">
    <i class="fa-solid fa-receipt text-3xl text-gray-300"></i>
    <p class="text-sm text-gray-400">Nenhuma transação registrada ainda</p>
  </div>`;

async function carregarTransacoes() {
  const { ok, dados } = await chamarApi('/api/usuario/' + Sessao.idUsuario() + '/transacao');

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível carregar as transações.', 'erro');
    return;
  }

  if (dados.length === 0) {
    listaTransacoes.innerHTML = listaVazia;
    return;
  }

  // Agrupa mantendo a ordem que a API já devolveu (mais recente primeiro).
  const grupos = new Map();
  dados.forEach((t) => {
    const rotulo = rotuloDoDia(t.data_transacao);
    if (!grupos.has(rotulo)) grupos.set(rotulo, []);
    grupos.get(rotulo).push(t);
  });

  let html = '';
  grupos.forEach((transacoes, rotulo) => {
    html += `
      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-6 first:mt-0">${rotulo}</p>
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-1">
        ${transacoes.map(linhaTransacao).join('')}
      </div>`;
  });

  listaTransacoes.innerHTML = html;
}

async function carregarContas() {
  const { ok, dados } = await chamarApi('/api/usuario/' + Sessao.idUsuario() + '/conta');

  if (!ok) return;

  contas = dados;

  const total = contas.reduce((soma, c) => soma + Number(c.saldo), 0);
  saldoTotal.textContent = formatarMoeda(total);

  selectConta.innerHTML = contas
    .map((c) => `<option value="${c.id_conta}">${escapar(c.nome)}</option>`)
    .join('');

  atualizarResumo();
}

async function carregarCategorias() {
  const { ok, dados } = await chamarApi('/api/categoria');
  if (ok) categorias = dados;
  preencherCategorias();
}

// Mostra só as categorias do tipo escolhido. Quem está lançando um gasto
// não precisa ver "Salário" na lista.
function preencherCategorias() {
  const doTipo = categorias.filter((c) => c.tipo === tipoSelecionado);

  selectCategoria.innerHTML = doTipo
    .map((c) => `<option value="${c.id_categoria}">${escapar(c.nome_categoria)}</option>`)
    .join('');
}

// Atualiza o texto recolhido do <details>, para dar a informação sem
// obrigar a abrir: "Nubank · hoje".
function atualizarResumo() {
  const conta = contas.find((c) => c.id_conta === Number(selectConta.value));
  const data = document.getElementById('dataTransacao').value;
  const hoje = new Date().toISOString().slice(0, 10);

  // textContent (e não innerHTML) escapa sozinho e preserva os elementos.
  resumoConta.textContent = conta ? conta.nome : 'Conta';
  resumoData.textContent = !data || data === hoje ? 'hoje' : formatarData(data);
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

  preencherCategorias();
}

botaoDespesa.addEventListener('click', () => selecionarTipo('despesa'));
botaoReceita.addEventListener('click', () => selecionarTipo('receita'));
selectConta.addEventListener('change', atualizarResumo);
document.getElementById('dataTransacao').addEventListener('change', atualizarResumo);

// ---- ABRIR O PAINEL ----

document.getElementById('novaTransacao').addEventListener('click', function () {
  if (contas.length === 0) {
    mostrarMensagem('Crie uma conta antes de registrar transações.', 'erro');
    return;
  }

  formTransacao.reset();
  document.getElementById('dataTransacao').value = new Date().toISOString().slice(0, 10);
  selecionarTipo('despesa');
  atualizarResumo();
  painel.abrir();
});

// ---- SALVAR ----

formTransacao.addEventListener('submit', async function (evento) {
  evento.preventDefault();
  esconderMensagem();

  const valor = Number(document.getElementById('valorTransacao').value);

  if (!Number.isFinite(valor) || valor <= 0) {
    mostrarMensagem('Informe um valor maior que zero.', 'erro');
    return;
  }

  salvarTransacao.disabled = true;

  const { ok, dados } = await chamarApi('/api/transacao', {
    method: 'POST',
    body: JSON.stringify({
      valor_transacao: valor,
      data_transacao: document.getElementById('dataTransacao').value,
      descricao: document.getElementById('descricaoTransacao').value,
      id_categoria: Number(selectCategoria.value),
      id_conta: Number(selectConta.value),
    }),
  });

  salvarTransacao.disabled = false;

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível registrar a transação.', 'erro');
    return;
  }

  painel.fechar();

  // Recarrega os dois: a lista ganhou uma linha e o saldo mudou.
  carregarTransacoes();
  carregarContas();
});

carregarContas();
carregarCategorias();
carregarTransacoes();
