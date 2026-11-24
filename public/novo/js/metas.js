// Metas: os dois jeitos de cuidar do dinheiro.
//
//   JUNTAR DINHEIRO (Meta)       -> cumpre quando o valor guardado CHEGA no alvo
//   GASTAR MENOS (limite mensal) -> cumpre quando o gasto fica ABAIXO do teto
//
// São coisas diferentes no banco de dados também (Meta e LimiteCategoria),
// e por isso ficam em seções separadas da tela.
//
// Regras do servidor que a tela respeita:
//   - guardar dinheiro tira o valor de uma CONTA manual e cria uma
//     transação "Metas" (o histórico continua explicando o saldo);
//   - guardar exige saldo de hoje: é mover dinheiro que existe;
//   - excluir a meta não devolve o dinheiro para a conta.

const el = (id) => document.getElementById(id);

let metas = [];
let limites = [];
let contasManuais = [];
let categoriasDeGasto = [];
let gastoDoMes = new Map(); // id da categoria -> gasto no mês

const textoDaConta = (c) => `${c.nome} · ${formatarMoeda(c.saldo)}`;

// ---- O PLANO: QUANTO GUARDAR POR MÊS ----
//
// A conta fica em calcularPlanoMeta (/js/meta-calculos.js), que tem teste
// próprio. O resultado não é gravado: muda a cada dia e a cada valor guardado.

function textoDoPlano(valorAlvo, valorAtual, dataLimite) {
  const plano = calcularPlanoMeta(valorAlvo, valorAtual, dataLimite, hojeTexto());
  if (plano.falta === 0) return '';

  const dias = diasAte(dataLimite);
  const falta = formatarMoeda(plano.falta);

  if (dias < 0) return recado('perigo', `O prazo já passou e ainda faltam <strong>${falta}</strong>.`);
  if (dias === 0) return recado('atencao', `O prazo termina hoje e ainda faltam <strong>${falta}</strong>.`);
  // Menos de 1 mês: não dá para dividir em parcelas mensais.
  if (plano.porMes === null) return recado('atencao', `Faltam <strong>${falta}</strong> em ${plural(dias, 'dia', 'dias')}.`);

  const porAno = plano.porAno === null ? '' : ` (${formatarMoeda(plano.porAno)} por ano)`;
  return recado('ok', `Guarde <strong>${formatarMoeda(plano.porMes)} por mês</strong>${porAno}, durante ${plural(plano.meses, 'mês', 'meses')}, e você chega lá.`);
}

// ---- METAS ----

function cartaoDaMeta(meta) {
  const pct = Math.min(100, Math.round(meta.progresso));
  const chegou = pct >= 100 || meta.status === 'concluida';
  const ativa = meta.status === 'em_progresso' && !chegou;

  // Os marcos de 25%, 50% e 75% do caminho.
  const marcos = [25, 50, 75]
    .map((m) => `<span class="trilha__marco ${pct >= m ? 'trilha__marco--passou' : ''}" style="left:${m}%"></span>`)
    .join('');

  return `
    <article class="cartao meta">
      <div class="meta__topo">
        <div>
          <h3>${esc(meta.titulo)}</h3>
          <p class="suave pequeno">${chegou ? 'Meta alcançada' : 'Até ' + formatarData(meta.data_limite)}</p>
        </div>
        <button type="button" class="botao-icone" data-excluir-meta="${meta.id_meta}" aria-label="Excluir a meta ${esc(meta.titulo)}" title="Excluir"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
      </div>

      <div class="meta__valores">
        <span class="numero">${formatarMoeda(meta.valor_atual)}</span>
        <span class="suave">de ${formatarMoeda(meta.valor_alvo)}</span>
      </div>

      <div class="trilha ${chegou ? 'trilha--chegou' : ''}" role="img" aria-label="${pct}% do caminho">
        <span class="trilha__feito" style="width:${pct}%"></span>
        ${marcos}
        <span class="trilha__bandeira"><i class="fa-solid fa-flag" aria-hidden="true"></i></span>
      </div>
      <p class="trilha__voce"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${chegou ? 'Você chegou!' : `Você está aqui: ${pct}% do caminho`}</p>

      ${ativa ? textoDoPlano(meta.valor_alvo, meta.valor_atual, meta.data_limite) : ''}
      ${ativa ? `<button type="button" class="botao botao--linha" data-guardar="${meta.id_meta}"><i class="fa-solid fa-plus" aria-hidden="true"></i> Guardar dinheiro</button>` : ''}
    </article>`;
}

