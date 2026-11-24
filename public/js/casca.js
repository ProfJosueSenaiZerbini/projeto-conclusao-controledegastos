// A "casca" das telas de dentro: tudo o que é igual em todas elas.
//
//   1. barra quem não tem sessão
//   2. monta o menu lateral (computador) e a barra de baixo (celular)
//   3. mostra o nome de quem entrou e o botão Sair
//   4. sino dos avisos
//   5. formulário "Registrar gasto ou ganho", que abre de QUALQUER tela
//
// Cada tela só precisa ter no HTML os lugares vazios (#lateral, #topoAcoes)
// e dizer quem ela é em <body data-pagina="inicio">.
//
// IMPORTANTE: a checagem de sessão daqui NÃO é segurança, é só conforto.
// Quem protege os dados é o servidor: sem token válido a API não devolve
// nada. Regra: quem protege dado é o servidor, nunca o navegador.

// ---- 1. SESSÃO ----

if (!Sessao.token() || !Sessao.idUsuario()) {
  window.location.replace('/entrar');
}

const ID_USUARIO = Sessao.idUsuario();
const PAGINA = document.body.dataset.pagina;

function sair() {
  Sessao.limpar();
  window.location.href = '/entrar';
}

// ---- 2. MENU ----
//
// UMA lista só. O menu lateral, a barra do celular e a folha "Mais" são
// montados a partir dela: mudar um item aqui muda nos três lugares.
//   celular: true -> aparece na barra de baixo (cabem 4, mais o botão "+")
const ITENS_DO_MENU = [
  { pagina: 'inicio', texto: 'Início', icone: 'fa-solid fa-house', celular: true },
  { pagina: 'transacoes', texto: 'Transações', icone: 'fa-solid fa-right-left', celular: true },
  { pagina: 'contas', texto: 'Contas', icone: 'fa-solid fa-wallet' },
  { pagina: 'metas', texto: 'Metas', icone: 'fa-solid fa-flag', celular: true },
  { pagina: 'meu-perfil', texto: 'Meu perfil', icone: 'fa-solid fa-user-gear' },
  { pagina: 'configuracoes', texto: 'Configurações', icone: 'fa-solid fa-gear' },
  // Ainda não existe: aparece, mas não é um link.
  { texto: 'Planejamento', icone: 'fa-regular fa-calendar', emBreve: true },
];

function itemDoMenu(item) {
  if (item.emBreve) {
    return `<li><span class="menu__em-breve"><i class="${item.icone}" aria-hidden="true"></i> ${item.texto} <small>Em breve</small></span></li>`;
  }

  // aria-current="page" pinta o item e faz o leitor de tela dizer "página
  // atual". A tela atual não é link (sem href): clicar nela não faria nada
  // além de carregar de novo a mesma tela.
  return `
    <li>
      <a ${linkDaPagina(item.pagina)}>
        <i class="${item.icone}" aria-hidden="true"></i> ${item.texto}
      </a>
    </li>`;
}

// Os atributos do <a> que leva a uma tela. Na tela em que a pessoa já está,
// o <a> fica sem href: deixa de ser clicável e de receber o Tab, mas
// continua no mesmo lugar, com a mesma cara.
function linkDaPagina(pagina) {
  return pagina === PAGINA ? 'aria-current="page"' : `href="/${pagina}"`;
}

const MARCA = `
  <img src="/img/VerdanzIcone.png" alt="">
  <strong>Verdan<span>z</span></strong>`;

function montarLateral() {
  const lateral = document.getElementById('lateral');
  if (!lateral) return;

  lateral.innerHTML = `
    ${PAGINA === 'inicio' ? `<span class="marca">${MARCA}</span>` : `<a class="marca" href="/inicio" title="Ir para o Início">${MARCA}</a>`}

    <button type="button" class="botao botao--largo" data-registrar>
      <i class="fa-solid fa-plus" aria-hidden="true"></i> Novo gasto ou ganho
    </button>

    <nav aria-label="Menu principal">
      <ul class="menu">${ITENS_DO_MENU.map(itemDoMenu).join('')}</ul>
    </nav>

    <div class="lateral__pe">
      <div class="pessoa">
        <span class="iniciais" data-iniciais aria-hidden="true">·</span>
        <span class="pessoa__texto">
          <strong data-nome>&nbsp;</strong>
          <small>Sua conta no Verdanz</small>
        </span>
      </div>
      <ul class="menu">
        <li><button type="button" data-sair><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Sair</button></li>
      </ul>
    </div>`;
}

