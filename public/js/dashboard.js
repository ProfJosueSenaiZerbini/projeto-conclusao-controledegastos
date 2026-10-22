// Dashboard: o resumo. Lê as mesmas APIs das outras telas e mostra
// os números somados.
//
// A sessão, o nome do usuário, o menu de perfil e o botão sair ficam
// em layout.js, que é carregado antes deste arquivo em todas as telas
// de dentro do sistema.

const statSaldo = document.getElementById('statSaldo');
const statReceitas = document.getElementById('statReceitas');
const statDespesas = document.getElementById('statDespesas');
const statMetas = document.getElementById('statMetas');

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// Os blocos nascem com classes que centralizam o ícone e o texto do
// estado vazio. Ao receber conteúdo real, essas classes precisam sair —
// senão o conteúdo fica espremido no meio do cartão.
function prepararBloco(caixa) {
  caixa.className = 'flex-1';
  caixa.innerHTML = '';
}

function mesmoMes(iso) {
  const hoje = new Date();
  const data = String(iso).slice(0, 7); // "2026-09"
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  return data === mesAtual;
}

// ---- CONTAS PENDENTES ----

// A data de hoje no formato "2026-10-22", no fuso do navegador.
// Não usamos toISOString() de propósito: ele converte para UTC, e
// depois das 21h no Brasil já devolveria o dia seguinte.
function hojeTexto() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${hoje.getFullYear()}-${mes}-${dia}`;
}

// Uma conta está PENDENTE quando é um gasto com data depois de hoje.
//
// Isso é calculado na hora, e não guardado numa coluna "status" no
// banco: o "pendente" depende só da data da transação e do dia de hoje.
// Uma coluna ficaria errada sozinha quando a data chegasse, e seria uma
// dependência transitiva — o mesmo motivo que tirou tipo_transacao da
// tabela (3FN).
//
// Datas no formato "AAAA-MM-DD" podem ser comparadas como texto:
// "2026-10-30" > "2026-10-22" dá o mesmo resultado que comparar datas.
function ehPendente(t) {
  return t.categoria.tipo === 'despesa' && String(t.data_transacao).slice(0, 10) > hojeTexto();
}

// Quantos dias faltam até a data. Date.UTC nos dois lados deixa a conta
// livre de fuso e de horário de verão: só os dias importam.
function diasAte(iso) {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
  const [anoHoje, mesHoje, diaHoje] = hojeTexto().split('-').map(Number);
  const umDia = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(ano, mes - 1, dia) - Date.UTC(anoHoje, mesHoje - 1, diaHoje)) / umDia);
}

function textoVencimento(iso) {
  const dias = diasAte(iso);
  return dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`;
}

