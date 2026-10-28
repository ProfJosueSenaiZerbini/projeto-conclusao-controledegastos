# Verdanz

Sistema web de controle financeiro pessoal. TCC do curso Técnico em Desenvolvimento de Sistemas (SENAI).

## Contexto do desenvolvedor

Estudante com pouca experiência prévia em desenvolvimento. Prefere:
- Um passo de cada vez, sem receber tudo de uma vez
- Explicação conceitual em linguagem simples antes da implementação
- Entender o "porquê" de cada decisão, já que precisará defender o projeto perante uma banca

Ao implementar algo, explique brevemente o que o código faz e por quê, não apenas entregue o arquivo pronto.

## Stack

- Node.js + Express
- Prisma ORM **v6** (não v7 — tem breaking changes de ESM e driver adapters, evitados de propósito)
- MySQL
- CommonJS (`require`/`module.exports`, não ESM)
- bcrypt para hash de senhas
- jsonwebtoken para autenticação
- nodemon em desenvolvimento

## Estrutura de pastas

```
prisma/
├── schema.prisma
├── seed.js
└── migrations/
src/
├── controllers/
├── routes/
└── middlewares/
index.js
.env
```

Não existe pasta `models/`. O Prisma Client substitui essa camada — os controllers chamam `prisma.<entidade>` diretamente.

---

## Escopo atual: reduzido de propósito

O projeto já teve um modelo com 12 entidades (perfis financeiros, formulário de personalização, funcionalidades habilitáveis, simulação bancária). Esse modelo completo **ainda existe na documentação como visão de produto**, mas foi deliberadamente pausado porque as decisões pendentes entre essas entidades estavam travando o desenvolvimento do básico.

**O escopo atual tem 5 entidades e é isto que deve ser implementado agora.** Não sugira trazer de volta perfis, formulário ou funcionalidades habilitáveis a menos que o desenvolvedor peça explicitamente.

A **simulação bancária voltou**, a pedido do desenvolvedor, numa forma enxuta: um banco simulado que imita o Open Finance e a importação de contas e transações para o Verdanz. Ela acrescenta a tabela `ConexaoBancaria` e campos opcionais em `Conta` e `Transacao` (ver a seção "Importação bancária").

### As 5 entidades

**Usuario** — cadastro e login
**Conta** — a Carteira do usuário, com saldo
**Categoria** — lista fixa de 13 categorias (9 despesa, 4 receita), sem hierarquia. "Metas" é usada só pelo sistema (ver "o dinheiro da meta sai de uma conta")
**Transacao** — um gasto ou um ganho
**Meta** — objetivo financeiro; o valor guardado sai de uma conta do usuário

### Relacionamentos (4 no total)

| De | Relação | Para | Cardinalidade |
|---|---|---|---|
| Usuario | possui | Conta | 1:N |
| Usuario | define | Meta | 1:N |
| Conta | origina | Transacao | 1:N |
| Categoria | classifica | Transacao | 1:N |

Não existe relacionamento direto entre Usuario e Transacao. Isso é intencional — ver normalização abaixo.

---

## O modelo está em 3FN — isto é importante

Duas colunas foram removidas de `Transacao` deliberadamente, por serem dependências transitivas:

**`id_usuario` foi removido.** Toda conta já pertence a um usuário (`Conta.id_usuario`), então guardar o usuário também na transação seria redundante e permitiria inconsistência. Para descobrir o dono de uma transação, ou para listar as transações de um usuário, sempre passe pela conta:

```javascript
await prisma.transacao.findMany({
  where: { conta: { id_usuario } },
  include: { categoria: true },
});
```

**`tipo_transacao` foi removido.** Cada categoria já tem seu próprio `tipo` (`'receita'` ou `'despesa'`) — uma transação em "Salário" é necessariamente receita. Guardar o tipo também na transação permitiria contradição. Para saber se uma transação é receita ou despesa, sempre olhe `transacao.categoria.tipo`, nunca um campo próprio da transação:

