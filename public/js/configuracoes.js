// Tela de Configurações.
//
// As categorias (Perfil, Notificações...) abrem e fecham sozinhas pelo
// <details> do HTML. Este arquivo só cuida do que cada uma faz:
//
//   Perfil           -> GET e PUT /api/usuario/:id
//   Contas e Cartões -> GET /api/usuario/:id/conta (lista resumida)
//   Categorias       -> GET, POST, PUT e DELETE /api/categoria
//   Segurança        -> POST /api/usuario/esqueci-senha (mesmo fluxo da tela de login)
//   Notificações e Aparência -> guardadas no navegador (ver PREFERÊNCIAS)

const idUsuario = Sessao.idUsuario();

const formPerfil = document.getElementById('formPerfil');
const salvarPerfil = document.getElementById('salvarPerfil');
const nomePerfil = document.getElementById('nomePerfil');
const emailPerfil = document.getElementById('emailPerfil');
const documentoPerfil = document.getElementById('documentoPerfil');

// Escapa caracteres perigosos antes de jogar texto no HTML.
function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// ---- PERFIL ----

// Guarda o que veio do servidor para, na hora de salvar, mandar só o
// que mudou. Assim, trocar só o nome não reenvia (nem revalida) o CPF.
let perfilOriginal = {};

async function carregarPerfil() {
  const { ok, dados } = await chamarApi('/api/usuario/' + idUsuario);
  if (!ok) return;

  perfilOriginal = dados;
  nomePerfil.value = dados.nome_usuario;
  emailPerfil.value = dados.email;
  // O campo de CPF/CNPJ foi tirado da tela; o "if" evita erro se ele não existir.
  if (documentoPerfil) documentoPerfil.value = dados.cpf_cnpj;
  document.getElementById('emailSeguranca').textContent = dados.email;
  document.getElementById('membroDesde').textContent =
    'Membro desde ' + formatarData(dados.data_cadastro);
}

formPerfil.addEventListener('submit', async function (event) {
  event.preventDefault();
  esconderMensagem();

  const nome = nomePerfil.value.trim();
  const documento = documentoPerfil
    ? documentoPerfil.value.replace(/\D/g, '')
    : perfilOriginal.cpf_cnpj;

  if (!nome || !documento) {
    mostrarMensagem('Preencha nome e CPF/CNPJ.', 'erro');
    return;
  }

  // O e-mail não entra aqui: ele tem o fluxo próprio mais abaixo, que
  // pede a senha atual e confirma por link. Mandar o e-mail neste PUT
  // agora é recusado pelo servidor de propósito.
  const alterados = {};
  if (nome !== perfilOriginal.nome_usuario) alterados.nome_usuario = nome;
  if (documento !== perfilOriginal.cpf_cnpj) alterados.cpf_cnpj = documento;

  if (Object.keys(alterados).length === 0) {
    mostrarMensagem('Nada foi alterado.', 'sucesso');
    return;
  }

  salvarPerfil.disabled = true;
  salvarPerfil.textContent = 'Salvando...';

  try {
    // As validações de verdade (e-mail repetido, CPF inválido) estão no
    // servidor. A tela só repete a mensagem que ele devolve.
    const { ok, dados } = await chamarApi('/api/usuario/' + idUsuario, {
      method: 'PUT',
      body: JSON.stringify(alterados),
    });

    if (!ok) {
      mostrarMensagem(dados.erro || 'Não foi possível salvar.', 'erro');
      return;
    }

    mostrarMensagem('Perfil atualizado.', 'sucesso');
    await carregarPerfil();
    // Atualiza nome e avatar do cabeçalho, que vêm do layout.js.
    carregarUsuario();
  } catch (erro) {
    mostrarMensagem('Erro de conexão com o servidor.', 'erro');
  } finally {
    salvarPerfil.disabled = false;
    salvarPerfil.textContent = 'Salvar alterações';
  }
});

// ---- TROCAR E-MAIL ----
//
// Fluxo separado do resto do perfil porque o e-mail é a chave da conta:
// quem troca o e-mail consegue, logo em seguida, pedir "esqueci a senha"
// e receber o link na própria caixa.
//
// São duas barreiras: a senha atual (que um token roubado não dá) e a
// confirmação por link no endereço novo. A troca só vale depois do clique.