async function carregarResumo() {
  const id = Sessao.idUsuario();
  if (!id) return;

  // As três chamadas são independentes, então vão juntas em vez de
  // uma esperar a outra.
  const [contas, transacoes, metas] = await Promise.all([
    chamarApi('/api/usuario/' + id + '/conta'),
    chamarApi('/api/usuario/' + id + '/transacao'),
    chamarApi('/api/usuario/' + id + '/meta'),
  ]);

  if (contas.ok) {
    const total = contas.dados.reduce((soma, c) => soma + Number(c.saldo), 0);
    statSaldo.textContent = formatarMoeda(total);

    const legenda = statSaldo.nextElementSibling;
    if (legenda) {
      legenda.textContent =
        contas.dados.length === 0
          ? 'Nenhuma conta cadastrada ainda'
          : `Em ${contas.dados.length} ${contas.dados.length === 1 ? 'conta' : 'contas'}`;
    }
  }

  if (transacoes.ok) {
    const doMes = transacoes.dados.filter((t) => mesmoMes(t.data_transacao));

    // O tipo vem da categoria, nunca de um campo da transação.
    const soma = (tipo) =>
      doMes
        .filter((t) => t.categoria.tipo === tipo)
        .reduce((total, t) => total + Number(t.valor_transacao), 0);

    statReceitas.textContent = formatarMoeda(soma('receita'));
    statDespesas.textContent = formatarMoeda(soma('despesa'));

    // As despesas do mês incluem as que ainda vão vencer neste mês.
    // A legenda deixa isso claro, para o número não parecer "já pago".
    const aVencerNoMes = doMes
      .filter(ehPendente)
      .reduce((total, t) => total + Number(t.valor_transacao), 0);

    const legendaDespesas = statDespesas.nextElementSibling;
    if (legendaDespesas) {
      legendaDespesas.textContent =
        aVencerNoMes > 0 ? `Este mês · ${formatarMoeda(aVencerNoMes)} a vencer` : 'Este mês';
    }

    preencherPendentes(transacoes.dados);
    preencherGastosPorCategoria(doMes);
    preencherUltimasTransacoes(transacoes.dados);
  }

  if (metas.ok) {
    const ativas = metas.dados.filter((m) => m.status === 'em_progresso');
    statMetas.textContent = ativas.length;

    const legenda = statMetas.nextElementSibling;
    if (legenda) {
      legenda.textContent = ativas.length === 0 ? 'Nenhuma meta criada' : 'Em andamento';
    }

    preencherMetas(ativas);
  }
}

function preencherPendentes(transacoes) {
  const bloco = document.getElementById('blocoPendentes');
  const lista = document.getElementById('pendentesLista');
  if (!bloco || !lista) return;

  // A API devolve da data mais nova para a mais antiga. Aqui importa o
  // que vence primeiro, então a ordem é a inversa: da mais próxima
  // para a mais distante.
  const pendentes = transacoes
    .filter(ehPendente)
    .sort((a, b) => String(a.data_transacao).localeCompare(String(b.data_transacao)));

  // Sem nada pendente, o bloco continua escondido.
  if (pendentes.length === 0) {
    bloco.classList.add('hidden');
    return;
  }

  const total = pendentes.reduce((soma, t) => soma + Number(t.valor_transacao), 0);
  const quantidade = pendentes.length === 1 ? '1 conta a pagar' : `${pendentes.length} contas a pagar`;

  document.getElementById('pendentesTotal').textContent = formatarMoeda(total);
  document.getElementById('pendentesResumo').textContent =
    `${quantidade} · a próxima ${textoVencimento(pendentes[0].data_transacao)}`;

  // Mostra só as 3 mais próximas, para o dashboard continuar um resumo.
  const LIMITE = 3;

  lista.innerHTML = pendentes
    .slice(0, LIMITE)
    .map((t) => {
      const titulo = t.descricao || t.categoria.nome_categoria;

      return `
        <div class="flex justify-between items-center py-3">
          <div class="min-w-0">
            <p class="font-medium text-gray-800 text-sm truncate">${escapar(titulo)}</p>
            <p class="text-xs text-gray-400 truncate">${escapar(t.categoria.nome_categoria)} · ${escapar(t.conta.nome)}</p>
          </div>
          <div class="text-right flex-shrink-0 ml-3">
            <p class="font-medium text-gray-900 text-sm">− ${formatarMoeda(t.valor_transacao)}</p>
            <p class="text-xs text-amber-600">${formatarData(t.data_transacao)} · ${textoVencimento(t.data_transacao)}</p>
          </div>
        </div>`;
    })
    .join('');

  if (pendentes.length > LIMITE) {
    lista.innerHTML += `
      <a href="/transacoes" class="block pt-3 text-center text-blue-600 text-sm font-medium hover:underline">
        Ver todas as ${pendentes.length} contas pendentes
      </a>`;
  }

  bloco.classList.remove('hidden');
}

