// Tela aberta pelo link do e-mail: /redefinir-senha?token=...
// Envia o token e a senha nova para POST /api/usuario/redefinir-senha.

const formRedefinir = document.getElementById('formRedefinir');
const botaoSalvar = document.getElementById('botaoSalvar');

// Lê o token do endereço e em seguida o apaga da barra do navegador,
// para ele não ficar no histórico nem aparecer num print da tela.
const token = new URLSearchParams(window.location.search).get('token');
history.replaceState(null, '', '/redefinir-senha');

if (!token) {
  mostrarMensagem('Link incompleto. Peça um novo link na tela "Esqueceu a senha?".', 'erro');
  formRedefinir.classList.add('hidden');
}

formRedefinir.addEventListener('submit', async function (event) {
  event.preventDefault();
  esconderMensagem();

  const senha = document.getElementById('senha').value;
  const confirmacao = document.getElementById('confirmarSenha').value;

  if (senha.length < 6) {
    mostrarMensagem('A senha deve ter no mínimo 6 caracteres.', 'erro');
    return;
  }

  // Sem a confirmação, um erro de digitação trancaria a pessoa fora da
  // conta de novo, logo depois de recuperar o acesso.
  if (senha !== confirmacao) {
    mostrarMensagem('As duas senhas não são iguais.', 'erro');
    return;
  }

  botaoSalvar.disabled = true;
  botaoSalvar.textContent = 'Salvando...';

  try {
    const { ok, dados } = await chamarApi('/api/usuario/redefinir-senha', {
      method: 'POST',
      body: JSON.stringify({ token, senha }),
    });

    if (!ok) {
      mostrarMensagem(dados.erro || 'Não foi possível alterar a senha.', 'erro');
      return;
    }

    formRedefinir.classList.add('hidden');
    mostrarMensagem('Senha alterada! Redirecionando para o login...', 'sucesso');
    setTimeout(() => (window.location.href = '/login'), 1500);
  } catch (erro) {
    mostrarMensagem('Erro de conexão com o servidor.', 'erro');
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = 'Salvar senha';
  }
});
