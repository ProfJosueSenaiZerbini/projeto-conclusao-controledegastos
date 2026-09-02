// Dashboard: confirma que há sessão válida e mostra o nome real do usuário.
//
// IMPORTANTE — isto NÃO é segurança de verdade.
// Qualquer pessoa vê o HTML desta tela desligando o JavaScript.
// A segurança real está no servidor: sem token válido, a API não
// devolve dado nenhum e a tela fica vazia.
// Regra: quem protege dado é o servidor, nunca o cliente.

async function carregarUsuario() {
  const token = Sessao.token();
  const id = Sessao.idUsuario();

  // Nem token guardado? Nunca logou (ou já saiu). Volta para o login.
  if (!token || !id) {
    window.location.href = '/login';
    return;
  }

  try {
    // O chamarApi() já anexa o header Authorization: Bearer <token>.
    const { ok, status, dados } = await chamarApi('/api/usuario/' + id);

    // 401 = token expirado/adulterado. 403 = token de outro usuário.
    // Nos dois casos a sessão não presta: limpa e manda para o login.
    if (!ok) {
      if (status === 401 || status === 403) {
        Sessao.limpar();
        window.location.href = '/login';
        return;
      }
      console.error('Erro ao carregar usuário:', dados.erro);
      return;
    }

    // Só aqui o nome é REAL: veio do banco, através de uma rota protegida.
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

function sair() {
  Sessao.limpar();
  window.location.href = '/login';
}

const botaoSair = document.getElementById('botaoSair');
if (botaoSair) botaoSair.addEventListener('click', sair);

carregarUsuario();