```javascript
const transacao = await prisma.transacao.create({
  data: { valor_transacao, data_transacao, descricao, id_categoria, id_conta },
  include: { categoria: true },
});
// transacao.categoria.tipo → 'receita' ou 'despesa'
```

**Não reintroduza esses dois campos em `Transacao` mesmo que pareça simplificar uma query.** Se uma consulta parecer difícil sem eles, o caminho é usar `include`/`where` aninhado do Prisma, não desnormalizar de volta.

O campo `Conta.saldo` é a única redundância controlada que **foi mantida**, guardada por desempenho: `saldo inicial + ganhos lançados − gastos PAGOS`. Gasto não pago não entra nele. Precisa ser sempre atualizado na mesma operação atômica que cria a transação ou muda o pagamento (ver as seções seguintes).

`Transacao.data_pagamento` (data, opcional) diz se um **gasto** foi pago e quando. Não quebra a 3FN: "pago" é um fato que só a pessoa informa, não se deduz de outro campo. Já **pendente** e **atrasado** se deduzem da data e do dia de hoje, e por isso **não são gravados** (ver `statusTransacao` em `public/js/auth.js`). Em ganhos, `data_pagamento` fica sempre vazio.

---

## Regra crítica: registrar transação é uma operação atômica

Criar a transação e atualizar `Conta.saldo` têm que acontecer juntos, dentro de um `prisma.$transaction`. Se uma parte falhar, nada deve ser gravado — senão o saldo diverge do histórico de transações permanentemente.

Como não existe mais `tipo_transacao` na transação, o tipo vem da categoria, buscada dentro da própria operação:

```javascript
const resultado = await prisma.$transaction(async (tx) => {
  const categoria = await tx.categoria.findUnique({ where: { id_categoria } });
  if (!categoria) throw new Error('Categoria não encontrada');

  const transacao = await tx.transacao.create({
    data: { valor_transacao, data_transacao, descricao, id_categoria, id_conta },
  });

  await tx.conta.update({
    where: { id_conta },
    data: {
      saldo: categoria.tipo === 'receita'
        ? { increment: valor_transacao }
        : { decrement: valor_transacao },
    },
  });

  return transacao;
});
```

Use este padrão sempre que implementar o registro de transação. Não separe em duas chamadas independentes ao Prisma.

## Regra: gasto pago e não pago

- **Ganho** entra no saldo ao ser lançado. **Gasto** só sai do saldo quando está pago.
- No `POST /api/transacao`, o campo opcional `pago` decide. Sem ele, vale o mais comum: gasto de hoje ou de antes já foi pago; gasto com data futura é conta a pagar. Pago com data futura = pagou adiantado (`data_pagamento` = hoje).
- `PATCH /api/transacao/:id/pagamento` com `{ "pago": true | false }` marca ou desmarca. A condição sobre `data_pagamento` vai no `WHERE` do `updateMany`, então dois cliques juntos não descontam duas vezes.
- **Não existe mais "saldo insuficiente" para gastos.** O dinheiro das contas manuais é informado pela própria pessoa, e o saldo pode ficar negativo (inclusive o saldo inicial e a edição de saldo na tela de Contas).
- Só gastos de **contas manuais** podem ser marcados. Conta importada: o banco é que diz o que foi pago (gastos importados entram pagos no próprio dia). Gasto de **meta**: já sai pago e não pode ser desmarcado.

**O que depende do dia de hoje é calculado na leitura, não guardado** (`src/saldo.js`), porque mudaria sozinho à meia-noite:

| Valor | Cálculo |
|---|---|
| `saldo` (o de hoje, devolvido pela API) | `Conta.saldo − ganhos com data futura` |
| `saldo_previsto` | `Conta.saldo − gastos não pagos` |

