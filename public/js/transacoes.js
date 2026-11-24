// Transações: a lista de tudo o que entrou e saiu, com filtros.
//
// O formulário de registrar não mora aqui: ele fica na casca (casca.js) e
// abre de qualquer tela. Esta tela só lista, filtra e marca pagamento.
//
// Os filtros ficam também no ENDEREÇO da página (?tipo=despesa&mes=2026-11).
// Assim o botão "voltar" do navegador funciona, e outras telas conseguem
// mandar a pessoa para cá com um filtro já escolhido, como o
// "Ver todas" das contas a pagar do Início (?situacao=pendente).

const el = (id) => document.getElementById(id);

let transacoes = [];
const abertas = new Set(); // ids das linhas com o detalhe aberto
const POR_VEZ = 60;
let quantasMostrar = POR_VEZ;

const dataDe = (t) => String(t.data_transacao).slice(0, 10);
const tituloDe = (t) => t.descricao || t.categoria.nome_categoria;

// ---- FILTROS ----

const filtros = {
  tipo: () => document.querySelector('[name="fTipo"]:checked').value,
  busca: () => el('fBusca').value.trim().toLowerCase(),
  situacao: () => el('fSituacao').value,
  mes: () => el('fMes').value,
  conta: () => el('fConta').value,
  categoria: () => el('fCategoria').value,
};

// Tira acentos e maiúsculas: procurar "agua" acha "Água".
const simples = (texto) => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function filtradas() {
  const f = Object.fromEntries(Object.entries(filtros).map(([nome, ler]) => [nome, ler()]));
  const busca = simples(f.busca);

  return transacoes.filter((t) => {
    if (f.tipo !== 'todos' && t.categoria.tipo !== f.tipo) return false;
    // "Pago / pendente / atrasado" só existe para gasto.
    if (f.situacao !== 'todos' && (t.categoria.tipo !== 'despesa' || statusTransacao(t) !== f.situacao)) return false;
    if (f.mes !== 'todos' && dataDe(t).slice(0, 7) !== f.mes) return false;
    if (f.conta !== 'todas' && t.conta.id_conta !== Number(f.conta)) return false;
    if (f.categoria !== 'todas' && t.categoria.id_categoria !== Number(f.categoria)) return false;
    if (busca && !simples(tituloDe(t) + ' ' + t.categoria.nome_categoria).includes(busca)) return false;
    return true;
  });
}

function haFiltro() {
  return (
    filtros.tipo() !== 'todos' || filtros.busca() || filtros.situacao() !== 'todos' ||
    filtros.mes() !== 'todos' || filtros.conta() !== 'todas' || filtros.categoria() !== 'todas'
  );
}

// Guarda os filtros no endereço, sem recarregar a página.
function filtrosNoEndereco() {
  const p = new URLSearchParams();
  if (filtros.tipo() !== 'todos') p.set('tipo', filtros.tipo());
  if (filtros.busca()) p.set('busca', el('fBusca').value.trim());
  if (filtros.situacao() !== 'todos') p.set('situacao', filtros.situacao());
  if (filtros.mes() !== 'todos') p.set('mes', filtros.mes());
  if (filtros.conta() !== 'todas') p.set('conta', filtros.conta());
  if (filtros.categoria() !== 'todas') p.set('categoria', filtros.categoria());
  const busca = p.toString();
  history.replaceState(null, '', location.pathname + (busca ? '?' + busca : ''));
}

// Lê os filtros do endereço ao abrir a tela. Um valor que não existe na
// lista é ignorado (o <select> simplesmente não muda).
function filtrosDoEndereco() {
  const p = new URLSearchParams(location.search);
  const tipo = document.querySelector(`[name="fTipo"][value="${p.get('tipo')}"]`);
  if (tipo) tipo.checked = true;
  if (p.get('busca')) el('fBusca').value = p.get('busca');
  ['situacao', 'mes', 'conta', 'categoria'].forEach((nome) => {
    const campo = el('f' + nome[0].toUpperCase() + nome.slice(1));
    const valor = p.get(nome);
    if (valor && [...campo.options].some((o) => o.value === valor)) campo.value = valor;
  });
}