const formTrocarEmail = document.getElementById('formTrocarEmail');
const emailNovo = document.getElementById('emailNovo');
const senhaAtual = document.getElementById('senhaAtual');
const pedirTrocaEmail = document.getElementById('pedirTrocaEmail');
const mensagemEmail = document.getElementById('mensagemEmail');

// ---- ABRIR E FECHAR O MODAL ----
//
// Mesma mecânica do modal.js e do painel lateral: alterna 'hidden' e
// 'flex', e ao fechar espera a animação de saída terminar antes de
// esconder de verdade — senão ela seria cortada pelo display:none.
//
// O prazo máximo existe porque o navegador congela animações em abas em
// segundo plano, e aí o evento 'animationend' nunca chega. Sem ele, o
// modal ficaria preso na tela atrás do fundo escuro.

const fundoEmail = document.getElementById('fundoEmail');
const caixaEmail = document.getElementById('caixaEmail');
const emailAtualModal = document.getElementById('emailAtualModal');
const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');

function esconderModalEmail() {
  caixaEmail.classList.remove('flex', 'recolhendo');
  caixaEmail.classList.add('hidden');
  fundoEmail.classList.remove('recolhendo');
  fundoEmail.classList.add('hidden');
}

function abrirModalEmail() {
  // Começa limpo: senha digitada antes não pode ficar na tela, e um
  // aviso de erro de uma tentativa anterior confundiria.
  formTrocarEmail.reset();
  mensagemEmail.className = 'hidden';
  emailAtualModal.textContent = perfilOriginal.email || '';

  caixaEmail.classList.remove('hidden', 'recolhendo');
  caixaEmail.classList.add('flex');
  fundoEmail.classList.remove('hidden', 'recolhendo');

  emailNovo.focus();
}

function fecharModalEmail() {
  if (caixaEmail.classList.contains('hidden')) return;

  if (semMovimento.matches) {
    esconderModalEmail();
    return;
  }

  caixaEmail.classList.add('recolhendo');
  fundoEmail.classList.add('recolhendo');

  let jaEscondeu = false;
  const esconderUmaVez = () => {
    if (jaEscondeu) return;
    jaEscondeu = true;
    clearTimeout(prazo);
    caixaEmail.removeEventListener('animationend', esconderUmaVez);
    if (caixaEmail.classList.contains('recolhendo')) esconderModalEmail();
  };

  const prazo = setTimeout(esconderUmaVez, 400);
  caixaEmail.addEventListener('animationend', esconderUmaVez);
}

document.getElementById('abrirTrocaEmail')?.addEventListener('click', abrirModalEmail);
document.getElementById('fecharTrocaEmail')?.addEventListener('click', fecharModalEmail);
document.getElementById('cancelarTrocaEmail')?.addEventListener('click', fecharModalEmail);
fundoEmail?.addEventListener('click', fecharModalEmail);

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') fecharModalEmail();
});

// Esta seção tem caixa de mensagem própria: a do topo fica longe do
// formulário, e o aviso passaria despercebido.
function avisoEmail(texto, tipo) {
  const cores = {
    erro: 'bg-red-50 text-red-700 border border-red-200',
    sucesso: 'bg-green-50 text-green-700 border border-green-200',
  };
  // Sem margem no topo: dentro do modal, a mensagem é o primeiro
  // elemento do formulário e o espaçamento já vem do `space-y`.
  mensagemEmail.className = 'px-4 py-3 rounded-xl text-sm ' + (cores[tipo] || cores.erro);
  mensagemEmail.textContent = texto;
}

