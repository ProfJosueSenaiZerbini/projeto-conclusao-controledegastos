# Verdanz

Aplicação web de gestão financeira pessoal, desenvolvida como Trabalho de Conclusão de Curso (SENAI).

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![Prisma](https://img.shields.io/badge/ORM-Prisma%20v6-2D3748?logo=prisma&logoColor=white)
![MySQL](https://img.shields.io/badge/Banco%20de%20Dados-MySQL-4479A1?logo=mysql&logoColor=white)
![Tailwind](https://img.shields.io/badge/CSS-Tailwind-06B6D4?logo=tailwindcss&logoColor=white)

## Equipe

- Nicolas Oliveira
- Marcelo Bryan
- Victor Hugo Ismerio
- Guilherme Gonçalves
- Cauã Pereira

## Sobre o projeto

O Verdanz é uma aplicação web de gestão financeira pessoal criada para oferecer ao usuário clareza e compreensão sobre o que acontece com seu dinheiro, reunindo em um único ambiente as informações essenciais do seu dia a dia financeiro.

Mais do que um registrador de gastos, o Verdanz se propõe a ser um serviço completo: permite visualizar saldos, acompanhar despesas e ganhos ao longo do mês e entender de forma intuitiva para onde o dinheiro está indo.

### O problema

Grande parte das pessoas não possui visibilidade real sobre suas finanças. Gastos são registrados de forma dispersa (ou não registrados), contas de casa vencem sem controle, e objetivos financeiros ficam no campo da intenção por falta de acompanhamento concreto. Aplicativos genéricos de finanças tratam todos os usuários da mesma forma, ignorando que a realidade financeira de um trabalhador CLT é substancialmente diferente da de um autônomo, de um estudante ou de um aposentado.

### A proposta

O Verdanz organiza a vida financeira do usuário em torno de quatro pilares:

- **Contas** — registro de contas bancárias (corrente, poupança, carteira) e de contas de casa (luz, água, aluguel), com valores e vencimentos.
- **Transações** — lançamento de receitas e despesas, sempre vinculadas a uma conta e classificadas por categoria.
- **Categorias e subcategorias** — organização hierárquica dos gastos, permitindo tanto categorias amplas quanto detalhamento (Alimentação → Restaurante, Delivery, Supermercado).
- **Metas financeiras** — definição de objetivos com valor-alvo, prazo e acompanhamento de progresso.

## Tecnologias utilizadas

| Camada | Tecnologia |
| --- | --- |
| Back-end | Node.js + Express (CommonJS) |
| ORM | Prisma v6 |
| Banco de dados | MySQL |
| Autenticação | JWT (`jsonwebtoken`) |
| Hash de senha | bcrypt |
| Ambiente de desenvolvimento | Nodemon |
| Front-end | HTML, CSS, JavaScript + Tailwind CSS |
| Modelagem do banco | brModelo |
| Testes de API | Insomnia / Postman |

## Estrutura do projeto

O back-end e o front-end vivem no **mesmo projeto e no mesmo servidor**. Não existem
pastas `backend/` e `frontend/` separadas: o Express serve as telas e a API lado a lado.

```
projeto-conclusao-controledegastos/
├── index.js                  # Ponto de entrada: sobe o Express
├── prisma/
│   ├── schema.prisma         # Modelo das 5 entidades
│   ├── seed.js               # Cria as 12 categorias fixas
│   └── migrations/           # Histórico de alterações do banco
├── src/                      # Código que roda no SERVIDOR (Node)
│   ├── controllers/          # Regras de negócio e acesso ao banco
│   ├── routes/               # Endereços da API e das telas
│   ├── middlewares/          # Autenticação (JWT) e verificação de dono
│   ├── views/                # Telas em HTML
│   └── prisma.js             # Instância única do Prisma Client
├── public/                   # Código que roda no NAVEGADOR (servido como estático)
│   ├── js/                   # Scripts de cada tela + utilitários compartilhados
│   ├── css/                  # Estilos próprios
│   └── img/                  # Imagens e logos
└── Docs/                     # Documentação do projeto
    ├── Diagramas/            # Diagramas conceitual, lógico e de classes (brModelo)
    ├── Scripts Banco Dados/  # Scripts SQL de criação do banco
    ├── Testes/               # Casos de teste
    ├── Trabalho Conclusão/   # Documento do TCC
    └── Wireframes/           # Wireframes do sistema
```

A divisão que importa é entre `src/` e `public/`:

| Pasta | Roda onde | Responsabilidade |
| --- | --- | --- |
| `src/` | No servidor (Node.js) | Rotas, validações, regras de negócio, banco de dados |
| `public/` | No navegador | Buscar o JSON da API e montar a tela |

As telas em `src/views/` chegam ao navegador **sem dados**. Quem as preenche são os
scripts de `public/js/`, que chamam a própria API depois que a página carrega.

## Pré-requisitos

Antes de começar, você vai precisar ter instalado:

- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [MySQL](https://dev.mysql.com/downloads/) (servidor local ou remoto)
- [Git](https://git-scm.com/)
- Um cliente de API como [Insomnia](https://insomnia.rest/) ou [Postman](https://www.postman.com/) (opcional, para testar os endpoints)

## Instalação

### 1. Clonar o repositório

```bash
git clone https://github.com/ProfJosueSenaiZerbini/projeto-conclusao-controledegastos.git
cd projeto-conclusao-controledegastos
```

### 2. Instalar as dependências

```bash
npm install
```

### 3. Configurar as variáveis de ambiente

Crie um arquivo `.env` **na raiz do projeto** (mesma pasta do `index.js`), usando o
`.env.example` como modelo:

```env
DATABASE_URL="mysql://usuario:senha@localhost:3306/verdanz"
JWT_SECRET="uma_chave_secreta_forte"
PORT=3000
```

O `.env` está no `.gitignore` e nunca deve ser commitado.

### 4. Preparar o banco de dados

Crie as tabelas a partir do schema do Prisma:

```bash
npx prisma migrate dev
```

Em seguida, popule as **12 categorias fixas** (8 de despesa e 4 de receita):

```bash
npx prisma db seed
```

> **Este passo é obrigatório.** Sem as categorias, a tabela fica vazia e não é possível
> registrar nenhuma transação — o formulário abre sem opções para escolher. O seed só
> roda sozinho dentro de um `npx prisma migrate dev` que cria uma migration nova; em
> qualquer outra situação é preciso chamá-lo à mão. Ele é idempotente: rodar várias
> vezes não duplica nada.

### 5. Iniciar o servidor

```bash
npm run dev
```

Pronto. O mesmo servidor entrega a API **e** as telas em `http://localhost:3000`
(ou na porta definida em `PORT`). Não é necessário Live Server nem abrir os arquivos
`.html` diretamente — fazer isso quebra os caminhos de `/css`, `/js` e `/img`.

| Endereço | O que é |
| --- | --- |
| `http://localhost:3000/` | Página inicial |
| `http://localhost:3000/cadastro` | Criar conta |
| `http://localhost:3000/login` | Entrar |
| `http://localhost:3000/dashboard` | Resumo financeiro |
| `http://localhost:3000/api/...` | API em JSON |

As telas internas (dashboard, contas, transações, metas) exigem sessão: sem estar
logado, elas redirecionam para `/login`. Crie uma conta em `/cadastro` antes de testá-las.

### Resumo: do zero ao ar

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

## Documentação do projeto

- [Diagramas](./Docs/Diagramas) — diagrama conceitual, lógico e de classes
- [Scripts do Banco de Dados](./Docs/Scripts%20Banco%20Dados) — scripts SQL de criação do banco
- [Casos de Teste](./Docs/Testes) — planilha de casos de teste
- [Wireframes](./Docs/Wireframes) — protótipos de baixa/alta fidelidade
- [Trabalho de Conclusão](./Docs/Trabalho%20Conclusão) — documento do TCC


## Contexto acadêmico

Este projeto é desenvolvido como Trabalho de Conclusão de Curso do SENAI, sob orientação do professor Josué.
