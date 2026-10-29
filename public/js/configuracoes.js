// Tela de Configurações.
//
// As categorias (Perfil, Notificações...) abrem e fecham sozinhas pelo
// <details> do HTML. Este arquivo só cuida do que cada uma faz:
//
//   Perfil           -> GET e PUT /api/usuario/:id
//   Contas e Cartões -> GET /api/usuario/:id/conta (lista resumida)
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
carregarPreferencias();
