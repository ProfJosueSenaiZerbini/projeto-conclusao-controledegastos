// Tela de login: envia email e senha para POST /api/usuario/login.
// Dando certo, guarda o token e vai para o dashboard.

const formLogin = document.getElementById('formLogin');
const botaoEntrar = document.getElementById('botaoEntrar');

formLogin.addEventListener('submit', async function (event) {
  event.preventDefault();
  esconderMensagem();

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;

  if (!email || !senha) {
    mostrarMensagem('Preencha e-mail e senha.', 'erro');
    return;
  }

  botaoEntrar.disabled = true;
  botaoEntrar.textContent = 'Entrando...';

  try {
    const { ok, dados } = await chamarApi('/api/usuario/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });

    if (!ok) {
      // A API responde a mesma mensagem para email inexistente e
      // senha errada, de propósito — não entregamos ao atacante
      // a informação de quais emails existem no sistema.
      mostrarMensagem(dados.erro || 'Não foi possível entrar.', 'erro');
      return;
    }

    Sessao.salvar(dados.token, dados.id_usuario);
    window.location.href = '/dashboard';
  } catch (erro) {
    mostrarMensagem('Erro de conexão com o servidor.', 'erro');
  } finally {
    botaoEntrar.disabled = false;
    botaoEntrar.textContent = 'Entrar';
  }
});
