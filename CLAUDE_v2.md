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

**O escopo atual tem 5 entidades e é isto que deve ser implementado agora.** Não sugira trazer de volta perfis, formulário, funcionalidades habilitáveis ou simulação bancária a menos que o desenvolvedor peça explicitamente.

### As 5 entidades

**Usuario** — cadastro e login
**Conta** — a Carteira do usuário, com saldo
**Categoria** — lista fixa de 12 categorias (8 despesa, 4 receita), sem hierarquia
**Transacao** — um gasto ou um ganho
**Meta** — objetivo financeiro, com progresso atualizado manualmente

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

O campo `Conta.saldo` é a única redundância controlada que **foi mantida** — é a soma acumulada das transações, guardada por desempenho. Precisa ser sempre atualizado junto com a criação da transação, na mesma operação atômica (ver seção seguinte).

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

## Regra: a Carteira nasce junto com o usuário

Um usuário sem conta não tem onde registrar nada. `POST /api/usuario` deve criar `Usuario` e a `Conta` "Carteira" (saldo 0.00) na mesma operação — também dentro de um `$transaction`, pelo mesmo motivo.

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
  usuario     Usuario     @relation(fields: [id_usuario], references: [id_usuario], onDelete: Cascade)
  transacoes  Transacao[]
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
  categoria  Categoria @relation(fields: [id_categoria], references: [id_categoria])
  conta      Conta     @relation(fields: [id_conta], references: [id_conta], onDelete: Cascade)
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

`Meta.valor_atual` é atualizado manualmente pelo usuário nesta fase (não há vínculo automático com transações — isso ficou para depois).

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

## Rotas do escopo atual

| Método | Rota | Função |
|---|---|---|
| POST | `/api/usuario` | Cadastrar (cria a Carteira junto, atômico) |
| POST | `/api/usuario/login` | Autenticar |
| GET | `/api/categoria` | Listar categorias |
| POST | `/api/transacao` | Registrar ganho ou gasto (atualiza saldo, atômico) |
| GET | `/api/usuario/:id/transacao` | Listar transações (via join com conta) |
| GET | `/api/usuario/:id/conta` | Consultar saldo |
| POST | `/api/meta` | Criar meta |
| GET | `/api/usuario/:id/meta` | Listar metas |
| PUT | `/api/meta/:id` | Atualizar meta (inclui `valor_atual`) |
| DELETE | `/api/meta/:id` | Excluir meta |

Dez rotas. Construa um recurso por vez, teste no Insomnia/Postman antes de avançar.

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

`Perfil`, `UsuarioPerfil`, `PerguntaFormulario`, `FormularioPerfil`, `RespostaFormulario`, `Funcionalidade`, `UsuarioFuncionalidade`. Também não existem: hierarquia de subcategorias, contas domésticas com vencimento/status, simulação de importação bancária, `tipo_transacao`, `id_usuario` em `Transacao`, `cpf_cnpj`... (esse último continua existindo em `Usuario`, não remover).

Se o desenvolvedor pedir para trazer algo dessa lista de volta, é uma decisão dele para retomar depois — implemente apenas quando pedido explicitamente, sem sugerir por conta própria enquanto o escopo mínimo não estiver completo e funcionando.

## Trabalho em equipe

O projeto é desenvolvido em dupla. Um integrante cuida do back-end, o outro das views. Mudanças estruturais no schema ou nas rotas afetam os dois — sinalize quando uma alteração exigir comunicação com o colega.