function desenharMetas() {
  el('listaMetas').innerHTML =
    metas.map(cartaoDaMeta).join('') +
    `<button type="button" class="novo" data-nova-meta>
       <span class="icone" aria-hidden="true"><i class="fa-solid fa-plus"></i></span>
       Nova meta
     </button>`;
}

function abrirNovaMeta() {
  el('formMeta').reset();
  ['tituloMeta', 'valorMeta', 'prazoMeta', 'valorInicialMeta'].forEach((id) => erroNoCampo(el(id), ''));
  el('planoMeta').innerHTML = '';

  const semConta = contasManuais.length === 0;
  el('contaMeta').innerHTML = semConta
    ? '<option>Nenhuma conta disponível</option>'
    : contasManuais.map((c) => `<option value="${c.id_conta}">${esc(textoDaConta(c))}</option>`).join('');
  el('contaMeta').disabled = el('valorInicialMeta').disabled = semConta;

  abrirJanela(el('folhaMeta'));
  el('tituloMeta').focus();
}

// O plano aparece enquanto a pessoa preenche.
el('formMeta').addEventListener('input', () => {
  const valor = lerValor(el('valorMeta'));
  const prazo = el('prazoMeta').value;
  const inicial = lerValor(el('valorInicialMeta'));

  if (!valor || !prazo) el('planoMeta').innerHTML = '';
  else if (diasAte(prazo) <= 0) el('planoMeta').innerHTML = recado('atencao', 'Escolha uma data no futuro.');
  else el('planoMeta').innerHTML = textoDoPlano(valor, inicial, prazo);
});

el('formMeta').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const titulo = el('tituloMeta').value.trim();
  const valor = lerValor(el('valorMeta'));
  const prazo = el('prazoMeta').value;
  const textoInicial = el('valorInicialMeta').value.trim();
  const inicial = lerValor(el('valorInicialMeta'));

  // Confere os campos de cima para baixo e para no primeiro problema.
  const problemas = [
    [el('tituloMeta'), titulo ? '' : 'Dê um nome para a meta.'],
    [el('valorMeta'), valor ? '' : 'Digite quanto custa, como 1.500,00.'],
    [el('prazoMeta'), !prazo ? 'Escolha uma data.' : diasAte(prazo) <= 0 ? 'Escolha uma data no futuro.' : ''],
    [el('valorInicialMeta'), textoInicial && !inicial && !/^[0.,\s]+$/.test(textoInicial) ? 'Use só números, como 100,00.' : inicial > valor ? 'Não pode ser maior que o valor da meta.' : ''],
  ];
  problemas.forEach(([campo, mensagem]) => erroNoCampo(campo, mensagem));
  const primeiro = problemas.find(([, mensagem]) => mensagem);
  if (primeiro) return primeiro[0].focus();

  const corpo = { titulo, valor_alvo: valor, data_limite: prazo };
  let conta = null;

  if (inicial > 0) {
    conta = contasManuais.find((c) => c.id_conta === Number(el('contaMeta').value));
    if (!conta) return avisar('Escolha de qual conta o valor vai sair.', 'erro');
    if (inicial > Number(conta.saldo)) return saldoInsuficiente(conta, inicial);
    corpo.valor_inicial = inicial;
    corpo.id_conta = conta.id_conta;
  }

  const soltar = ocupar(el('salvarMeta'), 'Criando...');
  const { ok, dados } = await chamarApi('/api/meta', { method: 'POST', body: JSON.stringify(corpo) });
  soltar();

  if (!ok) return avisar(dados.erro || 'Não foi possível criar a meta.', 'erro');

  el('folhaMeta').close();
  avisar(conta ? `Meta "${dados.titulo}" criada com ${formatarMoeda(dados.valor_atual)} tirados de "${conta.nome}".` : `Meta "${dados.titulo}" criada.`);
  anunciarMudanca();
});

function saldoInsuficiente(conta, valor) {
  return informar({
    titulo: 'Saldo insuficiente',
    mensagem: `A conta "${conta.nome}" tem ${formatarMoeda(conta.saldo)}, e você quer guardar ${formatarMoeda(valor)}. Escolha outra conta ou um valor menor.`,
  });
}

// ---- GUARDAR DINHEIRO ----

let metaParaGuardar = null;

