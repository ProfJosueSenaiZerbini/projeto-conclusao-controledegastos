// Menu principal das telas de dentro do sistema.
//
// ANTES: o menu estava escrito à mão, copiado em 6 arquivos HTML. Para
// mudar um item (o nome, a ordem, um ícone) era preciso editar os 6, e
// bastava esquecer um para o site ficar diferente de uma tela para outra.
//
// AGORA: existe UMA lista (ITENS_MENU, logo abaixo). Este script lê a
// lista e monta duas coisas com ela:
//
//   1. o menu da barra lateral (computador, e celular ao tocar em "Mais");
//   2. a barra fixa na parte de baixo da tela (só no celular).
//
// Quem diz qual item está "aceso" é o endereço da página (location.pathname).
// Assim nenhuma tela precisa lembrar de marcar o próprio item.
//
// Este arquivo precisa ser carregado ANTES do layout.js: o layout.js liga
// os botões "Mais" (id abrirMenu) e "Sair" (id botaoSair), que nascem aqui.

const ITENS_MENU = [
  // celular: true = aparece também na barra de baixo do celular (só 4 cabem).
  { href: '/dashboard', texto: 'Início', icone: 'fa-solid fa-house', celular: true },
  { href: '/contas', texto: 'Contas', icone: 'fa-solid fa-wallet', celular: true },
  { href: '/transacoes', texto: 'Transações', icone: 'fa-solid fa-right-left', celular: true },
  { href: '/metas', texto: 'Metas', icone: 'fa-solid fa-bullseye', celular: true },
  { href: '/meu-perfil', texto: 'Meu perfil', icone: 'fa-solid fa-user-gear' },
  { href: '/configuracoes', texto: 'Configurações', icone: 'fa-solid fa-gear' },
  // Ainda não existe: aparece com o selo "Em breve" e não é clicável.
  { texto: 'Planejamento', icone: 'fa-regular fa-calendar', emBreve: true },
];

(function () {
  const paginaAtual = location.pathname;

  // aria-current="page" faz duas coisas: o CSS (verdanz.css) pinta o item
  // de azul, e o leitor de tela anuncia "página atual" para quem não enxerga.
  function marcaAtual(item) {
    return item.href === paginaAtual ? ' aria-current="page"' : '';
  }

  // ---- 1. MENU DA BARRA LATERAL ----

  const menu = document.getElementById('menuPrincipal');

  if (menu) {
    const itens = ITENS_MENU.map(function (item) {
      if (item.emBreve) {
        // <span> e não <a>: sem link, o item não engana ninguém com um
        // clique que não leva a lugar nenhum.
        return `
          <span class="menu-item em-breve" aria-disabled="true">
            <i class="${item.icone}" aria-hidden="true"></i>
            <span>${item.texto}<span class="selo-em-breve">Em breve</span></span>
          </span>`;
      }

      return `
        <a href="${item.href}" class="menu-item"${marcaAtual(item)}>
          <i class="${item.icone}" aria-hidden="true"></i> ${item.texto}
        </a>`;
    });

    // "Sair" fica sempre à vista no fim do menu. Antes ele só aparecia
    // depois de clicar na foto do perfil, e muita gente não descobria.
    menu.innerHTML =
      itens.join('') +
      `<div class="menu-divisoria" role="separator"></div>
       <button type="button" id="botaoSair" class="menu-item sair">
         <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Sair
       </button>`;
  }

  // ---- 2. BARRA DE BAIXO (CELULAR) ----

  const doCelular = ITENS_MENU.filter((item) => item.celular);

  // Em Meu perfil e Configurações (que não têm botão próprio na barra),
  // o "Mais" fica aceso: é por ele que a pessoa chegou ali.
  const estaNoMais = !doCelular.some((item) => item.href === paginaAtual);

  const barra = document.createElement('nav');
  barra.className = 'barra-celular';
  barra.setAttribute('aria-label', 'Atalhos do menu');
  barra.innerHTML =
    doCelular
      .map(
        (item) => `
        <a href="${item.href}"${marcaAtual(item)}>
          <i class="${item.icone}" aria-hidden="true"></i>
          <span>${item.texto}</span>
        </a>`
      )
      .join('') +
    `<button type="button" id="abrirMenu" aria-label="Mais opções do menu"
             aria-expanded="false" aria-controls="barraLateral"${estaNoMais ? ' aria-current="page"' : ''}>
       <i class="fa-solid fa-bars" aria-hidden="true"></i>
       <span>Mais</span>
     </button>`;

  document.body.appendChild(barra);
})();
