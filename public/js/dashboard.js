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

// Os três valores em dinheiro dos cards do topo diminuem a letra quando
// não cabem (caberNaLargura, em auth.js).
function ajustarValoresDosCards() {
  [statSaldo, statReceitas, statDespesas].forEach((elemento) => caberNaLargura(elemento));
}

// A largura dos cards muda com a janela (e o menu lateral some no
// celular), então a conta é refeita a cada mudança de tamanho.
window.addEventListener('resize', ajustarValoresDosCards);

function mesmoMes(iso) {
  const hoje = new Date();
  const data = String(iso).slice(0, 7); // "2026-09"
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  return data === mesAtual;
}

// ---- CONTAS A PAGAR ----
//
// hojeTexto, diasAte e statusTransacao ficam em auth.js, porque a tela
// de Transações usa as mesmas regras.

// Uma conta está A PAGAR quando é um gasto ainda não pago — pendente
// (vence hoje ou depois) ou atrasado (a data já passou).
function aPagar(t) {
  const status = statusTransacao(t);
  return status === 'pendente' || status === 'atrasado';
}

function textoVencimento(iso) {
  const dias = diasAte(iso);
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === -1) return 'venceu ontem';
  return `venceu há ${-dias} dias`;
}

async function carregarResumo() {
  const id = Sessao.idUsuario();
  if (!id) return;

  // As chamadas são independentes, então vão juntas em vez de uma
  // esperar a outra.
  const [contas, transacoes, metas, limites] = await Promise.all([
    chamarApi('/api/usuario/' + id + '/conta'),
    chamarApi('/api/usuario/' + id + '/transacao'),
    chamarApi('/api/usuario/' + id + '/meta'),
    chamarApi('/api/usuario/' + id + '/limite'),
  ]);

  if (contas.ok) {
    const total = contas.dados.reduce((soma, c) => soma + Number(c.saldo), 0);
    const previsto = contas.dados.reduce((soma, c) => soma + Number(c.saldo_previsto), 0);
    statSaldo.textContent = formatarMoeda(total);

    // Saldo negativo em vermelho, para chamar a atenção.
    statSaldo.classList.toggle('text-red-600', total < 0);
    statSaldo.classList.toggle('text-gray-900', total >= 0);

    // Saldo previsto = quanto vai sobrar depois de pagar o que falta e
    // receber os ganhos já lançados (cálculo em src/saldo.js). Só aparece
    // quando é diferente do saldo de hoje.
    const legenda = statSaldo.nextElementSibling;
    if (legenda) {
      const quantas = `Em ${contas.dados.length} ${contas.dados.length === 1 ? 'conta' : 'contas'}`;
      legenda.textContent =
        contas.dados.length === 0
          ? 'Nenhuma conta cadastrada ainda'
          : previsto !== total
            ? `${quantas} · previsto ${formatarMoeda(previsto)}`
            : quantas;
    }
  }

  if (transacoes.ok) {
    const doMes = transacoes.dados.filter((t) => mesmoMes(t.data_transacao));

    // O tipo vem da categoria, nunca de um campo da transação.
    // Despesas = só gastos de verdade: o dinheiro guardado em metas fica de
    // fora (ehGasto, em auth.js), porque ele continua sendo da pessoa.
    const somar = (lista) => lista.reduce((total, t) => total + Number(t.valor_transacao), 0);

    statReceitas.textContent = formatarMoeda(somar(doMes.filter((t) => t.categoria.tipo === 'receita')));
    statDespesas.textContent = formatarMoeda(somar(doMes.filter(ehGasto)));

    // As despesas do mês incluem as que ainda não foram pagas.
    // A legenda deixa isso claro, para o número não parecer "já pago".
    const aPagarNoMes = doMes
      .filter(aPagar)
      .reduce((total, t) => total + Number(t.valor_transacao), 0);

    const legendaDespesas = statDespesas.nextElementSibling;
    if (legendaDespesas) {
      legendaDespesas.textContent =
        aPagarNoMes > 0 ? `Este mês · ${formatarMoeda(aPagarNoMes)} a pagar` : 'Este mês';
    }

    preencherPendentes(transacoes.dados);
    preencherGastosPorCategoria(doMes, limites.ok ? limites.dados : []);
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

  ajustarValoresDosCards();

  // A fonte Inter vem da internet e pode chegar depois: com ela, o texto
  // muda de largura, então a medida é refeita quando ela termina de carregar.
  document.fonts.ready.then(ajustarValoresDosCards);
}

function preencherPendentes(transacoes) {
  const bloco = document.getElementById('blocoPendentes');
  const lista = document.getElementById('pendentesLista');
  if (!bloco || !lista) return;

  // A API devolve da data mais nova para a mais antiga. Aqui importa o
  // que vence primeiro, então a ordem é a inversa: as atrasadas aparecem
  // primeiro, depois da mais próxima para a mais distante.
  const pendentes = transacoes
    .filter(aPagar)
    .sort((a, b) => String(a.data_transacao).localeCompare(String(b.data_transacao)));

  // Sem nada a pagar, o bloco continua escondido.
  if (pendentes.length === 0) {
    bloco.classList.add('hidden');
    return;
  }

  const total = pendentes.reduce((soma, t) => soma + Number(t.valor_transacao), 0);
  const atrasadas = pendentes.filter((t) => statusTransacao(t) === 'atrasado').length;
  const proxima = pendentes.find((t) => statusTransacao(t) === 'pendente');

  const partes = [pendentes.length === 1 ? '1 conta a pagar' : `${pendentes.length} contas a pagar`];
  if (atrasadas > 0) partes.push(atrasadas === 1 ? '1 atrasada' : `${atrasadas} atrasadas`);
  if (proxima) partes.push(`a próxima ${textoVencimento(proxima.data_transacao)}`);

  document.getElementById('pendentesTotal').textContent = formatarMoeda(total);
  document.getElementById('pendentesResumo').textContent = partes.join(' · ');

  // Mostra só as 3 primeiras, para o dashboard continuar um resumo.
  const LIMITE = 3;

  lista.innerHTML = pendentes
    .slice(0, LIMITE)
    .map((t) => {
      const titulo = t.descricao || t.categoria.nome_categoria;
      // Atrasada em vermelho, pendente em amarelo.
      const corPrazo = statusTransacao(t) === 'atrasado' ? 'text-red-600' : 'text-amber-600';

      return `
        <div class="flex justify-between items-center py-3">
          <div class="min-w-0">
            <p class="font-medium text-gray-800 text-sm truncate">${escapar(titulo)}</p>
            <p class="text-xs text-gray-400 truncate">${escapar(t.categoria.nome_categoria)} · ${escapar(t.conta.nome)}</p>
          </div>
          <div class="text-right flex-shrink-0 ml-3">
            <p class="font-medium text-gray-900 text-sm">− ${formatarMoeda(t.valor_transacao)}</p>
            <p class="text-xs ${corPrazo}">${formatarData(t.data_transacao)} · ${textoVencimento(t.data_transacao)}</p>
          </div>
        </div>`;
    })
    .join('');

  if (pendentes.length > LIMITE) {
    lista.innerHTML += `
      <a href="/transacoes" class="block pt-3 text-center text-blue-600 text-sm font-medium hover:underline">
        Ver todas as ${pendentes.length} contas a pagar
      </a>`;
  }

  bloco.classList.remove('hidden');
}

// Cor da barra de uma categoria com limite, pela situação que o servidor
// calculou (ver limiteController.js).
const COR_LIMITE = { ok: 'bg-green-500', atencao: 'bg-amber-500', estourado: 'bg-red-500' };
const TEXTO_LIMITE = { ok: 'text-gray-400', atencao: 'text-amber-600', estourado: 'text-red-600' };

function preencherGastosPorCategoria(transacoesDoMes, limites) {
  const caixa = document.getElementById('blocoCategorias');
  if (!caixa) return;

  // Dinheiro guardado em metas não é gasto e não entra aqui (ehGasto, em auth.js).
  const despesas = transacoesDoMes.filter(ehGasto);

  if (despesas.length === 0) return;

  prepararBloco(caixa);

  // Soma por categoria e ordena da maior para a menor. A chave é o id, e
  // não o nome: uma categoria personalizada pode ter o mesmo nome que a de
  // outra pessoa, e o id é o que liga a categoria ao limite dela.
  const porCategoria = new Map();
  despesas.forEach((t) => {
    const atual = porCategoria.get(t.categoria.id_categoria) || {
      id: t.categoria.id_categoria,
      nome: t.categoria.nome_categoria,
      valor: 0,
    };
    atual.valor += Number(t.valor_transacao);
    porCategoria.set(t.categoria.id_categoria, atual);
  });

  const total = [...porCategoria.values()].reduce((soma, c) => soma + c.valor, 0);
  const ordenadas = [...porCategoria.values()].sort((a, b) => b.valor - a.valor).slice(0, 5);
  const limitePorCategoria = new Map(limites.map((l) => [l.id_categoria, l]));

  // A categoria que mais gastou e ainda não tem limite ganha o botão
  // "Definir limite": é o caso "gastei muito em Lazer, quero gastar menos".
  const sugerida = ordenadas.find((c) => !limitePorCategoria.has(c.id));

  caixa.innerHTML = ordenadas
    .map((c) => {
      const limite = limitePorCategoria.get(c.id);

      // Com limite, a barra mede o quanto do LIMITE já foi usado, e a cor
      // segue a situação. Sem limite, mede a parte do total do mês.
      if (limite) {
        const pct = Math.round(limite.percentual);
        return `
          <div class="mb-3">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-600">${escapar(c.nome)}</span>
              <span class="text-gray-900 font-medium">${formatarMoeda(limite.gasto_mes)}
                <span class="text-gray-400 font-normal">/ ${formatarMoeda(limite.valor_limite)}</span>
              </span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-1.5">
              <div class="${COR_LIMITE[limite.situacao]} h-1.5 rounded-full" style="width: ${Math.min(100, pct)}%"></div>
            </div>
            <p class="text-[0.6875rem] mt-1 ${TEXTO_LIMITE[limite.situacao]}">${pct}% do limite do mês</p>
          </div>`;
      }

      const pct = Math.round((c.valor / total) * 100);
      const botaoLimite =
        c === sugerida
          ? `<a href="/metas?limite=${c.id}" class="text-[0.6875rem] text-blue-600 font-medium hover:underline">
               <i class="fa-solid fa-gauge-high mr-0.5"></i> Definir limite
             </a>`
          : '';

      return `
        <div class="mb-3">
          <div class="flex justify-between text-xs mb-1">
            <span class="text-gray-600">${escapar(c.nome)}</span>
            <span class="text-gray-900 font-medium">${formatarMoeda(c.valor)}</span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-1.5">
            <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${pct}%"></div>
          </div>
          ${botaoLimite}
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
      const status = statusTransacao(t);
      const titulo = t.descricao || t.categoria.nome_categoria;

      // O que ainda não aconteceu ganha ícone e etiqueta próprios, para
      // não parecer já pago (ou já recebido).
      const visual = {
        pago: { cor: 'bg-blue-50 text-blue-500', icone: 'fa-solid fa-arrow-down' },
        recebido: { cor: 'bg-green-50 text-green-500', icone: 'fa-solid fa-arrow-up' },
        pendente: { cor: 'bg-amber-50 text-amber-500', icone: 'fa-regular fa-clock', texto: 'Pendente', corTexto: 'bg-amber-50 text-amber-600' },
        atrasado: { cor: 'bg-red-50 text-red-500', icone: 'fa-solid fa-triangle-exclamation', texto: 'Atrasado', corTexto: 'bg-red-50 text-red-600' },
        previsto: { cor: 'bg-gray-100 text-gray-400', icone: 'fa-regular fa-calendar', texto: 'Previsto', corTexto: 'bg-gray-100 text-gray-500' },
      }[status];

      const corIcone = visual.cor;
      const icone = visual.icone;
      const etiqueta = visual.texto
        ? `<span class="inline-block px-2 py-0.5 mr-1 rounded-full font-medium ${visual.corTexto}">${visual.texto}</span>`
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