if (formTrocarEmail) {
  formTrocarEmail.addEventListener('submit', async function (event) {
    event.preventDefault();
    mensagemEmail.className = 'hidden';

    const novo = emailNovo.value.trim();
    const senha = senhaAtual.value;

    if (!novo || !senha) {
      avisoEmail('Preencha o e-mail novo e sua senha atual.', 'erro');
      return;
    }

    pedirTrocaEmail.disabled = true;
    pedirTrocaEmail.textContent = 'Enviando...';

    try {
      const { ok, dados } = await chamarApi('/api/usuario/' + idUsuario + '/email', {
        method: 'POST',
        body: JSON.stringify({ email_novo: novo, senha_atual: senha }),
      });

      if (!ok) {
        avisoEmail(dados.erro || 'Não foi possível pedir a troca.', 'erro');
        return;
      }

      avisoEmail(dados.mensagem, 'sucesso');

      // A senha some da tela assim que deixa de ser necessária.
      formTrocarEmail.reset();
    } catch (erro) {
      avisoEmail('Erro de conexão com o servidor.', 'erro');
    } finally {
      pedirTrocaEmail.disabled = false;
      pedirTrocaEmail.textContent = 'Enviar link';
    }
  });
}

// ---- CONTAS E CARTÕES ----
// Aqui é só um resumo. Criar, editar e excluir continua na tela de
// Contas, para a mesma regra não existir em dois lugares.

async function carregarContas() {
  const lista = document.getElementById('listaContas');
  const { ok, dados } = await chamarApi('/api/usuario/' + idUsuario + '/conta');

  if (!ok || dados.length === 0) {
    lista.innerHTML = '<li class="py-3 text-sm text-gray-500">Nenhuma conta cadastrada.</li>';
    return;
  }

  lista.innerHTML = dados
    .map(
      (conta) => `
      <li class="flex justify-between items-center py-3">
        <span class="text-sm text-gray-700"><i class="fa-regular fa-credit-card text-gray-400 mr-2"></i>${escapar(conta.nome)}</span>
        <span class="text-sm font-semibold text-gray-900">${formatarMoeda(conta.saldo)}</span>
      </li>`
    )
    .join('');
}

// ---- CATEGORIAS ----
//
// Só as categorias PERSONALIZADAS aparecem na lista: as do Verdanz são
// fixas e não têm o que gerenciar. As regras de verdade (nome repetido,
// tipo que não pode trocar) estão no servidor; a tela só repete a
// mensagem que ele devolve.

const formCategoria = document.getElementById('formCategoria');
const idCategoria = document.getElementById('idCategoria');
const nomeCategoria = document.getElementById('nomeCategoria');
const tipoCategoria = document.getElementById('tipoCategoria');
const avisoTipoCategoria = document.getElementById('avisoTipoCategoria');
const tituloFormCategoria = document.getElementById('tituloFormCategoria');
const salvarCategoria = document.getElementById('salvarCategoria');
const cancelarCategoria = document.getElementById('cancelarCategoria');
const listaCategorias = document.getElementById('listaCategorias');

let todasCategorias = [];

const NOME_TIPO = { despesa: 'Gasto', receita: 'Ganho' };

function linhaCategoria(c) {
  const corTipo = c.tipo === 'receita' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600';
  const quantas = c.total_transacoes === 1 ? '1 transação' : `${c.total_transacoes} transações`;

  return `
    <li class="flex items-center justify-between gap-3 py-3">
      <span class="min-w-0">
        <span class="block text-sm font-medium text-gray-800 truncate">${escapar(c.nome_categoria)}</span>
        <span class="text-xs text-gray-400">
          <span class="inline-block px-2 py-0.5 rounded-full text-[0.6875rem] font-medium ${corTipo}">${NOME_TIPO[c.tipo]}</span>
          · ${quantas}
        </span>
      </span>
      <span class="flex items-center gap-1 flex-shrink-0">
        <button type="button" data-editar-categoria="${c.id_categoria}" title="Editar categoria"
                class="w-9 h-9 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
          <i class="fa-solid fa-pen text-xs"></i>
        </button>
        <button type="button" data-excluir-categoria="${c.id_categoria}" title="Excluir categoria"
                class="w-9 h-9 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <i class="fa-solid fa-trash text-xs"></i>
        </button>
      </span>
    </li>`;
}

async function carregarCategorias() {
  const { ok, dados } = await chamarApi('/api/categoria');
  if (!ok) return;

  todasCategorias = dados;
  const minhas = dados.filter((c) => c.personalizada);

  listaCategorias.innerHTML =
    minhas.length === 0
      ? '<li class="py-3 text-sm text-gray-500">Você ainda não criou nenhuma categoria.</li>'
      : minhas.map(linhaCategoria).join('');
}

