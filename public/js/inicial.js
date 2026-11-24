// Página inicial. Quatro coisas pequenas:
//
//   1. quem já está com a sessão aberta vê "Abrir o Verdanz" no lugar de
//      "Entrar" e "Criar conta";
//   2. os botões dos perfis trocam a pergunta e a ferramenta mostradas;
//   3. os controles de "Fácil de ler" mudam a letra e o tema de verdade;
//   4. o topo fixo: ganha fundo ao rolar e marca a seção que está na tela.

// ---- 1. JÁ ESTÁ DENTRO? ----

if (Sessao.token() && Sessao.idUsuario()) {
  document.querySelectorAll('[data-link-criar]').forEach((link) => {
    link.href = '/inicio';
    link.dataset.logado = 'sim'; // no celular, este botão continua no topo
    // Mantém a seta do botão, se ele tiver uma.
    const seta = link.querySelector('i');
    link.textContent = 'Abrir o Verdanz ';
    if (seta) link.appendChild(seta);
  });
  document.querySelectorAll('[data-link-entrar]').forEach((link) => (link.hidden = true));
}

// ---- 2. PERFIS ----
//
// A pergunta que cada perfil faz quando o dinheiro aperta, e a ferramenta
// que responde. Vem da análise do grupo (Docs/Perfis).
const PERFIS_DA_PAGINA = [
  { nome: 'CLT', icone: 'fa-briefcase', pergunta: 'Quanto do 13º vai cair de verdade?', ferramenta: 'Planejador do 13º', texto: 'Você informa o salário do holerite e vê a 1ª parcela, o desconto do INSS e a 2ª parcela, antes de o dinheiro chegar.' },
  { nome: 'Autônomo', icone: 'fa-laptop', pergunta: 'Quanto posso gastar se a renda muda todo mês?', ferramenta: 'Salário seguro e MEI em dia', texto: 'O Verdanz olha os seus meses mais fracos e sugere um "salário" fixo para viver. O que entrar a mais nos meses bons paga os ruins.' },
  { nome: 'Estudante', icone: 'fa-graduation-cap', pergunta: 'Vou chegar ao fim do mês?', ferramenta: 'Limite da semana', texto: 'A mesada, a bolsa ou o estágio divididos em semanas. Um aviso aparece quando você passa de 80% do limite da semana.' },
  { nome: 'Doméstico', icone: 'fa-house', pergunta: 'Quanto sobra depois das contas da casa?', ferramenta: 'Contas fixas e vencimentos', texto: 'Luz, água, aluguel: todas em ordem de vencimento, com o total do mês e quanto sobra do que entra na casa.' },
  { nome: 'Desempregado', icone: 'fa-magnifying-glass', pergunta: 'Por quanto tempo eu aguento?', ferramenta: 'Seguro-desemprego e duração do dinheiro', texto: 'Uma estimativa das parcelas do seguro pelas regras de 2026, e uma resposta direta: até que mês o seu dinheiro dura.' },
  { nome: 'Aposentado', icone: 'fa-umbrella-beach', pergunta: 'Esse empréstimo vale a pena?', ferramenta: 'Custo real do empréstimo', texto: 'Você digita a oferta que recebeu e vê o total que vai pagar, quanto é só juro e que parte do benefício fica presa.' },
];

const botoesPerfil = document.getElementById('botoesPerfil');
const respostaPerfil = document.getElementById('respostaPerfil');

function mostrarPerfilDaPagina(indice) {
  const p = PERFIS_DA_PAGINA[indice];

  botoesPerfil.querySelectorAll('button').forEach((botao, i) => botao.setAttribute('aria-pressed', String(i === indice)));

  // textContent em vez de innerHTML: o texto nunca é lido como HTML.
  respostaPerfil.innerHTML = `
    <span class="capsula capsula--lilas"><i class="fa-solid ${p.icone}" aria-hidden="true"></i> <span data-campo="nome"></span></span>
    <blockquote data-campo="pergunta"></blockquote>
    <div>
      <p><strong data-campo="ferramenta" style="color:var(--tinta)"></strong></p>
      <p data-campo="texto"></p>
    </div>`;
  respostaPerfil.querySelector('[data-campo="nome"]').textContent = p.nome;
  respostaPerfil.querySelector('[data-campo="pergunta"]').textContent = '"' + p.pergunta + '"';
  respostaPerfil.querySelector('[data-campo="ferramenta"]').textContent = 'A ferramenta: ' + p.ferramenta;
  respostaPerfil.querySelector('[data-campo="texto"]').textContent = p.texto;
}