function montarTopo() {
  const topo = document.getElementById('topo');
  if (!topo) return;

  // No celular o menu lateral não existe: a marca vai para o topo.
  topo.insertAdjacentHTML(
    'afterbegin',
    PAGINA === 'inicio'
      ? '<span class="topo__marca"><img src="/img/VerdanzIcone.png" alt=""></span>'
      : `<a class="topo__marca" href="/inicio" aria-label="Ir para o Início"><img src="/img/VerdanzIcone.png" alt=""></a>`
  );
}

function montarBarraDeBaixo() {
  const doCelular = ITENS_DO_MENU.filter((item) => item.celular);
  // Quem está numa tela que só existe dentro do "Mais" vê o "Mais" aceso.
  const estaNoMais = !doCelular.some((item) => item.pagina === PAGINA);

  const link = (item) => `
    <a ${linkDaPagina(item.pagina)}>
      <i class="${item.icone}" aria-hidden="true"></i><span>${item.texto}</span>
    </a>`;

  const barra = document.createElement('nav');
  barra.className = 'barra-baixo';
  barra.setAttribute('aria-label', 'Menu do celular');
  barra.innerHTML = `
    ${link(doCelular[0])}
    ${link(doCelular[1])}
    <button type="button" class="barra-baixo__mais" data-registrar>
      <span><i class="fa-solid fa-plus" aria-hidden="true"></i></span><span>Registrar</span>
    </button>
    ${link(doCelular[2])}
    <button type="button" data-abrir-mais${estaNoMais ? ' aria-current="page"' : ''}>
      <i class="fa-solid fa-bars" aria-hidden="true"></i><span>Mais</span>
    </button>`;
  document.body.appendChild(barra);

  // Folha "Mais": o menu inteiro, para o celular.
  const folha = document.createElement('dialog');
  folha.className = 'folha';
  folha.id = 'folhaMais';
  folha.setAttribute('aria-labelledby', 'tituloMais');
  folha.innerHTML = `
    <div>
      <div class="folha__topo">
        <h2 id="tituloMais">Menu</h2>
        <button type="button" class="botao-icone" data-fechar aria-label="Fechar o menu"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <div class="folha__corpo">
        <div class="pessoa">
          <span class="iniciais" data-iniciais aria-hidden="true">·</span>
          <span class="pessoa__texto"><strong data-nome class="pessoa__nome-escuro">&nbsp;</strong></span>
        </div>
        <ul class="menu menu--claro">
          ${ITENS_DO_MENU.map(itemDoMenu).join('')}
          <li><button type="button" data-sair><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Sair</button></li>
        </ul>
      </div>
    </div>`;
  document.body.appendChild(folha);
}

// ---- 3. QUEM ENTROU ----

let usuarioAtual = null;

async function carregarUsuario() {
  try {
    const { ok, status, dados } = await chamarApi('/api/usuario/' + ID_USUARIO);

    // 401 = token vencido ou adulterado. 403 = token de outra pessoa.
    // 404 = a conta foi excluída (pelo link do e-mail, talvez em outro
    // aparelho): a sessão que sobrou aqui não serve mais.
    if (!ok) {
      if (status === 401 || status === 403 || status === 404) sair();
      return;
    }

    usuarioAtual = dados;
    const primeiroNome = dados.nome_usuario.split(' ')[0];

    document.querySelectorAll('[data-nome]').forEach((e) => (e.textContent = dados.nome_usuario));
    document.querySelectorAll('[data-primeiro-nome]').forEach((e) => (e.textContent = primeiroNome));
    document.querySelectorAll('[data-iniciais]').forEach((e) => (e.textContent = iniciaisDe(dados.nome_usuario)));

    document.dispatchEvent(new CustomEvent('verdanz:usuario', { detail: dados }));
  } catch (erro) {
    console.error('Erro de conexão:', erro);
  }
}

