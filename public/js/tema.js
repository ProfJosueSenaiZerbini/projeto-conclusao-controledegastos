// Tema claro / escuro / sistema.
//
// A escolha é feita em Configurações > Aparência e fica guardada no
// localStorage, no mesmo objeto "preferencias_<id>" que o configuracoes.js
// já usa para as notificações.
//
// Este arquivo é carregado no <head> de cada tela, ANTES do conteúdo
// aparecer. Se fosse carregado no fim do <body>, a tela abriria branca e
// só depois ficaria escura (um "piscar" bem visível).
//
// Como funciona: quando o tema é escuro, a tag <html> ganha a classe
// "escuro". O arquivo /css/tema.css troca as cores só quando essa classe
// existe. Nenhuma tela precisou ser reescrita.

(function () {
  // Pergunta ao navegador se o sistema operacional está no modo escuro.
  const midiaEscura = window.matchMedia('(prefers-color-scheme: dark)');

  function temaSalvo() {
    try {
      const id = localStorage.getItem('id_usuario');
      const preferencias = JSON.parse(localStorage.getItem('preferencias_' + id)) || {};
      return preferencias.tema || 'claro';
    } catch (e) {
      // localStorage bloqueado ou com dado inválido: segue no claro.
      return 'claro';
    }
  }

  // tema: 'claro', 'escuro' ou 'sistema'. Sem parâmetro, usa o salvo.
  function aplicarTema(tema) {
    tema = tema || temaSalvo();
    const escuro = tema === 'escuro' || (tema === 'sistema' && midiaEscura.matches);
    document.documentElement.classList.toggle('escuro', escuro);
  }

  // No modo "Sistema", acompanha o Windows se ele trocar de tema
  // com a página aberta.
  midiaEscura.addEventListener('change', function () {
    if (temaSalvo() === 'sistema') aplicarTema('sistema');
  });

  // Deixa a função disponível para o configuracoes.js aplicar o tema
  // na hora em que o usuário clica, sem recarregar a página.
  window.aplicarTema = aplicarTema;

  aplicarTema();
})();