function preencherOpcoes() {
  // Mantém o que estava escolhido quando a lista é refeita.
  const manter = (campo, opcoes, vazio) => {
    const atual = campo.value;
    campo.innerHTML = vazio + opcoes.join('');
    if ([...campo.options].some((o) => o.value === atual)) campo.value = atual;
  };

  const meses = [...new Set(transacoes.map((t) => dataDe(t).slice(0, 7)))].sort().reverse();
  manter(el('fMes'), meses.map((m) => `<option value="${m}">${nomeDoMes(m)}</option>`), '<option value="todos">Todos os meses</option>');

  const contas = new Map(transacoes.map((t) => [t.conta.id_conta, t.conta.nome]));
  manter(el('fConta'), [...contas].map(([id, nome]) => `<option value="${id}">${esc(nome)}</option>`), '<option value="todas">Todas</option>');

  // Só as categorias do tipo escolhido: quem filtra "Gastos" não vê "Salário".
  const categorias = new Map(
    transacoes
      .filter((t) => filtros.tipo() === 'todos' || t.categoria.tipo === filtros.tipo())
      .map((t) => [t.categoria.id_categoria, t.categoria.nome_categoria])
  );
  manter(
    el('fCategoria'),
    [...categorias].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([id, nome]) => `<option value="${id}">${esc(nome)}</option>`),
    '<option value="todas">Todas</option>'
  );

  // Ganho não tem "pago / pendente": o filtro de situação fica travado.
  el('fSituacao').disabled = filtros.tipo() === 'receita';
  if (el('fSituacao').disabled) el('fSituacao').value = 'todos';
}

// ---- DESENHO ----

function rotuloDoDia(iso) {
  const dias = diasAte(iso);
  const extenso = diaPorExtenso(iso) + (iso.slice(0, 4) !== hojeTexto().slice(0, 4) ? ' de ' + iso.slice(0, 4) : '');
  if (dias === 0) return `Hoje <small>${extenso}</small>`;
  if (dias === -1) return `Ontem <small>${extenso}</small>`;
  if (dias === 1) return `Amanhã <small>${extenso}</small>`;
  return extenso.replace(/^./, (l) => l.toUpperCase());
}

function fato(rotulo, valor) {
  return `<div><dt>${rotulo}</dt><dd>${valor}</dd></div>`;
}

function detalhe(t, situacao) {
  const ganho = t.categoria.tipo === 'receita';
  const importada = Boolean(t.conta.id_conexao);
  const deMeta = ehDinheiroGuardado(t);
  const fatos = [];

  if (ganho) {
    fatos.push(fato('Data', formatarData(t.data_transacao)));
    fatos.push(fato('Situação', situacao === 'previsto' ? `Previsto: entra no saldo em ${formatarData(t.data_transacao)}` : 'Recebido'));
  } else {
    fatos.push(fato('Vencimento', formatarData(t.data_transacao)));
    fatos.push(fato('Situação', situacao === 'pago' ? `Pago em ${formatarData(t.data_pagamento)}` : `${situacao === 'atrasado' ? 'Atrasado' : 'Pendente'}: ${textoPrazo(t.data_transacao)}`));
  }
  fatos.push(fato('Conta', esc(t.conta.nome)));
  fatos.push(fato('Categoria', esc(t.categoria.nome_categoria)));

  // O que dá para fazer com este gasto depende de onde ele veio.
  let acao = '';
  if (ganho) {
    acao = '';
  } else if (importada) {
    acao = '<p class="fraco pequeno"><i class="fa-solid fa-building-columns" aria-hidden="true"></i> Conta importada do banco: quem informa o pagamento é o banco.</p>';
  } else if (deMeta) {
    acao = '<p class="fraco pequeno"><i class="fa-solid fa-flag" aria-hidden="true"></i> Dinheiro guardado numa meta: já saiu da conta.</p>';
  } else if (ehTransferencia(t)) {
    acao = '<p class="fraco pequeno"><i class="fa-solid fa-right-left" aria-hidden="true"></i> Transferência entre as suas contas: o dinheiro já mudou de conta.</p>';
  } else if (situacao === 'pago') {
    acao = `<div><button type="button" class="botao botao--linha botao--p" data-pagar="${t.id_transacao}" data-pago="false"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Desmarcar pagamento</button></div>`;
  } else {
    acao = `<div><button type="button" class="botao botao--p" data-pagar="${t.id_transacao}" data-pago="true"><i class="fa-solid fa-check" aria-hidden="true"></i> Marcar como pago</button></div>`;
  }

  return `<dl class="mov__fatos">${fatos.join('')}</dl>${acao}`;
}