async function abrirGuardar(meta) {
  if (contasManuais.length === 0) {
    return informar({
      titulo: 'Você precisa de uma conta',
      mensagem: 'O valor guardado sai de uma conta. Crie uma conta na tela de Contas para guardar dinheiro na meta.',
    });
  }

  metaParaGuardar = meta;
  const falta = Number(meta.valor_alvo) - Number(meta.valor_atual);

  el('formGuardar').reset();
  erroNoCampo(el('valorGuardar'), '');
  el('tituloFolhaGuardar').textContent = `Guardar para "${meta.titulo}"`;
  el('textoGuardar').textContent = `Faltam ${formatarMoeda(falta)} para chegar na meta.`;
  el('contaGuardar').innerHTML = contasManuais.map((c) => `<option value="${c.id_conta}">${esc(textoDaConta(c))}</option>`).join('');

  abrirJanela(el('folhaGuardar'));
  el('valorGuardar').focus();
}

el('formGuardar').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const meta = metaParaGuardar;
  const valor = lerValor(el('valorGuardar'));
  erroNoCampo(el('valorGuardar'), valor ? '' : 'Digite um valor maior que zero, como 100,00.');
  if (!valor) return el('valorGuardar').focus();

  const conta = contasManuais.find((c) => c.id_conta === Number(el('contaGuardar').value));
  const falta = Number(meta.valor_alvo) - Number(meta.valor_atual);
  // Pediu R$ 500 e faltavam R$ 200: só R$ 200 saem da conta.
  const vaiSair = Math.min(valor, falta);
  if (vaiSair > Number(conta.saldo)) return saldoInsuficiente(conta, vaiSair);

  const soltar = ocupar(el('salvarGuardar'), 'Guardando...');
  const { ok, dados } = await chamarApi('/api/meta/' + meta.id_meta, {
    method: 'PUT',
    body: JSON.stringify({ adicionar: valor, id_conta: conta.id_conta }),
  });
  soltar();

  if (!ok) return avisar(dados.erro || 'Não foi possível guardar o valor.', 'erro');

  el('folhaGuardar').close();
  const saiu = formatarMoeda(dados.valor_guardado);
  avisar(
    valor > falta
      ? `Meta "${meta.titulo}" alcançada! Faltavam só ${saiu}, então só ${saiu} saíram de "${conta.nome}".`
      : `${saiu} saíram de "${conta.nome}" e foram guardados em "${meta.titulo}".`
  );
  anunciarMudanca();
});

async function excluirMeta(meta) {
  const guardado = Number(meta.valor_atual) > 0;
  const sim = await confirmar({
    titulo: `Excluir a meta "${meta.titulo}"?`,
    mensagem: guardado ? `Você já guardou ${formatarMoeda(meta.valor_atual)} nessa meta.` : '',
    aviso: guardado
      ? `Esse dinheiro não volta para a conta: ele continua em Transações como "Meta: ${meta.titulo}". Essa ação não pode ser desfeita.`
      : 'Essa ação não pode ser desfeita.',
    textoConfirmar: 'Excluir meta',
  });
  if (!sim) return;

  const { ok, dados } = await chamarApi('/api/meta/' + meta.id_meta, { method: 'DELETE' });
  if (!ok) return avisar(dados.erro || 'Não foi possível excluir a meta.', 'erro');

  avisar(`Meta "${meta.titulo}" excluída.`);
  anunciarMudanca();
}

el('listaMetas').addEventListener('click', (evento) => {
  if (evento.target.closest('[data-nova-meta]')) return abrirNovaMeta();

  const guardar = evento.target.closest('[data-guardar]');
  if (guardar) return abrirGuardar(metas.find((m) => m.id_meta === Number(guardar.dataset.guardar)));

  const excluir = evento.target.closest('[data-excluir-meta]');
  if (excluir) excluirMeta(metas.find((m) => m.id_meta === Number(excluir.dataset.excluirMeta)));
});

// ---- LIMITES DE GASTO ----
//
// O gasto do mês, o que resta e a situação (ok, atenção, estourado) já vêm
// calculados do servidor. A tela não repete a regra: só escolhe as cores.

const VISUAL_DO_LIMITE = {
  ok: { capsula: 'folha', texto: 'Dentro do limite', barra: '' },
  atencao: { capsula: 'sol', texto: 'Perto do limite', barra: 'barra--sol' },
  estourado: { capsula: 'coral', texto: 'Passou do limite', barra: 'barra--coral' },
};

