// Abrir e fechar o painel lateral (drawer).
//
// A mecânica é a mesma dos ícones do perfil: as classes 'hidden' e 'flex'
// do Tailwind são alternadas por JavaScript, e o fechamento espera a
// animação de saída terminar antes de aplicar o display:none — senão a
// animação seria cortada no meio.
//
// Recebe o painel e o fundo escuro por parâmetro, então serve para os
// painéis de conta, transação e meta sem alteração.

function criarPainel(idPainel, idFundo) {
  const painel = document.getElementById(idPainel);
  const fundo = document.getElementById(idFundo);
  const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!painel || !fundo) return null;

  function esconder() {
    painel.classList.remove('flex', 'recolhendo');
    painel.classList.add('hidden');
    fundo.classList.remove('recolhendo');
    fundo.classList.add('hidden');
  }

  function abrir() {
    painel.classList.remove('hidden', 'recolhendo');
    painel.classList.add('flex');
    fundo.classList.remove('hidden', 'recolhendo');

    // Foca o primeiro campo para quem abriu já poder digitar.
    const primeiro = painel.querySelector('input:not([type="hidden"]), select');
    if (primeiro) primeiro.focus();
  }

  function fechar() {
    if (painel.classList.contains('hidden')) return;

    if (semMovimento.matches) {
      esconder();
      return;
    }

    painel.classList.add('recolhendo');
    fundo.classList.add('recolhendo');

    // aoTerminarAnimacao vem de layout.js e tem prazo máximo: se o
    // navegador congelar a animação (aba em segundo plano), o painel
    // some assim mesmo em vez de ficar preso na tela.
    aoTerminarAnimacao(painel, function () {
      // Reabriu no meio da animação? 'recolhendo' já saiu: não esconder.
      if (painel.classList.contains('recolhendo')) esconder();
    });
  }

  // Clicar no fundo escuro fecha — comportamento que todo mundo espera.
  fundo.addEventListener('click', fechar);

  // Esc também fecha.
  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape') fechar();
  });

  return { abrir, fechar };
}