// Volta o formulário para "Nova categoria".
function limparFormCategoria() {
  formCategoria.reset();
  idCategoria.value = '';
  tipoCategoria.disabled = false;
  avisoTipoCategoria.classList.add('hidden');
  cancelarCategoria.classList.add('hidden');
  tituloFormCategoria.textContent = 'Nova categoria';
  salvarCategoria.innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Criar categoria';
}

function editarCategoria(categoria) {
  idCategoria.value = categoria.id_categoria;
  nomeCategoria.value = categoria.nome_categoria;
  tipoCategoria.value = categoria.tipo;

  // Com transações, trocar o tipo inverteria o efeito delas no saldo.
  // O servidor recusa; a tela já trava o campo e explica o porquê.
  const temTransacoes = categoria.total_transacoes > 0;
  tipoCategoria.disabled = temTransacoes;
  avisoTipoCategoria.classList.toggle('hidden', !temTransacoes);

  cancelarCategoria.classList.remove('hidden');
  tituloFormCategoria.textContent = `Editando "${categoria.nome_categoria}"`;
  salvarCategoria.textContent = 'Salvar alterações';
  nomeCategoria.focus();
}

async function excluirCategoria(categoria) {
  let url = '/api/categoria/' + categoria.id_categoria;
  let aviso = 'Essa ação não pode ser desfeita.';

  // Uma transação não pode ficar sem categoria. As dela vão para a
  // categoria "Outras" do mesmo tipo, e o saldo não muda.
  if (categoria.total_transacoes > 0) {
    const nomeDestino = categoria.tipo === 'receita' ? 'Outras receitas' : 'Outras despesas';
    const destino = todasCategorias.find((c) => !c.personalizada && c.nome_categoria === nomeDestino);

    if (!destino) {
      mostrarMensagem(`Não encontramos a categoria "${nomeDestino}" para receber as transações.`, 'erro');
      return;
    }

    url += '?mover_para=' + destino.id_categoria;
    const quantas = categoria.total_transacoes === 1 ? 'A transação dela vai' : `As ${categoria.total_transacoes} transações dela vão`;
    aviso = `${quantas} para "${nomeDestino}". Nenhum saldo muda.`;
  }

  const confirmou = await confirmar({
    titulo: `Excluir "${categoria.nome_categoria}"?`,
    mensagem: 'Se ela tiver um limite de gasto, ele também será removido.',
    aviso,
    textoConfirmar: 'Excluir categoria',
  });

  if (!confirmou) return;

  const { ok, dados } = await chamarApi(url, { method: 'DELETE' });

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível excluir a categoria.', 'erro');
    return;
  }

  mostrarMensagem(
    dados.transacoes_movidas > 0
      ? `Categoria excluída. ${dados.transacoes_movidas} ${dados.transacoes_movidas === 1 ? 'transação foi' : 'transações foram'} para "${dados.movidas_para}".`
      : 'Categoria excluída.',
    'sucesso'
  );

  // Se ela estava aberta no formulário, o formulário volta ao normal.
  if (Number(idCategoria.value) === categoria.id_categoria) limparFormCategoria();
  carregarCategorias();
}

// Um único "ouvinte" na lista inteira: ela é redesenhada a cada mudança,
// e assim nada precisa ser religado.
listaCategorias.addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-editar-categoria], [data-excluir-categoria]');
  if (!botao) return;

  const editar = 'editarCategoria' in botao.dataset;
  const id = Number(editar ? botao.dataset.editarCategoria : botao.dataset.excluirCategoria);
  const categoria = todasCategorias.find((c) => c.id_categoria === id);
  if (!categoria) return;

  if (editar) editarCategoria(categoria);
  else excluirCategoria(categoria);
});

cancelarCategoria.addEventListener('click', limparFormCategoria);