function cartaoDoLimite(limite) {
  const v = VISUAL_DO_LIMITE[limite.situacao];
  const pct = Math.round(limite.percentual);
  const categoria = categoriasDeGasto.find((c) => c.id_categoria === limite.id_categoria) || { nome_categoria: limite.nome_categoria, tipo: 'despesa', id_usuario: 1 };

  return `
    <article class="cartao meta">
      <div class="meta__topo">
        <div class="cartao__titulo">
          ${iconeDaCategoria(categoria)}
          <div>
            <h3>${esc(limite.nome_categoria)}</h3>
            <span class="capsula capsula--${v.capsula}">${v.texto}</span>
          </div>
        </div>
        <button type="button" class="botao-icone" data-excluir-limite="${limite.id_limite}" aria-label="Remover o limite de ${esc(limite.nome_categoria)}" title="Remover"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
      </div>

      <div class="meta__valores">
        <span class="numero">${formatarMoeda(limite.gasto_mes)}</span>
        <span class="suave">de ${formatarMoeda(limite.valor_limite)} por mês</span>
      </div>

      <div class="barra ${v.barra}" role="img" aria-label="${pct}% do limite usado"><span style="width:${Math.min(100, pct)}%"></span></div>

      <p class="${limite.restante < 0 ? 'alerta-texto' : 'suave'}">
        ${limite.restante >= 0 ? `Ainda pode gastar <strong>${formatarMoeda(limite.restante)}</strong> este mês.` : `Passou <strong>${formatarMoeda(-limite.restante)}</strong> do limite.`}
      </p>

      <button type="button" class="botao botao--linha" data-alterar-limite="${limite.id_limite}">Alterar limite</button>
    </article>`;
}

function desenharLimites() {
  el('listaLimites').innerHTML =
    limites.map(cartaoDoLimite).join('') +
    `<button type="button" class="novo" data-novo-limite>
       <span class="icone" aria-hidden="true"><i class="fa-solid fa-plus"></i></span>
       Novo limite de gasto
     </button>`;
}

function mostrarGastoDaCategoria() {
  const id = Number(el('categoriaLimite').value);
  const categoria = categoriasDeGasto.find((c) => c.id_categoria === id);
  el('gastoCategoriaLimite').textContent = categoria
    ? `Este mês você já gastou ${formatarMoeda(gastoDoMes.get(id) || 0)} em ${categoria.nome_categoria}.`
    : '';
}

el('categoriaLimite').addEventListener('change', mostrarGastoDaCategoria);

// limite = null -> criar (idCategoria deixa uma categoria já escolhida)
// limite = {...} -> alterar o valor
function abrirFolhaLimite(limite, idCategoria = null) {
  el('formLimite').reset();
  erroNoCampo(el('valorLimite'), '');
  el('idLimite').value = limite ? limite.id_limite : '';
  el('campoCategoriaLimite').hidden = Boolean(limite);

  if (limite) {
    el('tituloFolhaLimite').textContent = `Limite de ${limite.nome_categoria}`;
    el('salvarLimite').textContent = 'Salvar';
    el('gastoCategoriaLimite').textContent = `Hoje o limite é ${formatarMoeda(limite.valor_limite)} por mês, e você já gastou ${formatarMoeda(limite.gasto_mes)} este mês.`;
    el('valorLimite').value = valorNoCampo(limite.valor_limite);
  } else {
    el('tituloFolhaLimite').textContent = 'Novo limite de gasto';
    el('salvarLimite').textContent = 'Criar limite';

    // Só as categorias que ainda não têm limite (é um por categoria).
    const comLimite = new Set(limites.map((l) => l.id_categoria));
    const livres = categoriasDeGasto.filter((c) => !comLimite.has(c.id_categoria));

    if (livres.length === 0) {
      return informar({ titulo: 'Todas as categorias já têm limite', mensagem: 'Para mudar um valor, use o botão "Alterar limite" da categoria.' });
    }

    el('categoriaLimite').innerHTML = livres.map((c) => `<option value="${c.id_categoria}">${esc(c.nome_categoria)}</option>`).join('');

    // Sugere a que foi pedida, ou a que mais pesou no mês.
    const sugerida = livres.find((c) => c.id_categoria === idCategoria) || [...livres].sort((a, b) => (gastoDoMes.get(b.id_categoria) || 0) - (gastoDoMes.get(a.id_categoria) || 0))[0];
    el('categoriaLimite').value = sugerida.id_categoria;
    mostrarGastoDaCategoria();
  }

  abrirJanela(el('folhaLimite'));
  el('valorLimite').focus();
}