// ---- 4. SINO DOS AVISOS ----
//
// Quais avisos existem é o servidor que decide (src/notificacoes.js), e
// nenhum é gravado no banco: pagou a conta, o aviso some sozinho. No
// navegador ficam só duas coisas: quais tipos a pessoa quer ver
// (Configurações) e quais ela já viu, para o número contar só os novos.

const PREFERENCIA_DO_AVISO = { conta: 'notif_contas', meta: 'notif_metas', saldo: 'notif_saldo', limite: 'notif_limites' };
const ICONE_DO_AVISO = { conta: 'fa-regular fa-calendar', meta: 'fa-solid fa-flag', saldo: 'fa-solid fa-wallet', limite: 'fa-solid fa-gauge-high' };

function lerDoNavegador(chave, padrao) {
  try {
    return JSON.parse(localStorage.getItem(chave)) || padrao;
  } catch (e) {
    return padrao;
  }
}

function montarSino() {
  const lugar = document.getElementById('topoAcoes');
  if (!lugar) return;

  const chaveVistos = 'notificacoes_vistas_' + ID_USUARIO;
  let avisos = [];

  lugar.insertAdjacentHTML(
    'beforeend',
    `<div class="sino">
       <button type="button" class="botao-icone" id="botaoSino" aria-label="Avisos" aria-expanded="false" aria-controls="painelAvisos">
         <i class="fa-regular fa-bell" aria-hidden="true"></i>
         <span class="sino__conta" id="contaSino" hidden></span>
       </button>
       <div class="avisos" id="painelAvisos" hidden>
         <h2>Avisos</h2>
         <div id="listaAvisos"></div>
         <a class="avisos__pe" href="/configuracoes#avisos">Escolher quais avisos receber</a>
       </div>
     </div>`
  );

  const botao = document.getElementById('botaoSino');
  const painel = document.getElementById('painelAvisos');
  const lista = document.getElementById('listaAvisos');
  const conta = document.getElementById('contaSino');

  async function buscar() {
    const { ok, dados } = await chamarApi(`/api/usuario/${ID_USUARIO}/notificacao`);
    if (!ok) return false;
    const preferencias = lerDoNavegador('preferencias_' + ID_USUARIO, {});
    avisos = dados.filter((a) => preferencias[PREFERENCIA_DO_AVISO[a.tipo]] !== false);
    return true;
  }

  function mostrarConta() {
    const vistos = lerDoNavegador(chaveVistos, []);
    const novos = avisos.filter((a) => !vistos.includes(a.chave)).length;
    conta.textContent = novos > 9 ? '9+' : novos;
    conta.hidden = novos === 0;
    botao.setAttribute('aria-label', novos > 0 ? `Avisos: ${plural(novos, 'novo', 'novos')}` : 'Avisos');
  }

  function desenhar() {
    lista.innerHTML = avisos.length
      ? avisos
          .map(
            (a) => `
            <a class="aviso-item" href="${a.link}">
              <span class="icone icone--p ${a.gravidade === 'alerta' ? 'icone--coral' : 'icone--sol'}" aria-hidden="true"><i class="${ICONE_DO_AVISO[a.tipo] || 'fa-regular fa-bell'}"></i></span>
              <span><strong>${esc(a.titulo)}</strong><small>${esc(a.mensagem)}</small></span>
            </a>`
          )
          .join('')
      : '<p class="vazio">Tudo em dia. Nenhum aviso por aqui.</p>';
  }

  function fechar() {
    painel.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
  }

  botao.addEventListener('click', async () => {
    if (!painel.hidden) return fechar();

    desenhar();
    painel.hidden = false;
    botao.setAttribute('aria-expanded', 'true');

    if (await buscar()) desenhar();
    localStorage.setItem(chaveVistos, JSON.stringify(avisos.map((a) => a.chave)));
    mostrarConta();
  });

  document.addEventListener('click', (evento) => {
    if (!evento.target.closest('.sino')) fechar();
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') fechar();
  });

  const atualizar = () => buscar().then((ok) => ok && mostrarConta());
  atualizar();
  document.addEventListener('verdanz:mudou', atualizar);
}

