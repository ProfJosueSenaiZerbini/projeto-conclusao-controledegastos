// Comportamento comum a todas as telas de dentro do sistema
// (dashboard, contas, transações, metas):
//
//   1. barrar quem não tem sessão
//   2. carregar nome e avatar de quem está logado
//   3. abrir e fechar os ícones do perfil
//   4. sair
//
// Carregado ANTES do script específico de cada tela.

// ---- SESSÃO E DADOS DO USUÁRIO ----
//
// IMPORTANTE: esta checagem NÃO é segurança. Quem desligar o JavaScript
// vê o HTML da tela assim mesmo. A segurança real está no servidor:
// sem token válido a API não devolve dado nenhum e a tela fica vazia.
// Regra: quem protege dado é o servidor, nunca o cliente.

async function carregarUsuario() {
  const token = Sessao.token();
  const id = Sessao.idUsuario();

  if (!token || !id) {
    window.location.href = '/login';
    return;
  }

  try {
    const { ok, status, dados } = await chamarApi('/api/usuario/' + id);

    // 401 = token expirado ou adulterado. 403 = token de outro usuário.
    if (!ok) {
      if (status === 401 || status === 403) {
        Sessao.limpar();
        window.location.href = '/login';
      }
      return;
    }

    const nome = dados.nome_usuario;

    const campoNome = document.getElementById('nomeUsuario');
    if (campoNome) campoNome.textContent = nome.split(' ')[0];

    const avatar = document.getElementById('avatarUsuario');
    if (avatar) {
      avatar.src =
        'https://ui-avatars.com/api/?name=' +
        encodeURIComponent(nome) +
        '&background=0D8ABC&color=fff';
      avatar.alt = nome;
    }
  } catch (erro) {
    console.error('Erro de conexão:', erro);
  }
}

// ---- ESPERAR UMA ANIMAÇÃO TERMINAR ----
//
// Usado por este arquivo, pelo painel lateral e pelos modais: todos
// escondem o elemento só depois da animação de saída, senão ela seria
// cortada pelo display:none.
//
// O detalhe importante é o prazo máximo. O navegador congela animações
// quando a aba está em segundo plano ou a janela não está pintando —
// e nesse caso o evento 'animationend' NUNCA chega. Sem o prazo, o
// elemento ficaria preso na tela para sempre. Descobri isso na prática:
// com o painel de testes escondido, o relógio da animação travou em 0.
function aoTerminarAnimacao(elemento, aoFinal, prazoMaximo = 400) {
  let jaFinalizou = false;

  function finalizar() {
    if (jaFinalizou) return;
    jaFinalizou = true;

    clearTimeout(temporizador);
    elemento.removeEventListener('animationend', finalizar);
    aoFinal();
  }

  const temporizador = setTimeout(finalizar, prazoMaximo);
  elemento.addEventListener('animationend', finalizar);
}

// ---- ÍCONES DO PERFIL ----

const CLASSES_ANEL = ['ring-2', 'ring-blue-400', 'ring-offset-2'];
const semAnimacao = window.matchMedia('(prefers-reduced-motion: reduce)');

const perfilToggle = document.getElementById('perfilToggle');
const acoesPerfil = document.getElementById('acoesPerfil');

function esconderAcoes() {
  acoesPerfil.classList.remove('flex', 'recolhendo');
  acoesPerfil.classList.add('hidden');
}

function abrirAcoesPerfil() {
  acoesPerfil.classList.remove('hidden', 'recolhendo');
  acoesPerfil.classList.add('flex');
  perfilToggle.classList.add(...CLASSES_ANEL);
  perfilToggle.setAttribute('aria-expanded', 'true');
}

function fecharAcoesPerfil() {
  perfilToggle.classList.remove(...CLASSES_ANEL);
  perfilToggle.setAttribute('aria-expanded', 'false');

  // Sem animação, 'animationend' nunca dispara — esconde direto.
  if (semAnimacao.matches) {
    esconderAcoes();
    return;
  }

  acoesPerfil.classList.add('recolhendo');

  aoTerminarAnimacao(acoesPerfil, function () {
    // Se reabriu no meio da animação, 'recolhendo' já saiu: não esconder.
    if (acoesPerfil.classList.contains('recolhendo')) esconderAcoes();
  });
}

if (perfilToggle && acoesPerfil) {
  perfilToggle.addEventListener('click', function () {
    const fechado =
      acoesPerfil.classList.contains('hidden') ||
      acoesPerfil.classList.contains('recolhendo');

    if (fechado) abrirAcoesPerfil();
    else fecharAcoesPerfil();
  });
}

// ---- SAIR ----

const botaoSair = document.getElementById('botaoSair');
if (botaoSair) {
  botaoSair.addEventListener('click', function () {
    Sessao.limpar();
    window.location.href = '/login';
  });
}

carregarUsuario();