function linha(t) {
  const situacao = statusTransacao(t);
  const ganho = t.categoria.tipo === 'receita';
  const aberta = abertas.has(t.id_transacao);

  return `
    <li class="mov">
      <button type="button" class="mov__linha" data-abrir="${t.id_transacao}" aria-expanded="${aberta}" aria-controls="detalhe-${t.id_transacao}">
        ${iconeDaCategoria(t.categoria)}
        <span class="mov__texto">
          <strong>${esc(tituloDe(t))}</strong>
          <small>${esc(t.categoria.nome_categoria)} · ${esc(t.conta.nome)}</small>
        </span>
        <span class="mov__estado">${etiquetaDaSituacao(situacao)}</span>
        <span class="mov__valor ${ganho ? 'mov__valor--entrou' : ''}">${formatarMoeda(ganho ? t.valor_transacao : -t.valor_transacao, { sinal: true })}</span>
        <i class="fa-solid fa-chevron-down mov__seta" aria-hidden="true"></i>
      </button>
      <div class="mov__detalhe" id="detalhe-${t.id_transacao}" ${aberta ? '' : 'hidden'}>${detalhe(t, situacao)}</div>
    </li>`;
}

function desenhar() {
  const lista = el('lista');
  const todas = filtradas();
  const somar = (itens) => itens.reduce((total, t) => total + Number(t.valor_transacao), 0);

  el('limpar').hidden = !haFiltro();

  if (transacoes.length === 0) {
    el('contagem').textContent = '';
    el('somaEntrou').textContent = el('somaSaiu').textContent = '';
    el('mostrarMais').hidden = true;
    lista.innerHTML = `
      <div class="cartao vazio">
        <span class="icone icone--folha" aria-hidden="true"><i class="fa-solid fa-right-left"></i></span>
        <h2>Nada registrado ainda</h2>
        <p>Comece anotando um gasto ou um ganho. Leva menos de um minuto.</p>
        <button type="button" class="botao" data-registrar="despesa"><i class="fa-solid fa-plus" aria-hidden="true"></i> Registrar agora</button>
      </div>`;
    return;
  }

  el('contagem').textContent =
    todas.length === transacoes.length
      ? plural(transacoes.length, 'transação', 'transações')
      : `Mostrando ${todas.length} de ${plural(transacoes.length, 'transação', 'transações')}`;

  // As somas acompanham o filtro. Dinheiro guardado em meta não é gasto, e
  // transferência entre contas não é ganho nem gasto.
  const entrou = somar(todas.filter(ehGanho));
  const saiu = somar(todas.filter(ehGasto));
  el('somaEntrou').innerHTML = entrou ? `Entrou <strong class="numero verde">${formatarMoeda(entrou)}</strong>` : '';
  el('somaSaiu').innerHTML = saiu ? `Saiu <strong class="numero">${formatarMoeda(saiu)}</strong>` : '';

  if (todas.length === 0) {
    el('mostrarMais').hidden = true;
    lista.innerHTML = `
      <div class="cartao vazio">
        <span class="icone" aria-hidden="true"><i class="fa-solid fa-filter"></i></span>
        <h2>Nenhuma transação com esses filtros</h2>
        <p>Tente tirar um dos filtros, ou limpe todos de uma vez.</p>
        <button type="button" class="botao botao--linha" data-limpar>Limpar filtros</button>
      </div>`;
    return;
  }

  // Da mais nova para a mais antiga; no mesmo dia, a registrada por último primeiro.
  todas.sort((a, b) => (dataDe(a) !== dataDe(b) ? dataDe(b).localeCompare(dataDe(a)) : b.id_transacao - a.id_transacao));

  const visiveis = todas.slice(0, quantasMostrar);
  el('mostrarMais').hidden = todas.length <= quantasMostrar;

  // Um grupo por dia.
  const dias = new Map();
  visiveis.forEach((t) => {
    if (!dias.has(dataDe(t))) dias.set(dataDe(t), []);
    dias.get(dataDe(t)).push(t);
  });

  lista.innerHTML = [...dias]
    .map(([dia, doDia]) => `<h2 class="dia__titulo">${rotuloDoDia(dia)}</h2><ul class="movs">${doDia.map(linha).join('')}</ul>`)
    .join('');
}