Contas importadas não têm esses ajustes: o saldo delas é o do banco. Ao editar o saldo de uma conta, a pessoa informa o saldo **de hoje**, e o servidor soma os ganhos futuros antes de gravar.

A migration `pagamento_transacao` criou a coluna e acertou os dados antigos: gastos até hoje, importados e de metas viraram pagos; gastos futuros viraram não pagos, e o valor deles voltou para o saldo guardado.

## Regra: a Carteira nasce junto com o usuário

Um usuário sem conta não tem onde registrar nada. `POST /api/usuario` deve criar `Usuario` e a `Conta` "Carteira" (saldo 0.00) na mesma operação — também dentro de um `$transaction`, pelo mesmo motivo.

## Regra: o dinheiro da meta sai de uma conta

Guardar dinheiro numa meta ("Adicionar valor", ou o valor inicial opcional ao criar) tira o valor de uma conta escolhida pelo usuário. Tudo acontece num `$transaction` só, em `guardarNaMeta` (`metaController.js`):

1. trava a linha da meta (`SELECT ... FOR UPDATE`) e calcula quanto falta;
2. desconta da conta só o que cabe na meta (pediu R$ 500 e faltavam R$ 200 → saem R$ 200). Diferente de um gasto comum, **guardar exige saldo de hoje** (sem contar ganhos futuros): guardar é mover dinheiro que existe;
3. cria uma `Transacao` na categoria **"Metas"** (despesa), descrição `Meta: <título>`, já paga (`data_pagamento` = hoje);
4. soma em `Meta.valor_atual` e recalcula o status.

Por que vira transação: `Conta.saldo` é a soma das transações. Se o saldo baixasse sem uma transação, o histórico deixaria de explicar o saldo.

- **Conta importada não pode ser usada** (só muda pelo banco).
- **`valor_atual` não é editado direto** pelo `PUT`, e o `valor_alvo` não pode ficar menor que o que já foi guardado — senão parte do dinheiro sumiria sem voltar para conta nenhuma.
- **A categoria "Metas" não aparece no formulário de transações**, e o servidor recusa lançá-la à mão.
- **Excluir a meta não devolve o dinheiro** à conta: as transações "Meta: ..." continuam no histórico. A tela avisa antes de excluir.
- A categoria entra pelo seed (bancos novos) e pela migration `categoria_metas` (bancos que já existiam). Nos dois casos fica com o id 13.

---

## Importação bancária (banco simulado)

O usuário conecta um banco na tela de Contas e o Verdanz importa as contas e o extrato. Só instituições autorizadas pelo Banco Central acessam o Open Finance de verdade, então o banco é simulado — mas o fluxo imita o real (consentimento, código, token de acesso).

**Onde fica cada parte:**

| Arquivo | Papel |
|---|---|
| `src/bancoSimulado/` | O "banco". Não faz parte do Verdanz. Tem os próprios dados (`dados.json`), rotas em `/banco-simulado` e a tela de autorização |
| `src/clienteBanco.js` | O ÚNICO lugar do Verdanz que conversa com o banco, sempre por HTTP |
| `src/importacao.js` | Traduz o formato do banco para o do Verdanz, categoriza e grava |
| `src/controllers/conexaoController.js` | Rotas `/api/conexao-bancaria` usadas pela tela |

**Regras que não podem ser quebradas:**

- **Separação dos dois sistemas.** O Verdanz nunca lê o `dados.json`, e o banco nunca lê o MySQL. Toda conversa passa pelas rotas. É isso que torna a simulação honesta.
- **A importação também é atômica.** As transações novas de uma conta e a atualização do saldo entram no mesmo `$transaction`. O valor fica sempre positivo e a direção vem da categoria, como no registro manual.
- **Sem duplicatas.** `Transacao.id_externo` guarda o código que o banco deu à transação, com `@@unique([id_conta, id_externo])`. Sincronizar de novo não grava nada repetido. O mesmo vale para `Conta.id_externo`.
- **Conta importada só muda pelo banco.** O servidor recusa editar, excluir ou lançar transação manual numa conta com `id_conexao`. Para remover, desconecta-se o banco (Cascade apaga as contas importadas).
- **Numa conta importada, quem manda é o banco.** Gastos importados entram pagos no próprio dia e não podem ser marcados como não pagos.
- **O `token_acesso` nunca sai do servidor.** A listagem de conexões usa `select` sem ele.
- **O `state` é assinado com segredo próprio** (`JWT_SECRET + ':estado-conexao'`), e não com o `JWT_SECRET` puro. Ele passa pela URL; se usasse o mesmo segredo, serviria como token de login.