el('formLimite').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const valor = lerValor(el('valorLimite'));
  erroNoCampo(el('valorLimite'), valor ? '' : 'Digite um valor maior que zero, como 500,00.');
  if (!valor) return el('valorLimite').focus();

  const id = el('idLimite').value;
  const soltar = ocupar(el('salvarLimite'), 'Salvando...');
  const { ok, dados } = await chamarApi(id ? '/api/limite/' + id : '/api/limite', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(id ? { valor_limite: valor } : { id_categoria: Number(el('categoriaLimite').value), valor_limite: valor }),
  });
  soltar();

  if (!ok) return avisar(dados.erro || 'Não foi possível salvar o limite.', 'erro');

  el('folhaLimite').close();
  avisar(`Limite de ${dados.nome_categoria}: até ${formatarMoeda(dados.valor_limite)} por mês.`);
  anunciarMudanca();
});

async function excluirLimite(limite) {
  const sim = await confirmar({
    titulo: `Remover o limite de ${limite.nome_categoria}?`,
    mensagem: 'Suas transações não mudam: só deixa de existir o acompanhamento do limite.',
    textoConfirmar: 'Remover limite',
  });
  if (!sim) return;

  const { ok, dados } = await chamarApi('/api/limite/' + limite.id_limite, { method: 'DELETE' });
  if (!ok) return avisar(dados.erro || 'Não foi possível remover o limite.', 'erro');

  avisar(`Limite de ${limite.nome_categoria} removido.`);
  anunciarMudanca();
}

el('listaLimites').addEventListener('click', (evento) => {
  if (evento.target.closest('[data-novo-limite]')) return abrirFolhaLimite(null);

  const alterar = evento.target.closest('[data-alterar-limite]');
  if (alterar) return abrirFolhaLimite(limites.find((l) => l.id_limite === Number(alterar.dataset.alterarLimite)));

  const excluir = evento.target.closest('[data-excluir-limite]');
  if (excluir) excluirLimite(limites.find((l) => l.id_limite === Number(excluir.dataset.excluirLimite)));
});

// ---- BUSCAR ----

async function carregar() {
  const [rMetas, rLimites, rContas, rCategorias, rTransacoes] = await Promise.all([
    chamarApi(`/api/usuario/${ID_USUARIO}/meta`),
    chamarApi(`/api/usuario/${ID_USUARIO}/limite`),
    chamarApi(`/api/usuario/${ID_USUARIO}/conta`),
    chamarApi('/api/categoria'),
    chamarApi(`/api/usuario/${ID_USUARIO}/transacao`),
  ]);

  if (rContas.ok) contasManuais = rContas.dados.filter((c) => !c.id_conexao);

  // Limite só existe para categoria de gasto, e nunca para "Metas".
  if (rCategorias.ok) {
    categoriasDeGasto = rCategorias.dados.filter((c) => c.tipo === 'despesa' && !ehCategoriaSoDoSistema(c));
  }

  if (rTransacoes.ok) {
    const mesAtual = hojeTexto().slice(0, 7);
    gastoDoMes = new Map();
    rTransacoes.dados
      .filter((t) => t.categoria.tipo === 'despesa' && String(t.data_transacao).slice(0, 7) === mesAtual)
      .forEach((t) => gastoDoMes.set(t.categoria.id_categoria, (gastoDoMes.get(t.categoria.id_categoria) || 0) + Number(t.valor_transacao)));
  }

  if (rMetas.ok) {
    metas = rMetas.dados;
    desenharMetas();
  } else {
    avisar('Não foi possível carregar suas metas.', 'erro');
  }

  if (rLimites.ok) {
    limites = rLimites.dados;
    desenharLimites();
  }
}

// /novo/metas?nova=meta  -> abre a folha de meta nova (vem do Início)
// /novo/metas?limite=ID  -> abre o limite daquela categoria (vem do Início)
async function iniciar() {
  await carregar();

  const parametros = new URLSearchParams(location.search);
  const idCategoria = Number(parametros.get('limite'));
  const novaMeta = parametros.get('nova') === 'meta';
  if (!idCategoria && !novaMeta) return;

  // Limpa o endereço: recarregar a página não deve abrir a folha de novo.
  history.replaceState(null, '', location.pathname);

  if (novaMeta) return abrirNovaMeta();

  const existente = limites.find((l) => l.id_categoria === idCategoria);
  abrirFolhaLimite(existente || null, idCategoria);
}

iniciar();
document.addEventListener('verdanz:mudou', carregar);
