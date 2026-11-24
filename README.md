# Verdanz

Aplicação web de gestão financeira pessoal, desenvolvida como Trabalho de Conclusão de Curso (SENAI).

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![Prisma](https://img.shields.io/badge/ORM-Prisma%20v6-2D3748?logo=prisma&logoColor=white)
![MySQL](https://img.shields.io/badge/Banco%20de%20Dados-MySQL-4479A1?logo=mysql&logoColor=white)
![CSS](https://img.shields.io/badge/Front--end-HTML%20%2B%20CSS%20%2B%20JS-1E6B45)

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

- **Contas** — onde o dinheiro está (carteira, conta corrente, poupança), cada uma com seu saldo. As contas podem ser criadas à mão ou importadas de um banco simulado, que imita o Open Finance.
- **Transações** — lançamento de ganhos e gastos, sempre vinculados a uma conta e a uma categoria. Um gasto pode ficar "a pagar" (com vencimento) e ser marcado como pago depois.
- **Categorias e limites** — 15 categorias do sistema, mais as que cada pessoa cria. Para cada categoria de gasto dá para definir um limite por mês ("no máximo R$ 500 em Lazer").
- **Metas financeiras** — objetivos com valor-alvo e prazo. O dinheiro guardado sai de uma conta, e a tela mostra quanto guardar por mês.

Além disso, o Verdanz sugere um perfil financeiro (CLT, autônomo, estudante, doméstico, desempregado ou aposentado) e mostra ferramentas próprias de cada um, e avisa no sininho sobre contas a vencer, metas perto do prazo, saldo negativo e limites estourados.

## Tecnologias utilizadas

| Camada | Tecnologia |
| --- | --- |
| Back-end | Node.js + Express (CommonJS) |
| ORM | Prisma v6 |
| Banco de dados | MySQL |
| Autenticação | JWT (`jsonwebtoken`) |
| Hash de senha | bcrypt |
| Ambiente de desenvolvimento | Nodemon |
| Front-end | HTML, CSS e JavaScript puros (sem framework), fonte Lexend e ícones Font Awesome |
| Modelagem do banco | brModelo |
| Testes de API | Insomnia / Postman |

## Estrutura do projeto

O back-end e o front-end vivem no **mesmo projeto e no mesmo servidor**. Não existem
pastas `backend/` e `frontend/` separadas: o Express serve as telas e a API lado a lado.

```
projeto-conclusao-controledegastos/
├── index.js                  # Ponto de entrada: sobe o Express
├── prisma/
│   ├── schema.prisma         # Modelo do banco (8 tabelas)
│   ├── seed.js               # Cria as 15 categorias do sistema
│   └── migrations/           # A migration que cria o banco
├── src/                      # Código que roda no SERVIDOR (Node)
│   ├── controllers/          # Regras de negócio e acesso ao banco
│   ├── routes/               # Endereços da API e das telas
│   ├── middlewares/          # Autenticação (JWT) e verificação de dono
│   ├── views/                # Telas em HTML
│   ├── bancoSimulado/        # O banco de mentira usado na importação
│   ├── prisma.js             # Instância única do Prisma Client
│   └── *.js                  # Regras usadas por mais de um controller (saldo, categorias, e-mail...)
├── public/                   # Código que roda no NAVEGADOR (servido como estático)
│   ├── js/                   # Scripts de cada tela + utilitários compartilhados
│   ├── css/                  # verdanz.css (o visual inteiro) e inicial.css
│   └── img/                  # Imagens e logos
└── Docs/                     # Documentação do projeto
    ├── Diagramas/            # Diagramas conceitual, lógico e de classes (brModelo)
    ├── Como o sistema funciona.md  # Guia de estudo: camadas, telas, API e regras
    ├── Scripts Banco Dados/  # Scripts SQL de criação do banco
    ├── Testes/               # Casos de teste e testes automáticos dos cálculos
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

SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
EMAIL_REMETENTE="Verdanz <seu-email@gmail.com>"
```

Comando para criar uma chave criptografada forte:
```node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"```

O `.env` está no `.gitignore` e nunca deve ser commitado.

### 4. Preparar o banco de dados

Crie as tabelas a partir da migration do Prisma:

```bash
npx prisma migrate dev
```

Em seguida, cadastre as **15 categorias do sistema** (10 de despesa e 5 de receita;
três delas, "Metas" e as duas de transferência, são usadas só pelo próprio sistema):

```bash
npx prisma db seed
```

> **Este passo é obrigatório.** Sem as categorias, a tabela fica vazia e não é possível
> registrar nenhuma transação: o formulário abre sem opções para escolher. O seed é
> idempotente: rodar várias vezes não duplica nada.

> **Quem já tinha o banco montado antes de 24/11/2026:** as 11 migrations do
> desenvolvimento foram juntadas numa só (`prisma/migrations/20261124000000_init`). O
> banco que resulta é idêntico, mas o Prisma estranha o histórico antigo. Rode
> `npx prisma migrate reset` uma vez: ele apaga o banco local, cria de novo com a
> migration nova e roda o seed. Os dados de teste desse banco se perdem.

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
| `http://localhost:3000/criar-conta` | Criar conta |
| `http://localhost:3000/entrar` | Entrar |
| `http://localhost:3000/inicio` | Início (resumo do mês) |
| `http://localhost:3000/api/...` | API em JSON |

As telas internas (início, transações, contas, metas, meu perfil, configurações) exigem
sessão: sem estar logado, elas levam para `/entrar`. Crie uma conta em `/criar-conta`
antes de testá-las. Os endereços da primeira versão do site (`/login`, `/cadastro`,
`/dashboard` e os que começam com `/novo`) levam para as telas equivalentes.

### 6. Testar a conexão bancária (banco simulado)

O Verdanz importa contas e transações de um **banco simulado**, que imita o fluxo do
Open Finance (consentimento, autorização no site do banco e token de acesso). O banco
fica em `src/bancoSimulado/` e roda no mesmo servidor, em `/banco-simulado`.

O banco tem 3 clientes fictícios, com 3 meses de extrato cada. Para testar:

1. Cadastre-se no Verdanz usando o CPF de um deles:

   | Cliente | CPF | Contas no banco |
   | --- | --- | --- |
   | Ana Souza | 482.915.736-46 | Conta corrente e poupança |
   | Bruno Lima | 735.102.648-35 | Conta corrente |
   | Carla Mendes | 219.384.057-14 | Conta corrente |

2. Em **Contas**, clique em **Conectar um banco**. Você vai para a tela do banco.
3. Clique em **Autorizar**. De volta ao Verdanz, as contas aparecem com o selo
   "Banco Simulado" e as transações já categorizadas em **Transações**.

Com qualquer outro CPF, o banco responde que você não é cliente dele.

### Resumo: do zero ao ar

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

## Testes automáticos

As regras de cálculo que não dependem do banco têm testes que rodam direto no Node:

```bash
node Docs/Testes/teste-calculos-meta.js     # quanto guardar por mês numa meta
node Docs/Testes/teste-calculos-perfil.js   # ferramentas de cada perfil (INSS, MEI...)
node Docs/Testes/teste-notificacoes.js      # avisos do sininho
```

## Documentação do projeto

- [Como o sistema funciona](./Docs/Como%20o%20sistema%20funciona.md) — guia de estudo: camadas, como as telas falam com o servidor, regras e decisões
- [Diagramas](./Docs/Diagramas) — diagrama conceitual, lógico e de classes
- [Scripts do Banco de Dados](./Docs/Scripts%20Banco%20Dados) — scripts SQL de criação do banco
- [Casos de Teste](./Docs/Testes) — planilha de casos de teste
- [Wireframes](./Docs/Wireframes) — protótipos de baixa/alta fidelidade
- [Trabalho de Conclusão](./Docs/Trabalho%20Conclusão) — documento do TCC


## Contexto acadêmico

Este projeto é desenvolvido como Trabalho de Conclusão de Curso do SENAI, sob orientação do professor Josué.