**Clientes do banco simulado** (cadastre um usuário no Verdanz com um destes CPFs para testar):

| Cliente | CPF | Contas |
|---|---|---|
| Ana Souza | 482.915.736-46 | Conta corrente e poupança |
| Bruno Lima | 735.102.648-35 | Conta corrente |
| Carla Mendes | 219.384.057-14 | Conta corrente |

---

## Perfis e ferramentas por perfil (só no navegador)

A pesquisa (`/perfil`) sugere de 1 a 3 perfis entre CLT, Autônomo, Estudante, Doméstico, Desempregado e Aposentado. A tela `/meu-perfil` mostra as ferramentas de cada perfil escolhido; a análise que justifica cada uma, com as fontes, está em `Docs/Perfis/analise-funcionalidades-por-perfil.md`.

- **Nada disso está no banco.** Os perfis ficam no `localStorage` (`PerfisSalvos`, em `auth.js`) e o que a pessoa digita nas ferramentas também (`Preferencias`, em `meu-perfil.js`), sempre com o id do usuário na chave. As ferramentas só leem contas, transações e metas pela API; a única escrita é o botão "Criar esta meta" (`POST /api/meta`). Guardar perfis no banco exigiria tabelas novas — decisão do grupo, não fazer por conta própria.
- **Valores oficiais (salário mínimo, INSS, seguro-desemprego, MEI) mudam todo janeiro.** Ficam só na constante `VALORES_2026` de `public/js/perfil-calculos.js`. Ao atualizar, ajuste também `Docs/Testes/teste-calculos-perfil.js` e rode `node Docs/Testes/teste-calculos-perfil.js`.
- **Só entram números conferidos em mais de uma fonte.** O IR do 13º e o calendário do INSS ficaram de fora de propósito; a tela orienta a conferir no holerite ou no Meu INSS.

---

## Schema atual (referência — sempre confira o schema.prisma real antes de escrever queries)