function preencherGastosPorCategoria(transacoesDoMes) {
  const caixa = document.getElementById('blocoCategorias');
  if (!caixa) return;

  const despesas = transacoesDoMes.filter((t) => t.categoria.tipo === 'despesa');

  if (despesas.length === 0) return;

  prepararBloco(caixa);

  // Soma por categoria e ordena da maior para a menor.
  const porCategoria = new Map();
  despesas.forEach((t) => {
    const nome = t.categoria.nome_categoria;
    porCategoria.set(nome, (porCategoria.get(nome) || 0) + Number(t.valor_transacao));
  });

  const total = [...porCategoria.values()].reduce((a, b) => a + b, 0);
  const ordenadas = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  caixa.innerHTML = ordenadas
    .map(([nome, valor]) => {
      const pct = Math.round((valor / total) * 100);
      return `
        <div class="mb-3">
          <div class="flex justify-between text-xs mb-1">
            <span class="text-gray-600">${escapar(nome)}</span>
            <span class="text-gray-900 font-medium">${formatarMoeda(valor)}</span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-1.5">
            <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${pct}%"></div>
          </div>
        </div>`;
    })
    .join('');
}

function preencherMetas(metas) {
  const caixa = document.getElementById('blocoMetas');
  if (!caixa || metas.length === 0) return;

  prepararBloco(caixa);

  caixa.innerHTML = metas
    .slice(0, 3)
    .map((m) => {
      const pct = Math.round(m.progresso);
      return `
        <div class="mb-4">
          <div class="flex justify-between items-end mb-2">
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">${escapar(m.titulo)}</p>
              <p class="text-xs text-gray-500 mt-1">
                <span class="font-bold text-gray-900">${formatarMoeda(m.valor_atual)}</span>
                / ${formatarMoeda(m.valor_alvo)}
              </p>
            </div>
            <span class="text-sm font-bold text-blue-600 flex-shrink-0 ml-3">${pct}%</span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-1.5">
            <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${Math.min(100, pct)}%"></div>
          </div>
        </div>`;
    })
    .join('');
}

function preencherUltimasTransacoes(transacoes) {
  const caixa = document.getElementById('blocoTransacoes');
  if (!caixa || transacoes.length === 0) return;

  prepararBloco(caixa);

  caixa.innerHTML = transacoes
    .slice(0, 4)
    .map((t) => {
      const ehReceita = t.categoria.tipo === 'receita';
      const pendente = ehPendente(t);
      const titulo = t.descricao || t.categoria.nome_categoria;

      // Gasto pendente ganha relógio e etiqueta, para não parecer já pago.
      let corIcone = ehReceita ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500';
      let icone = ehReceita ? 'fa-solid fa-arrow-up' : 'fa-solid fa-arrow-down';
      if (pendente) {
        corIcone = 'bg-amber-50 text-amber-500';
        icone = 'fa-regular fa-clock';
      }

      const etiqueta = pendente
        ? '<span class="inline-block px-2 py-0.5 mr-1 rounded-full bg-amber-50 text-amber-600 font-medium">Pendente</span>'
        : '';

      return `
        <div class="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors">
          <div class="flex items-center gap-4 min-w-0">
            <div class="w-10 h-10 rounded-full ${corIcone} flex items-center justify-center flex-shrink-0">
              <i class="${icone}"></i>
            </div>
            <div class="min-w-0">
              <p class="font-medium text-gray-800 text-sm truncate">${escapar(titulo)}</p>
              <p class="text-xs text-gray-400 truncate">${escapar(t.categoria.nome_categoria)}</p>
            </div>
          </div>
          <div class="text-right flex-shrink-0 ml-3">
            <p class="font-medium ${ehReceita ? 'text-green-600' : 'text-gray-900'} text-sm">
              ${ehReceita ? '+' : '−'} ${formatarMoeda(t.valor_transacao)}
            </p>
            <p class="text-xs text-gray-400">${etiqueta}${formatarData(t.data_transacao)}</p>
          </div>
        </div>`;
    })
    .join('');
}

carregarResumo();
