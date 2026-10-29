// Preferências de aparência: tema (claro/escuro/sistema) e tamanho da letra.
//
// As duas moram no mesmo arquivo porque precisam da mesma coisa: serem
// aplicadas no <head>, ANTES de a página aparecer. Separar em dois
// arquivos só somaria mais uma requisição em cada tela.
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

  // Lê uma preferência salva. Devolve o padrão se não houver escolha,
  // ou se o localStorage estiver bloqueado / com dado inválido.
  function preferencia(nome, padrao) {
    try {
      const id = localStorage.getItem('id_usuario');
      const preferencias = JSON.parse(localStorage.getItem('preferencias_' + id)) || {};
      return preferencias[nome] || padrao;
    } catch (e) {
      return padrao;
    }
  }

  function temaSalvo() {
    return preferencia('tema', 'claro');
  }

  // Telas com visual próprio, que não têm versão escura no tema.css (a
  // pesquisa de perfil, com as cores verdes do modelo do grupo), marcam
  // <html data-sem-tema>. Nelas vale só o tamanho da letra.
  const semTema = document.documentElement.hasAttribute('data-sem-tema');

  // tema: 'claro', 'escuro' ou 'sistema'. Sem parâmetro, usa o salvo.
  function aplicarTema(tema) {
    if (semTema) return;
    tema = tema || temaSalvo();
    const escuro = tema === 'escuro' || (tema === 'sistema' && midiaEscura.matches);
    document.documentElement.classList.toggle('escuro', escuro);
  }

  // No modo "Sistema", acompanha o Windows se ele trocar de tema
  // com a página aberta.
  midiaEscura.addEventListener('change', function () {
    if (temaSalvo() === 'sistema') aplicarTema('sistema');
  });

  // ---- TAMANHO DA LETRA ----
  //
  // Para quem tem dificuldade de enxergar letras pequenas.
  //
  // Funciona mudando o tamanho da fonte da tag <html>. Isso basta porque
  // o Tailwind mede quase tudo em "rem" — uma unidade que é sempre um
  // múltiplo do tamanho do <html>. Assim, uma única linha aumenta textos,
  // ícones e espaçamentos juntos, mantendo a proporção.
  //
  // A alternativa seria reescrever o tamanho de cada classe de texto do
  // sistema, uma por uma. Além de muito maior, quebraria toda vez que
  // alguém usasse uma classe nova numa tela.

  const TAMANHOS = {
    normal: '100%',
    grande: '112.5%',
    maior: '125%',
  };

  function aplicarFonte(fonte) {
    fonte = fonte || preferencia('fonte', 'normal');
    document.documentElement.style.fontSize = TAMANHOS[fonte] || TAMANHOS.normal;
  }

  // Deixa as funções disponíveis para o configuracoes.js aplicar na hora
  // em que o usuário clica, sem recarregar a página.
  window.aplicarTema = aplicarTema;
  window.aplicarFonte = aplicarFonte;

  aplicarTema();
  aplicarFonte();
})();