// ---- 5. REGISTRAR GASTO OU GANHO ----
//
// Mora aqui, e não na tela de Transações, porque é a tarefa mais comum do
// sistema: a pessoa registra de onde estiver, sem precisar saber em que
// tela "isso fica".
//
// As regras do servidor que o formulário respeita:
//   - conta importada do banco não recebe lançamento manual;
//   - a categoria "Metas" é só do sistema (guardar dinheiro numa meta);
//   - o tipo (gasto ou ganho) vem da CATEGORIA, nunca de um campo próprio.

// O mesmo número de PERCENTUAL_ATENCAO em src/controllers/limiteController.js.
const PERCENTUAL_DE_ATENCAO = 70;

const Lancamento = {
  contas: [],
  categorias: [],
  limites: [],
  folha: null,

  montar() {
    const folha = document.createElement('dialog');
    folha.className = 'folha';
    folha.id = 'folhaLancamento';
    folha.setAttribute('aria-labelledby', 'tituloLancamento');
    folha.innerHTML = `
      <form id="formLancamento" novalidate>
        <div class="folha__topo">
          <h2 id="tituloLancamento">Registrar</h2>
          <button type="button" class="botao-icone" data-fechar aria-label="Fechar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>

        <div class="folha__corpo">
          <fieldset>
            <legend class="so-leitor">O que você quer registrar?</legend>
            <div class="escolha">
              <label><input type="radio" name="lancTipo" value="despesa" checked><i class="fa-solid fa-arrow-down" aria-hidden="true"></i> Gasto</label>
              <label><input type="radio" name="lancTipo" value="receita"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i> Ganho</label>
            </div>
          </fieldset>

          <div class="campo">
            <label for="lancValor">Valor</label>
            <div class="dinheiro dinheiro--grande">
              <span aria-hidden="true">R$</span>
              <input class="entrada" id="lancValor" inputmode="decimal" autocomplete="off" placeholder="0,00" aria-describedby="lancValorErro">
            </div>
            <p class="erro" id="lancValorErro" hidden></p>
          </div>

          <div class="campo">
            <div class="fila fila--entre">
              <span class="rotulo" id="lancCategoriaRotulo">Categoria</span>
              <button type="button" class="botao botao--quieto botao--p" id="lancNovaCategoria" aria-expanded="false" aria-controls="lancCaixaCategoria">
                <i class="fa-solid fa-plus" aria-hidden="true"></i> Nova categoria
              </button>
            </div>
            <!-- Uma peça por categoria, com o ícone e a cor dela. São botões
                 de rádio de verdade: as setas do teclado andam entre eles. -->
            <div class="cat-escolha" id="lancCategoria" role="radiogroup" aria-labelledby="lancCategoriaRotulo" aria-describedby="lancCategoriaErro"></div>
            <p class="erro" id="lancCategoriaErro" hidden></p>

            <div class="pilha--p" id="lancCaixaCategoria" hidden>
              <label for="lancNomeCategoria" class="pequeno">Nome da nova categoria de <span id="lancTipoCategoria">gasto</span></label>
              <div class="fila">
                <input class="entrada" id="lancNomeCategoria" maxlength="50" style="flex:1; min-width: 10rem" aria-describedby="lancNomeCategoriaErro">
                <button type="button" class="botao botao--escuro botao--p" id="lancCriarCategoria">Criar</button>
              </div>
              <p class="erro" id="lancNomeCategoriaErro" hidden></p>
            </div>
          </div>

          <div class="campo">
            <label for="lancDescricao">Descrição <span class="fraco">(opcional)</span></label>
            <input class="entrada" id="lancDescricao" maxlength="150" placeholder="Mercado, conta de luz, salário...">
          </div>

          <div class="campo">
            <label for="lancConta">Conta</label>
            <select class="entrada" id="lancConta"></select>
          </div>

          <div class="campo">
            <label for="lancData">Data</label>
            <input class="entrada" type="date" id="lancData">
            <p class="ajuda" id="lancAjudaData"></p>
          </div>

          <label class="marcar" id="lancCampoPago">
            <input type="checkbox" id="lancPago" checked>
            <span><strong>Já paguei</strong><br><span class="fraco pequeno">Desmarque se for uma conta que você ainda vai pagar.</span></span>
          </label>

          <button type="submit" class="botao botao--largo" id="lancSalvar">Registrar gasto</button>
        </div>
      </form>`;

    document.body.appendChild(folha);
    this.folha = folha;

    // A tecla Esc NÃO fecha esta folha: um toque sem querer apagaria tudo o
    // que já foi digitado. Ela fecha pelo X. O <dialog> fecha com Esc
    // sozinho; impedir o "keydown" e o "cancel" desliga isso.
    folha.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') evento.preventDefault();
    });
    folha.addEventListener('cancel', (evento) => evento.preventDefault());

    const el = (id) => document.getElementById(id);

    // Escolheu uma categoria: o aviso de "escolha uma categoria" some.
    el('lancCategoria').addEventListener('change', () => erroNoCampo(el('lancCategoria'), ''));

    folha.querySelectorAll('[name="lancTipo"]').forEach((radio) => radio.addEventListener('change', () => this.trocarTipo()));
    el('lancData').addEventListener('change', () => this.sugerirPago());
    el('lancNovaCategoria').addEventListener('click', () => this.mostrarNovaCategoria(el('lancCaixaCategoria').hidden));
    el('lancCriarCategoria').addEventListener('click', () => this.criarCategoria());
    el('lancNomeCategoria').addEventListener('keydown', (evento) => {
      // Enter aqui cria a categoria, e não registra o lançamento.
      if (evento.key === 'Enter') {
        evento.preventDefault();
        this.criarCategoria();
      }
    });
    el('formLancamento').addEventListener('submit', (evento) => {
      evento.preventDefault();
      this.salvar();
    });
  },

  tipo() {
    return this.folha.querySelector('[name="lancTipo"]:checked').value;
  },

  // tipo: 'despesa' (gasto) ou 'receita' (ganho)
  async abrir(tipo = 'despesa') {
    if (!this.folha) this.montar();

    // Busca tudo de novo a cada abertura: o saldo e os limites mudam.
    const [contas, categorias, limites] = await Promise.all([
      chamarApi(`/api/usuario/${ID_USUARIO}/conta`),
      chamarApi('/api/categoria'),
      chamarApi(`/api/usuario/${ID_USUARIO}/limite`),
    ]);

    if (!contas.ok || !categorias.ok) {
      avisar('Não foi possível abrir o formulário. Confira sua conexão.', 'erro');
      return;
    }

    // Conta importada do banco só muda pelo banco.
    this.contas = contas.dados.filter((c) => !c.id_conexao);
    this.categorias = categorias.dados;
    this.limites = limites.ok ? limites.dados : [];

    if (this.contas.length === 0) {
      const ir = await confirmar({
        titulo: 'Você precisa de uma conta',
        mensagem: 'Todo gasto ou ganho fica dentro de uma conta (a Carteira, por exemplo). Crie uma conta para começar a registrar.',
        textoConfirmar: 'Ir para Contas',
        perigo: false,
      });
      if (ir) window.location.href = '/contas';
      return;
    }

    document.getElementById('formLancamento').reset();
    this.folha.querySelector(`[name="lancTipo"][value="${tipo}"]`).checked = true;

    document.getElementById('lancConta').innerHTML = this.contas
      .map((c) => `<option value="${c.id_conta}">${esc(c.nome)} · ${formatarMoeda(c.saldo)}</option>`)
      .join('');
    document.getElementById('lancData').value = hojeTexto();
    erroNoCampo(document.getElementById('lancValor'), '');

    this.trocarTipo();
    abrirJanela(this.folha);
    document.getElementById('lancValor').focus();
  },

  trocarTipo() {
    const gasto = this.tipo() === 'despesa';

    // Quem está lançando um gasto não precisa ver "Salário" na lista. As
    // categorias só do sistema (Metas, transferências) também ficam de fora.
    const caixa = document.getElementById('lancCategoria');
    caixa.innerHTML = this.categorias
      .filter((c) => c.tipo === this.tipo() && !ehCategoriaSoDoSistema(c))
      .map((c) => {
        const visual = visualDaCategoria(c);
        const cor = visual.cor || 'neutra';
        return `
          <label class="cat-opcao cat-opcao--${cor}">
            <input type="radio" name="lancCategoria" value="${c.id_categoria}">
            <span class="icone icone--p ${visual.cor ? 'icone--' + visual.cor : ''}" aria-hidden="true"><i class="fa-solid ${visual.icone}"></i></span>
            <span class="cat-opcao__nome">${esc(c.nome_categoria)}</span>
          </label>`;
      })
      .join('');
    erroNoCampo(caixa, '');

    // Ganho não tem "pago": ele entra no saldo no dia dele.
    document.getElementById('lancCampoPago').hidden = !gasto;
    document.getElementById('lancSalvar').textContent = gasto ? 'Registrar gasto' : 'Registrar ganho';
    document.getElementById('tituloLancamento').textContent = gasto ? 'Registrar um gasto' : 'Registrar um ganho';
    this.mostrarNovaCategoria(false);
    this.sugerirPago();
  },

  // Gasto de hoje ou de antes: o normal é já ter pago. Data futura: o
  // normal é ser uma conta a pagar.
  sugerirPago() {
    const data = document.getElementById('lancData').value;
    const futuro = Boolean(data) && data > hojeTexto();
    document.getElementById('lancPago').checked = !futuro;

    const ajuda = document.getElementById('lancAjudaData');
    if (!futuro) ajuda.textContent = '';
    else if (this.tipo() === 'despesa') ajuda.textContent = 'Data no futuro: fica como conta a pagar e só sai do saldo quando você marcar como paga.';
    else ajuda.textContent = 'Data no futuro: o valor entra no saldo quando esse dia chegar.';
  },

  mostrarNovaCategoria(aberta) {
    document.getElementById('lancCaixaCategoria').hidden = !aberta;
    document.getElementById('lancNovaCategoria').setAttribute('aria-expanded', String(aberta));
    document.getElementById('lancTipoCategoria').textContent = this.tipo() === 'receita' ? 'ganho' : 'gasto';
    const nome = document.getElementById('lancNomeCategoria');
    nome.value = '';
    erroNoCampo(nome, '');
    if (aberta) nome.focus();
  },

  // A categoria nasce do tipo escolhido e já fica selecionada.
  async criarCategoria() {
    const campo = document.getElementById('lancNomeCategoria');
    const nome = campo.value.trim();
    if (!nome) return erroNoCampo(campo, 'Dê um nome para a categoria.');

    const soltar = ocupar(document.getElementById('lancCriarCategoria'));
    const { ok, dados } = await chamarApi('/api/categoria', {
      method: 'POST',
      body: JSON.stringify({ nome_categoria: nome, tipo: this.tipo() }),
    });
    soltar();

    if (!ok) return erroNoCampo(campo, dados.erro || 'Não foi possível criar a categoria.');

    this.categorias.push(dados);
    this.categorias.sort((a, b) => a.nome_categoria.localeCompare(b.nome_categoria, 'pt-BR'));
    this.trocarTipo();
    this.folha.querySelector(`[name="lancCategoria"][value="${dados.id_categoria}"]`).checked = true;
  },

  // O id da categoria marcada, ou 0 se nenhuma foi escolhida.
  categoriaEscolhida() {
    const marcada = this.folha.querySelector('[name="lancCategoria"]:checked');
    return marcada ? Number(marcada.value) : 0;
  },

  // Antes de gravar um gasto: se ele deixa a categoria perto do limite do
  // mês (ou acima dele), a pessoa confirma. É só um aviso: o servidor não
  // recusa gasto acima do limite.
  async confirmarLimite(corpo) {
    const limite = this.limites.find((l) => l.id_categoria === corpo.id_categoria);
    if (!limite) return true;

    // Em centavos, para fugir dos erros de arredondamento do JavaScript.
    const limiteCentavos = Math.round(limite.valor_limite * 100);
    const depois = Math.round(limite.gasto_mes * 100) + Math.round(corpo.valor_transacao * 100);
    const porcento = Math.round((depois / limiteCentavos) * 100);
    if (porcento < PERCENTUAL_DE_ATENCAO) return true;

    const passa = depois > limiteCentavos;
    const diferenca = formatarMoeda(Math.abs(limiteCentavos - depois) / 100);

    return confirmar({
      titulo: passa ? `Este gasto passa do limite de ${limite.nome_categoria}` : `Você está perto do limite de ${limite.nome_categoria}`,
      mensagem:
        `Este mês você já gastou ${formatarMoeda(limite.gasto_mes)} de ${formatarMoeda(limite.valor_limite)}. ` +
        `Com este gasto, vai para ${formatarMoeda(depois / 100)} (${porcento}% do limite).`,
      aviso: passa ? `Você vai passar ${diferenca} do limite do mês.` : `Depois dele, restam ${diferenca} para o resto do mês.`,
      textoConfirmar: 'Registrar mesmo assim',
      textoCancelar: 'Voltar',
      perigo: passa,
    });
  },

  async salvar() {
    const campoValor = document.getElementById('lancValor');
    const valor = lerValor(campoValor);

    if (!valor) {
      erroNoCampo(campoValor, 'Digite um valor maior que zero, como 25,90.');
      campoValor.focus();
      return;
    }
    erroNoCampo(campoValor, '');

    const gasto = this.tipo() === 'despesa';
    const corpo = {
      valor_transacao: valor,
      data_transacao: document.getElementById('lancData').value || hojeTexto(),
      descricao: document.getElementById('lancDescricao').value.trim(),
      id_categoria: this.categoriaEscolhida(),
      id_conta: Number(document.getElementById('lancConta').value),
    };
    if (gasto) corpo.pago = document.getElementById('lancPago').checked;

    if (!corpo.id_categoria) {
      const caixa = document.getElementById('lancCategoria');
      erroNoCampo(caixa, `Escolha a categoria deste ${gasto ? 'gasto' : 'ganho'}.`);
      const primeira = caixa.querySelector('input');
      if (primeira) primeira.focus();
      return;
    }

    // Cancelar aqui deixa a folha aberta com tudo o que foi digitado.
    if (gasto && !(await this.confirmarLimite(corpo))) return;

    const soltar = ocupar(document.getElementById('lancSalvar'), 'Registrando...');
    const { ok, dados } = await chamarApi('/api/transacao', { method: 'POST', body: JSON.stringify(corpo) });
    soltar();

    if (!ok) {
      avisar(dados.erro || 'Não foi possível registrar.', 'erro');
      return;
    }

    this.folha.close();
    const conta = this.contas.find((c) => c.id_conta === corpo.id_conta);
    avisar(
      !gasto
        ? `Ganho de ${formatarMoeda(valor)} registrado em "${conta.nome}".`
        : corpo.pago
          ? `Gasto de ${formatarMoeda(valor)} registrado. Saiu de "${conta.nome}".`
          : `Conta de ${formatarMoeda(valor)} anotada. Ela sai do saldo quando você marcar como paga.`
    );
    anunciarMudanca();
  },
};

// Qualquer tela pode chamar: abrirLancamento('receita')
function abrirLancamento(tipo) {
  Lancamento.abrir(tipo);
}

// ---- LIGAR TUDO ----

montarLateral();
montarTopo();
montarSino();
montarBarraDeBaixo();

// Um ouvinte só para todos os botões da casca, estejam onde estiverem.
document.addEventListener('click', (evento) => {
  if (evento.target.closest('[data-sair]')) return sair();

  const registrar = evento.target.closest('[data-registrar]');
  if (registrar) return abrirLancamento(registrar.dataset.registrar || 'despesa');

  if (evento.target.closest('[data-abrir-mais]')) abrirJanela(document.getElementById('folhaMais'));
});

// /inicio?novo=gasto (ou =ganho) abre o formulário direto. Serve para
// atalhos e para os links da página inicial.
(function () {
  const pedido = new URLSearchParams(location.search).get('novo');
  const tipo = { gasto: 'despesa', despesa: 'despesa', ganho: 'receita', receita: 'receita' }[pedido];
  if (!tipo) return;
  history.replaceState(null, '', location.pathname);
  abrirLancamento(tipo);
})();

carregarUsuario();
