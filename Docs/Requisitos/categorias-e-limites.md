# Análise de requisitos — Categorias personalizadas e limite de gasto por categoria

> Origem: Sprint 02 (15/10/2026) do Diário de Bordo.
> Situação: **implementado em 29/10/2026** (migration `20261029120000_categorias_personalizadas_e_limites`).
> Decisão tomada no item pendente da seção 2.3: gastos **não pagos** com data no mês **contam** para o limite.
> Falta atualizar o DER e o diagrama de classes (arquivos `.brM3` e `.dia` em `Docs/Diagramas`).

## Origem das ideias

No Diário de Bordo, Sprint 02:

- "Poder criar categorias customizadas" — **Fazível**
- Meta por regra: "Limite de gastos com lazer — Valor: R$ 500,00 — Regra: soma de valores classificados como lazer <= 500,00" — **É fazível**

A descrição do projeto também prevê "feedback positivo ou negativo ao usuário alertando se alguma categoria excedeu o valor proposto pelo usuário".

As personas reforçam essas ideias:

| Persona | O que pede |
|---|---|
| Felipe (Desempregado) | Uma categoria "Oportunidades", que não existe na lista fixa |
| Diego (CLT) | Alerta ao atingir 80% do limite de lazer |
| Ana Clara (Estudante) | Notificação ao atingir 80% do limite mensal |
| Felipe (Desempregado) | Alertas aos 70% e aos 90% do limite |
| Elena (Aposentada) | **Contraindicação:** quer poucas categorias. As personalizadas devem ser opcionais, e as 12 fixas continuam sendo o padrão |

---

## 1. Categorias personalizadas

### 1.1 Modelo de dados

Basta um campo novo em `Categoria`:

```prisma
model Categoria {
  id_categoria    Int     @id @default(autoincrement())
  nome_categoria  String  @db.VarChar(100)
  tipo            String  @db.VarChar(20)  // 'receita' ou 'despesa'
  id_usuario      Int?    // vazio = categoria do sistema; preenchido = criada pelo usuário

  usuario    Usuario?    @relation(fields: [id_usuario], references: [id_usuario], onDelete: Cascade)
  transacoes Transacao[]

  @@unique([id_usuario, nome_categoria])
  @@map("categoria")
}
```

- **A 3FN continua valendo.** O `tipo` segue na categoria, e a `Transacao` não ganha nenhum campo.
- **Surge um 5º relacionamento:** *Usuario 1:N Categoria*. O DER, o diagrama de classes e o `CLAUDE.md` (que hoje dizem "lista fixa" e "4 relacionamentos") precisam ser atualizados.
- **Nulos no `@@unique`:** no MySQL, um índice único aceita vários valores nulos. Por isso a regra "não repetir nome de categoria do sistema" precisa ser conferida no controller, e o seed continua com a guarda de duplicidade que já tem.

### 1.2 Pontos do código que quebram e precisam ser corrigidos antes

Hoje o código assume que toda categoria é global e que dá para achá-la pelo **nome**:

1. **[`src/importacao.js`](../../src/importacao.js), `carregarCategorias`:** o `findMany()` traz as categorias de todos os usuários e monta um `Map` por nome. Se alguém criar uma categoria "Lazer", ela substitui a do sistema no Map, e as transações importadas de **outra pessoa** passam a cair nela.
   → Filtrar com `where: { id_usuario: null }`.
2. **[`src/controllers/metaController.js`](../../src/controllers/metaController.js), `guardarNaMeta`:** procura a categoria "Metas" com `findFirst` pelo nome. Se um usuário criar uma categoria chamada "Metas", o dinheiro guardado na meta pode ir parar nela.
   → Filtrar com `id_usuario: null` e proibir nomes reservados.
3. **[`src/controllers/transacaoController.js`](../../src/controllers/transacaoController.js), `criarTransacao`:** não existe checagem de dono da categoria. Depois da mudança, o usuário A poderia lançar uma transação com o `id_categoria` de B.
   → Validar que a categoria é do sistema (`id_usuario` nulo) ou do próprio usuário.
4. **[`public/js/transacoes.js`](../../public/js/transacoes.js)**: esconde a categoria "Metas" pelo nome. Com o item 2 resolvido isso deixa de ser problema, mas o ideal é o filtro olhar também `id_usuario === null`.

### 1.3 Regras de negócio

- **Nome:** é obrigatório e único por usuário, e não pode repetir o nome de uma categoria do sistema ("Lazer", "Metas"…).
- **Tipo:** é obrigatório (`despesa` ou `receita`) e **não pode ser trocado depois que a categoria tiver transações**. Trocar o tipo inverteria o efeito no saldo de todo o histórico.
- **Excluir:** só é permitido se a categoria não tiver transações. Hoje a relação `Transacao → Categoria` não tem `onDelete`, então o banco já recusa. Uma alternativa mais amigável é oferecer "mover as transações para *Outras despesas* / *Outras receitas*" antes de excluir.
- **Categorias do sistema:** não podem ser editadas nem excluídas pelo usuário.

### 1.4 Onde implementar

| Camada | Local |
|---|---|
| API | Em [`categoriaController.js`](../../src/controllers/categoriaController.js), o `GET /api/categoria` passa a trazer as categorias do sistema mais as do usuário (`OR: [{ id_usuario: null }, { id_usuario }]`). Entram também `POST`, `PUT` e `DELETE /api/categoria` |
| Tela de gestão | [`configuracoes.html`](../../src/views/configuracoes.html): nova seção **"Categorias"** ao lado de "Contas e Cartões", no mesmo padrão `<details>` |
| Atalho rápido | O select de categoria do formulário de transação ([`transacoes.html`](../../src/views/transacoes.html)) ganha a opção "+ Nova categoria", para criar sem sair da tela |
| Sem mudança | Filtros de transações e o dashboard já leem de `/api/categoria` e passam a mostrar as novas categorias sozinhos |

