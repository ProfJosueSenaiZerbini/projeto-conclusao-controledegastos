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

```
projeto-conclusao-controledegastos/
├── backend/          # API em Node.js + Express + Prisma
├── frontend/         # Interface em HTML, CSS, JS e Tailwind
└── Docs/             # Documentação do projeto
    ├── Diagramas/            # Diagramas conceitual, lógico e de classes (brModelo)
    ├── Scripts Banco Dados/  # Scripts SQL de criação do banco
    ├── Testes/               # Casos de teste
    ├── Trabalho Conclusão/   # Documento do TCC
    └── Wireframes/           # Wireframes do sistema
```

> As pastas `backend/` e `frontend/` refletem a estrutura planejada do projeto. Consulte o histórico de commits para o estado mais atual do código.

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

### 2. Configurar o back-end

```bash
cd backend
npm install
```

Crie um arquivo `.env` na raiz da pasta `backend/` com as variáveis de ambiente necessárias:

```env
DATABASE_URL="mysql://usuario:senha@localhost:3306/verdanz"
JWT_SECRET="uma_chave_secreta_forte"
PORT=3000
```

Aplique as migrações do Prisma para criar as tabelas no banco de dados:

```bash
npx prisma migrate dev
```

Inicie o servidor em modo de desenvolvimento (com Nodemon):

```bash
npm run dev
```

A API ficará disponível em `http://localhost:3000` (ou na porta definida em `PORT`).

### 3. Configurar o front-end

```bash
cd ../frontend
```

Como o front-end é feito em HTML, CSS e JavaScript com Tailwind, abra o arquivo `index.html` diretamente no navegador ou sirva a pasta com uma extensão como o [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) no VS Code.

Caso o Tailwind esteja configurado via CLI (em vez do CDN), gere o CSS antes de abrir a página:

```bash
npm install
npx tailwindcss -i ./src/input.css -o ./dist/output.css --watch
```

> Ajuste os caminhos acima conforme a configuração final do Tailwind adotada pela equipe.

## Documentação do projeto

- [Diagramas](./Docs/Diagramas) — diagrama conceitual, lógico e de classes
- [Scripts do Banco de Dados](./Docs/Scripts%20Banco%20Dados) — scripts SQL de criação do banco
- [Casos de Teste](./Docs/Testes) — planilha de casos de teste
- [Wireframes](./Docs/Wireframes) — protótipos de baixa/alta fidelidade
- [Trabalho de Conclusão](./Docs/Trabalho%20Conclusão) — documento do TCC


## Contexto acadêmico

Este projeto é desenvolvido como Trabalho de Conclusão de Curso do SENAI, sob orientação do professor Josué.
