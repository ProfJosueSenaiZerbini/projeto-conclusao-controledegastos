// Tela aberta pelo link que chega no endereço NOVO.
//
// A troca de e-mail só acontece aqui: até alguém clicar neste link e
// confirmar, a conta continua com o endereço antigo. É isso que impede
// que um erro de digitação — ou alguém que pegou a sessão aberta —
// tranque o dono para fora da própria conta.

const subtitulo = document.getElementById('subtitulo');
const botaoConfirmar = document.getElementById('botaoConfirmar');

// O token vem no endereço: /confirmar-email?token=...
const token = new URLSearchParams(window.location.search).get('token');

// Conferir antes de mostrar o botão: não adianta a pessoa clicar para
// descobrir só depois que o link já tinha expirado.
async function verificarLink() {
  if (!token) {
    subtitulo.textContent = 'Link inválido.';
    mostrarMensagem('Este endereço não tem um token de confirmação.', 'erro');
    return;
  }

  const { ok, dados } = await chamarApi('/api/usuario/confirmar-email/verificar', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

  if (!ok) {
    subtitulo.textContent = 'Link expirado.';
    mostrarMensagem(dados.erro || 'Este link não vale mais.', 'erro');
    return;
  }

  subtitulo.textContent = 'Confirme para passar a usar este endereço:';
  mostrarMensagem(dados.email_novo, 'sucesso');
  botaoConfirmar.classList.remove('hidden');
}

botaoConfirmar.addEventListener('click', async function () {
  botaoConfirmar.disabled = true;
  botaoConfirmar.textContent = 'Confirmando...';

  const { ok, dados } = await chamarApi('/api/usuario/confirmar-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

  if (!ok) {
    botaoConfirmar.disabled = false;
    botaoConfirmar.textContent = 'Confirmar meu novo e-mail';
    mostrarMensagem(dados.erro || 'Não foi possível confirmar.', 'erro');
    return;
  }

  botaoConfirmar.classList.add('hidden');
  subtitulo.textContent = 'Pronto!';
  mostrarMensagem(
    `Seu e-mail agora é ${dados.email}. Use ele para entrar a partir de agora.`,
    'sucesso'
  );

  // A sessão antiga pode estar aberta em outro aparelho com o e-mail
  // velho na tela. Limpar aqui evita confusão na próxima visita.
  Sessao.limpar();

  setTimeout(() => (window.location.href = '/login'), 3000);
});

verificarLink();