### 1.5 Rotas novas

| Método | Rota | Função |
|---|---|---|
| POST | `/api/categoria` | Criar categoria do usuário (`nome_categoria`, `tipo`) |
| PUT | `/api/categoria/:id` | Renomear (e trocar o tipo, só se não houver transações) |
| DELETE | `/api/categoria/:id` | Excluir (só se não houver transações) |

---

## 2. Limite de gasto por categoria ("gastar menos em uma categoria")

Exemplo: a categoria **Lazer** tem muitas transações e gastos altos. O usuário cria um limite de R$ 500/mês para ela e acompanha quanto já usou.

### 2.1 Por que não reaproveitar a tabela `Meta`

A meta de hoje e o limite funcionam ao contrário um do outro:

| | Meta (atual) | Limite de categoria |
|---|---|---|
| Sucesso | chegar **ao** valor | ficar **abaixo** do valor |
| Valor atual | **gravado** (`valor_atual`) e tirado de uma conta | **calculado** (soma dos gastos da categoria no mês) |
| Período | prazo único (`data_limite`) | renova todo mês |

Colocar o limite em `Meta` quebraria o `recalcularStatus`: um limite estourado viraria "concluída". Também obrigaria a encher a tabela de campos opcionais.

### 2.2 Modelo de dados

```prisma
model LimiteCategoria {
  id_limite     Int     @id @default(autoincrement())
  valor_limite  Decimal @db.Decimal(12, 2)
  id_usuario    Int
  id_categoria  Int

  usuario    Usuario   @relation(fields: [id_usuario], references: [id_usuario], onDelete: Cascade)
  categoria  Categoria @relation(fields: [id_categoria], references: [id_categoria], onDelete: Cascade)

  @@unique([id_usuario, id_categoria]) // um limite por categoria
  @@map("limite_categoria")
}
```

O **"quanto já gastei" não é gravado**. Ele é calculado na leitura, pelo mesmo motivo do `progresso` das metas (dado derivado, 3FN): é a soma das despesas daquela categoria no mês atual, sempre passando pela conta (`where: { conta: { id_usuario } }`).

### 2.3 Regras de negócio

- **Categorias aceitas:** só categorias de **despesa** (do sistema ou do próprio usuário), e nunca a "Metas" (dinheiro guardado não é gasto).
- **Valor:** o limite deve ser maior que zero, e só existe um limite por categoria.
- **Período:** mensal, e o limite renova sozinho no dia 1.
- **Estados para a tela:**
  - 🟢 abaixo de 70%
  - 🟡 de 70% a 99%
  - 🔴 a partir de 100% (estourado)
- **Decisão pendente do grupo:** um gasto **não pago** com data dentro do mês conta para o limite? *Sugestão: sim, porque o dinheiro já está comprometido.*

### 2.4 Onde implementar

| Local | O quê |
|---|---|
| **Tela de Metas** ([`metas.html`](../../src/views/metas.html)) | No painel "Nova meta", uma escolha entre **"Juntar dinheiro"** e **"Gastar menos em uma categoria"**. Os limites aparecem numa seção própria com barra colorida. Para o usuário as duas coisas são "metas", mas no banco ficam separadas |
| **Dashboard, "Gastos por categoria"** ([`dashboard.js`](../../public/js/dashboard.js), `preencherGastosPorCategoria`) | Esse bloco já soma os gastos do mês por categoria e ordena do maior para o menor. Dá para mostrar "Lazer: R$ 420 de R$ 500" e, na categoria que mais gasta e ainda não tem limite, um botão **"Definir limite"** |
| **Antes de registrar um gasto** ([`transacoes.js`](../../public/js/transacoes.js)) | Pop-up de confirmação quando o gasto deixaria a categoria em 70% ou mais do limite: "Este gasto passa do limite de Lazer… Registrar mesmo assim?". Cancelar volta ao formulário sem gravar nada. *(Decisão do grupo: o aviso vem antes, e não depois do registro.)* |
| **E-mail (futuro)** | `emailController.js` e a seção "Notificações" de Configurações já existem. Isso atende o "feedback ao cliente" da descrição do projeto |

### 2.5 Rotas novas

| Método | Rota | Função |
|---|---|---|
| POST | `/api/limite` | Criar limite (`id_categoria`, `valor_limite`) |
| GET | `/api/usuario/:id/limite` | Listar limites com `gasto_mes` e `percentual` calculados (com `verificarDono`) |
| PUT | `/api/limite/:id` | Alterar o valor do limite |
| DELETE | `/api/limite/:id` | Remover o limite |

---

## 3. Ordem sugerida de implementação

1. **Proteger as categorias do sistema:** corrigir a importação, o `guardarNaMeta` e a validação de dono em `criarTransacao` (seção 1.2). Isso não muda nada para o usuário e é pré-requisito do resto.
2. **Criar a migration de `Categoria.id_usuario` e a API de categorias.**
3. **Fazer as telas de categoria:** seção em Configurações e atalho no formulário de transação.
4. **Criar a migration de `LimiteCategoria` e a API de limites.**
5. **Mostrar os limites na tela de Metas e no bloco do dashboard.**
6. **Adicionar os alertas:** aviso na tela, depois e-mail.

> ⚠️ Os passos 2 e 4 mudam o schema e as rotas e afetam tanto o back-end quanto as views. Combinar com o grupo antes. Depois de implementar, atualizar o `CLAUDE.md`, o DER e o diagrama de classes.
