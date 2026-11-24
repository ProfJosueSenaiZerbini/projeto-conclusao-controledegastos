# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pessoas de todas as faixas etárias que querem entender para onde vai o próprio dinheiro: estudantes, trabalhadores CLT, autônomos, quem cuida das contas da casa, desempregados e aposentados (personas em `Docs/Personas e Mapa da Empatia/`). Muitas não têm familiaridade com aplicativos de finanças nem com termos técnicos. Usam no computador e, com frequência, no celular.

## Product Purpose

Verdanz é um sistema web de controle financeiro pessoal: registrar ganhos e gastos, acompanhar saldo das contas, guardar dinheiro em metas, definir limites de gasto por categoria e receber avisos (contas a vencer, limites, saldo negativo). Sucesso é a pessoa conseguir, sem ajuda, registrar um gasto e entender o próprio mês.

## Positioning

Existem muitos sites de controle de gastos; o diferencial do Verdanz é a facilidade de navegação. Qualquer pessoa, de qualquer idade, deve saber onde está, para onde ir e qual é o próximo passo, sem precisar aprender o site.

## Operating Context

TCC do curso Técnico em Desenvolvimento de Sistemas (SENAI), apresentado a uma banca. Grupo de 5 integrantes; as telas e o back-end são mantidos por pessoas diferentes. Tudo precisa ser explicável em linguagem simples.

## Capabilities and Constraints

- Node.js + Express servindo as telas (`src/views/*.html`) e a API; scripts de tela em `public/js/`, estilos em `public/css/`.
- Front-end em HTML, CSS e JavaScript puro, sem framework nem etapa de build. Todo o visual fica em `public/css/verdanz.css` (variáveis CSS, medidas em `rem`); fonte Lexend e ícones Font Awesome.
- Tema claro/escuro e tamanho da letra já existem (`public/js/tema.js` + variáveis do `verdanz.css`), salvos no `localStorage`.
- A tela "Planejamento" ainda não existe; o item aparece no menu marcado como "Em breve".
- Mudanças visuais não podem ser bruscas nem depender de conceitos difíceis: precisam ser defendidas pelo grupo perante a banca.

## Brand Commitments

- Nome Verdanz, slogan "Seu dinheiro, seu futuro".
- Logo e ícone são imagens prontas em `public/img/` (`Verdanz.png`, `VerdanzIcone.png`). Nunca desenhar um substituto.
- Identidade atual: visual "guia do jardim": fundo verde bem claro, menu verde-escuro, grandes áreas verde-maçã e etiquetas em cápsula. Cor forte é sempre fundo de etiqueta com letra escura, nunca cor de texto.

## Evidence on Hand

Personas e mapas de empatia (Ana Clara, Bruno, Carla, Diego, Elena, Felipe), análise de ferramentas por perfil em `Docs/Perfis/`, wireframes em `Docs/Wireframes/`. Não há depoimentos, números de usuários ou prêmios: não inventar.

## Product Principles

1. Navegar é o produto: cada tela diz onde a pessoa está e mostra o próximo passo.
2. Palavras do dia a dia em vez de jargão ("Início", "gasto", "ganho").
3. Tudo que é importante fica visível; nada essencial escondido atrás de um ícone sem nome.
4. Mesmo menu, mesmos lugares, em todas as telas e tamanhos.
5. Simples de explicar: cada decisão tem um porquê que cabe numa frase.

## Accessibility & Inclusion

Público de todas as idades, incluindo idosos: letra legível (controle de tamanho da letra em Configurações), contraste suficiente, áreas de toque grandes no celular, foco visível para teclado, ícones sempre acompanhados de texto, respeito a quem pede menos animação.
