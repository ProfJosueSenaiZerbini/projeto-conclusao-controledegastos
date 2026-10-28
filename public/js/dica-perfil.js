// Cartão "Dicas para você" do dashboard: mostra uma dica do perfil
// escolhido e leva para as ferramentas em /meu-perfil.
//
// Usa PERFIS (perfil-perguntas.js), CONTEUDO_PERFIS (perfil-conteudo.js)
// e PerfisSalvos (auth.js).
//
// Tudo fica dentro de uma função que roda na hora — o "(function () { ... })()".
// Assim as variáveis daqui não se misturam com as do dashboard.js, que
// é carregado na mesma página: duas variáveis com o mesmo nome no mesmo
// lugar quebrariam a tela.
(function () {
  const perfis = PerfisSalvos.ler().filter((chave) => PERFIS[chave]);

  // Sem perfil: fica a dica genérica do HTML e o link para descobrir o perfil.
  if (perfis.length === 0) return;

  // Junta as dicas de todos os perfis escolhidos e escolhe uma pelo dia do
  // mês: muda todo dia, mas não fica trocando a cada vez que a página abre.
  const todas = perfis.flatMap((chave) => CONTEUDO_PERFIS[chave].dicas.map((dica) => ({ chave, dica })));
  const { chave, dica } = todas[new Date().getDate() % todas.length];

  document.getElementById('dicaTitulo').textContent = dica.titulo;

  const corpo = document.getElementById('dicaCorpo');
  corpo.innerHTML = '';
  const item = document.createElement('li');
  item.textContent = dica.texto;
  corpo.appendChild(item);

  const link = document.getElementById('dicaLink');
  link.href = '/meu-perfil#' + chave;
  link.textContent = 'Ver ferramentas do perfil ' + PERFIS[chave].nome;
})();