```prisma
model Usuario {
  id_usuario     Int      @id @default(autoincrement())
  nome_usuario   String   @db.VarChar(100)
  cpf_cnpj       String   @unique @db.VarChar(20)
  email          String   @unique @db.VarChar(100)
  senha          String   @db.VarChar(255)
  data_cadastro  DateTime @default(now())
  contas  Conta[]
  metas   Meta[]
}

model Conta {
  id_conta    Int     @id @default(autoincrement())
  nome        String  @db.VarChar(100)
  saldo       Decimal @default(0.00) @db.Decimal(12, 2)
  id_usuario  Int
  id_conexao  Int?                    // só nas contas importadas
  id_externo  String? @db.VarChar(50) // código da conta no banco
  usuario     Usuario          @relation(fields: [id_usuario], references: [id_usuario], onDelete: Cascade)
  conexao     ConexaoBancaria? @relation(fields: [id_conexao], references: [id_conexao], onDelete: Cascade)
  transacoes  Transacao[]
  @@unique([id_conexao, id_externo])
}

model ConexaoBancaria {
  id_conexao            Int       @id @default(autoincrement())
  banco                 String    @db.VarChar(100)
  token_acesso          String    @db.Text
  acesso_expira_em      DateTime
  data_conexao          DateTime  @default(now())
  ultima_sincronizacao  DateTime?
  id_usuario            Int
  usuario  Usuario @relation(fields: [id_usuario], references: [id_usuario], onDelete: Cascade)
  contas   Conta[]
  @@unique([id_usuario, banco])
}

model Categoria {
  id_categoria    Int    @id @default(autoincrement())
  nome_categoria  String @db.VarChar(100)
  tipo            String @db.VarChar(20)  // 'receita' ou 'despesa'
  transacoes  Transacao[]
}

model Transacao {
  id_transacao     Int      @id @default(autoincrement())
  valor_transacao  Decimal  @db.Decimal(12, 2)  // sempre positivo
  data_transacao   DateTime @db.Date
  descricao        String?  @db.VarChar(150)
  id_categoria     Int
  id_conta         Int
  id_externo       String?  @db.VarChar(50)  // código da transação no banco, só nas importadas
  data_pagamento   DateTime? @db.Date        // gasto: dia em que foi pago (vazio = não pago); ganho: sempre vazio
  categoria  Categoria @relation(fields: [id_categoria], references: [id_categoria])
  conta      Conta     @relation(fields: [id_conta], references: [id_conta], onDelete: Cascade)
  @@unique([id_conta, id_externo])
}

model Meta {
  id_meta      Int      @id @default(autoincrement())
  titulo       String   @db.VarChar(100)
  valor_alvo   Decimal  @db.Decimal(12, 2)
  valor_atual  Decimal  @default(0.00) @db.Decimal(12, 2)
  data_limite  DateTime @db.Date
  status       String   @default("em_progresso") @db.VarChar(20)
  id_usuario   Int
  usuario  Usuario @relation(fields: [id_usuario], references: [id_usuario], onDelete: Cascade)
}
```

`Meta.valor_atual` só aumenta guardando dinheiro de uma conta, que gera uma transação na categoria "Metas" (ver "Regra: o dinheiro da meta sai de uma conta"). Não existe chave estrangeira entre `Transacao` e `Meta`: a ligação fica na descrição `Meta: <título>`.

---

## Convenções de código

- Nomes de campos no banco em snake_case (`nome_usuario`, `id_categoria`)
- Models no Prisma em PascalCase, mapeados com `@@map` para snake_case
- Controllers exportam funções nomeadas via `module.exports = { ... }`
- Rotas prefixadas com `/api`
- Sempre validar entrada no controller antes de chamar o Prisma
- Sempre usar try/catch com resposta de erro em JSON
- Senhas nunca em texto plano — sempre hash com bcrypt
- Valores monetários sempre positivos; o sinal/direção vem do `tipo` da categoria, nunca de um campo próprio da transação

---

## Identidade visual — logo e ícone

O logotipo do Verdanz é **uma imagem pronta, que já existe em `public/img/`**. Use sempre o arquivo que estiver lá.

**Nunca invente um substituto.** Não desenhe a marca com `<div>` e CSS, não use a letra "V" dentro de um quadrado colorido, não gere SVG, emoji ou qualquer outro placeholder — nem em mockups, protótipos, telas de exemplo ou arquivos temporários. Um desenho improvisado não é a marca do projeto e polui a identidade visual.

Antes de escrever a tela, confira o nome atual do arquivo na pasta `public/img/` e copie a forma de uso de uma tela que já existe (`src/views/login.html` é a referência). Os nomes dos arquivos de imagem podem mudar; a pasta, não.

Como referenciar:

- **Telas em `src/views/`** — caminho a partir da raiz do site, porque o Express serve `public/` como estático: `<img src="/img/NOME.png" alt="">`
- **Arquivos fora de `src/views/`** (mockups em `Docs/`, por exemplo) — caminho relativo até `public/img/`, para a imagem aparecer com dois cliques, sem servidor

Ajuste o tamanho com CSS e sempre use `object-fit: contain`, para a logo não esticar nem cortar.

