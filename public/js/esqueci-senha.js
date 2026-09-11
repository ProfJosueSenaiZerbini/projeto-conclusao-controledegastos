// Tela "Esqueceu a senha?": pede o e-mail e chama
// POST /api/usuario/esqueci-senha, que envia o link de redefinição.

const formEsqueci = document.getElementById('formEsqueci');
const botaoEnviar = document.getElementById('botaoEnviar');

formEsqueci.addEventListener('submit', async function (event) {
  event.preventDefault();
  esconderMensagem();

  const email = document.getElementById('email').value.trim();

  if (!email) {
    mostrarMensagem('Informe o seu e-mail.', 'erro');
    return;
  }

  botaoEnviar.disabled = true;
  botaoEnviar.textContent = 'Enviando...';

  try {
    const { ok, dados } = await chamarApi('/api/usuario/esqueci-senha', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (!ok) {
      mostrarMensagem(dados.erro || 'Não foi possível enviar o link.', 'erro');
      return;
    }

    // A API responde a mesma coisa exista o e-mail ou não, então a tela
    // também não tem como saber — e só repete a mensagem dela.
    mostrarMensagem(dados.mensagem, 'sucesso');
    formEsqueci.classList.add('hidden');
  } catch (erro) {
    mostrarMensagem('Erro de conexão com o servidor.', 'erro');
  } finally {
    botaoEnviar.disabled = false;
    botaoEnviar.textContent = 'Enviar link';
  }
});