botoesPerfil.innerHTML = PERFIS_DA_PAGINA.map(
  (p, i) => `<button type="button" data-indice="${i}" aria-pressed="false"><i class="fa-solid ${p.icone}" aria-hidden="true"></i> ${p.nome}</button>`
).join('');

botoesPerfil.addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-indice]');
  if (botao) mostrarPerfilDaPagina(Number(botao.dataset.indice));
});

mostrarPerfilDaPagina(0);

// ---- 3. FÁCIL DE LER ----
//
// Os mesmos dois recursos de Configurações, funcionando aqui: o tamanho da
// letra muda o tamanho do <html> (tudo no site é medido em "rem"), e o
// tema põe ou tira a classe "escuro" do <html>.
const TAMANHOS_DA_LETRA = { normal: '100%', grande: '112.5%', maior: '125%' };
const raiz = document.documentElement;

document.querySelectorAll('[name="demoFonte"]').forEach((radio) => {
  // Começa marcado conforme o que o tema.js já aplicou para quem tem conta.
  radio.checked = TAMANHOS_DA_LETRA[radio.value] === (raiz.style.fontSize || '100%');
  radio.addEventListener('change', () => (raiz.style.fontSize = TAMANHOS_DA_LETRA[radio.value]));
});

document.querySelectorAll('[name="demoTema"]').forEach((radio) => {
  radio.checked = (radio.value === 'escuro') === raiz.classList.contains('escuro');
  radio.addEventListener('change', () => raiz.classList.toggle('escuro', radio.value === 'escuro'));
});

// ---- 4. TOPO FIXO ----
//
// O topo fica preso em cima (position: fixed, no inicial.css).
(function () {
  const topo = document.querySelector('.inicial__topo');
  if (!topo) return;

  // No alto da página o topo é transparente, em cima do verde. Rolou um
  // pouco: ganha o fundo do papel, para o texto não passar atrás dele.
  const conferirFundo = () => topo.classList.toggle('inicial__topo--fundo', window.scrollY > 8);
  window.addEventListener('scroll', conferirFundo, { passive: true });
  conferirFundo();

  // A altura do topo muda com o tamanho da letra e da tela (no celular ele
  // tem duas linhas). O CSS usa esse número para o verde de cima começar
  // depois dele e para os atalhos não esconderem o título da seção.
  const medir = () => document.documentElement.style.setProperty('--altura-topo', topo.offsetHeight + 'px');
  if (window.ResizeObserver) new ResizeObserver(medir).observe(topo);
  medir();

  // A seção que está no meio da tela fica marcada no topo: a pessoa sabe
  // em que parte da página está.
  const links = [...topo.querySelectorAll('nav a[href^="#"]')];
  const secoes = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if (!window.IntersectionObserver || secoes.length === 0) return;

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        links.forEach((link) => link.removeAttribute('aria-current'));
        const link = links.find((l) => l.getAttribute('href') === '#' + entrada.target.id);
        if (link) link.setAttribute('aria-current', 'true');
      });
    },
    // Conta como "na tela" a seção que passa pela faixa do meio da janela.
    { rootMargin: '-45% 0px -50% 0px' }
  );
  secoes.forEach((secao) => observador.observe(secao));

  // Voltou para o alto (acima da primeira seção): nenhum atalho marcado.
  window.addEventListener('scroll', () => {
    if (secoes[0].getBoundingClientRect().top > window.innerHeight / 2) links.forEach((link) => link.removeAttribute('aria-current'));
  }, { passive: true });
})();