formCategoria.addEventListener('submit', async function (evento) {
  evento.preventDefault();
  esconderMensagem();

  const nome = nomeCategoria.value.trim();
  if (!nome) {
    mostrarMensagem('Dê um nome para a categoria.', 'erro');
    return;
  }

  const editando = idCategoria.value !== '';
  const corpo = { nome_categoria: nome };
  // Campo travado não é enviado: o tipo daquela categoria não muda.
  if (!tipoCategoria.disabled) corpo.tipo = tipoCategoria.value;

  salvarCategoria.disabled = true;

  const { ok, dados } = await chamarApi(editando ? '/api/categoria/' + idCategoria.value : '/api/categoria', {
    method: editando ? 'PUT' : 'POST',
    body: JSON.stringify(corpo),
  });

  salvarCategoria.disabled = false;

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível salvar a categoria.', 'erro');
    return;
  }

  mostrarMensagem(editando ? 'Categoria atualizada.' : `Categoria "${dados.nome_categoria}" criada.`, 'sucesso');
  limparFormCategoria();
  carregarCategorias();
});

// ---- SEGURANÇA ----
// Reaproveita o "esqueci a senha": o link chega no e-mail e abre a tela
// /redefinir-senha. Pedir a confirmação por e-mail garante que, se alguém
// pegar o computador com a sessão aberta, não consegue trocar a senha.

const enviarLinkSenha = document.getElementById('enviarLinkSenha');

enviarLinkSenha.addEventListener('click', async function () {
  esconderMensagem();
  enviarLinkSenha.disabled = true;

  try {
    const { ok, dados } = await chamarApi('/api/usuario/esqueci-senha', {
      method: 'POST',
      body: JSON.stringify({ email: perfilOriginal.email }),
    });

    if (!ok) {
      mostrarMensagem(dados.erro || 'Não foi possível enviar o link.', 'erro');
      enviarLinkSenha.disabled = false;
      return;
    }

    mostrarMensagem('Link enviado! Confira sua caixa de entrada.', 'sucesso');
    // Fica desligado um tempo para evitar vários e-mails seguidos.
    setTimeout(() => (enviarLinkSenha.disabled = false), 30000);
  } catch (erro) {
    mostrarMensagem('Erro de conexão com o servidor.', 'erro');
    enviarLinkSenha.disabled = false;
  }
});

// ---- PREFERÊNCIAS (Notificações e Aparência) ----
//
// Ainda não existe tabela no banco para isso, então as escolhas ficam
// no localStorage, separadas por usuário. Consequência: valem só neste
// navegador. Se um dia forem para o banco, só estas duas funções mudam.

const chavePreferencias = 'preferencias_' + idUsuario;

function lerPreferencias() {
  try {
    return JSON.parse(localStorage.getItem(chavePreferencias)) || {};
  } catch (e) {
    return {};
  }
}

function salvarPreferencia(nome, valor) {
  const preferencias = lerPreferencias();
  preferencias[nome] = valor;
  localStorage.setItem(chavePreferencias, JSON.stringify(preferencias));
}

function carregarPreferencias() {
  const preferencias = lerPreferencias();

  document.querySelectorAll('[data-preferencia]').forEach(function (caixa) {
    // Sem escolha salva, o aviso nasce ligado.
    caixa.checked = preferencias[caixa.dataset.preferencia] !== false;
    caixa.addEventListener('change', function () {
      salvarPreferencia(caixa.dataset.preferencia, caixa.checked);
    });
  });

  const temaAtual = preferencias.tema || 'claro';
  document.querySelectorAll('input[name="tema"]').forEach(function (opcao) {
    opcao.checked = opcao.value === temaAtual;
    opcao.addEventListener('change', function () {
      salvarPreferencia('tema', opcao.value);
      // tema.js: troca as cores na hora, sem recarregar a página.
      aplicarTema(opcao.value);
    });
  });

  const fonteAtual = preferencias.fonte || 'normal';
  document.querySelectorAll('input[name="fonte"]').forEach(function (opcao) {
    opcao.checked = opcao.value === fonteAtual;
    opcao.addEventListener('change', function () {
      salvarPreferencia('fonte', opcao.value);
      // tema.js: muda o tamanho na hora, para a pessoa ver o resultado
      // enquanto escolhe, em vez de ter que navegar para outra tela.
      aplicarFonte(opcao.value);
    });
  });
}

carregarPerfil();
carregarContas();
carregarCategorias();
carregarPreferencias();