// ---- AÇÕES ----

async function alterarPagamento(botao) {
  const id = Number(botao.dataset.pagar);
  const pago = botao.dataset.pago === 'true';
  const t = transacoes.find((x) => x.id_transacao === id);

  const soltar = ocupar(botao);
  const { ok, dados } = await chamarApi(`/api/transacao/${id}/pagamento`, { method: 'PATCH', body: JSON.stringify({ pago }) });

  if (!ok) {
    soltar();
    return avisar(dados.erro || 'Não foi possível atualizar o pagamento.', 'erro');
  }

  const valor = formatarMoeda(t.valor_transacao);
  avisar(
    pago
      ? `"${tituloDe(t)}" marcado como pago. ${valor} saíram de "${t.conta.nome}".`
      : `Pagamento de "${tituloDe(t)}" desmarcado. ${valor} voltaram para "${t.conta.nome}".`
  );
  anunciarMudanca();
}

function limparFiltros() {
  document.querySelector('[name="fTipo"][value="todos"]').checked = true;
  el('fBusca').value = '';
  ['fSituacao', 'fMes'].forEach((id) => (el(id).value = 'todos'));
  ['fConta', 'fCategoria'].forEach((id) => (el(id).value = 'todas'));
  aoFiltrar();
}

function aoFiltrar() {
  quantasMostrar = POR_VEZ;
  preencherOpcoes();
  filtrosNoEndereco();
  desenhar();
}

document.querySelectorAll('[name="fTipo"]').forEach((radio) => radio.addEventListener('change', aoFiltrar));
['fSituacao', 'fMes', 'fConta', 'fCategoria'].forEach((id) => el(id).addEventListener('change', aoFiltrar));
el('fBusca').addEventListener('input', aoFiltrar);
el('limpar').addEventListener('click', limparFiltros);
el('mostrarMais').addEventListener('click', () => {
  quantasMostrar += POR_VEZ;
  desenhar();
});

// Um ouvinte só para a lista inteira: as linhas são refeitas a cada filtro.
el('lista').addEventListener('click', (evento) => {
  const pagar = evento.target.closest('[data-pagar]');
  if (pagar) return alterarPagamento(pagar);

  if (evento.target.closest('[data-limpar]')) return limparFiltros();

  const abrir = evento.target.closest('[data-abrir]');
  if (abrir) {
    const id = Number(abrir.dataset.abrir);
    const detalheDaLinha = el('detalhe-' + id);
    const abrindo = detalheDaLinha.hidden;
    abrindo ? abertas.add(id) : abertas.delete(id);
    detalheDaLinha.hidden = !abrindo;
    abrir.setAttribute('aria-expanded', String(abrindo));
  }
});

// ---- BUSCAR ----

let primeiraVez = true;

async function carregar() {
  const { ok, dados } = await chamarApi(`/api/usuario/${ID_USUARIO}/transacao`);

  if (!ok) {
    avisar(dados.erro || 'Não foi possível carregar as transações.', 'erro');
    return;
  }

  transacoes = dados;
  preencherOpcoes();

  // Os filtros do endereço só podem ser lidos depois que as listas de mês,
  // conta e categoria existem.
  if (primeiraVez) {
    filtrosDoEndereco();
    preencherOpcoes();
    primeiraVez = false;
  }

  desenhar();
}

carregar();
document.addEventListener('verdanz:mudou', carregar);