As imagens da pasta são grandes (centenas de KB). Se em algum momento elas forem substituídas por versões mais leves, **nada aqui muda**: continue usando o que estiver em `public/img/`.

---

## Rotas do escopo atual

| Método | Rota | Função |
|---|---|---|
| POST | `/api/usuario` | Cadastrar (cria a Carteira junto, atômico) |
| POST | `/api/usuario/login` | Autenticar |
| GET | `/api/categoria` | Listar categorias |
| POST | `/api/transacao` | Registrar ganho ou gasto (atualiza saldo, atômico) |
| PATCH | `/api/transacao/:id/pagamento` | Marcar gasto como pago / não pago (`{ "pago": true \| false }`) |
| GET | `/api/usuario/:id/transacao` | Listar transações (via join com conta) |
| GET | `/api/usuario/:id/conta` | Consultar saldo (`saldo` de hoje e `saldo_previsto`) |
| POST | `/api/meta` | Criar meta (`valor_inicial` + `id_conta` opcionais) |
| GET | `/api/usuario/:id/meta` | Listar metas |
| PUT | `/api/meta/:id` | Atualizar meta; `{ adicionar, id_conta }` guarda dinheiro tirado da conta |
| DELETE | `/api/meta/:id` | Excluir meta |
| POST | `/api/conexao-bancaria` | Iniciar conexão: pede o consentimento e devolve a tela do banco |
| POST | `/api/conexao-bancaria/finalizar` | Confere o `state`, troca o código pelo acesso e faz a primeira importação |
| GET | `/api/conexao-bancaria` | Listar conexões (sem o token de acesso) |
| POST | `/api/conexao-bancaria/:id/sincronizar` | Importar o que for novo |
| DELETE | `/api/conexao-bancaria/:id` | Desconectar (apaga as contas importadas) |

Rotas do banco simulado, fora do `/api` porque não fazem parte do Verdanz: `POST /banco-simulado/consents`, `GET /banco-simulado/consents/:id`, `POST /banco-simulado/consents/authorize`, `POST /banco-simulado/consents/reject`, `POST /banco-simulado/token`, `GET /banco-simulado/accounts`, `GET /banco-simulado/accounts/:id/balances`, `GET /banco-simulado/accounts/:id/transactions` e a tela `GET /banco-simulado/autorizar`.

Construa um recurso por vez, teste no Insomnia/Postman antes de avançar.

## Roteiro

- [x] Login e cadastro
- [ ] Criar a Carteira automaticamente ao cadastrar (atômico)
- [ ] Listar categorias
- [ ] Registrar transação atualizando o saldo (atômico, tipo vindo da categoria)
- [ ] Listar transações do usuário (via conta)
- [ ] Consultar saldo
- [ ] CRUD de Meta
- [ ] Telas correspondentes

---

## O que NÃO existe mais no modelo (não sugerir de volta)

`Perfil`, `UsuarioPerfil`, `PerguntaFormulario`, `FormularioPerfil`, `RespostaFormulario`, `Funcionalidade`, `UsuarioFuncionalidade`. Também não existem: hierarquia de subcategorias, contas domésticas como entidade própria, `tipo_transacao`, `id_usuario` em `Transacao`, `cpf_cnpj`... (esse último continua existindo em `Usuario`, não remover).

O "pago / não pago" de um gasto voltou a pedido do desenvolvedor, como um campo de `Transacao` (`data_pagamento`), e não como entidade própria — ver "Regra: gasto pago e não pago".

Se o desenvolvedor pedir para trazer algo dessa lista de volta, é uma decisão dele para retomar depois — implemente apenas quando pedido explicitamente, sem sugerir por conta própria enquanto o escopo mínimo não estiver completo e funcionando.

## Trabalho em equipe

O projeto é desenvolvido em dupla. Um integrante cuida do back-end, o outro das views. Mudanças estruturais no schema ou nas rotas afetam os dois — sinalize quando uma alteração exigir comunicação com o colega.
