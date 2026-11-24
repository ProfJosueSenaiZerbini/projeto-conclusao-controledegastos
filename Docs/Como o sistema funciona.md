# Como o Verdanz funciona

Guia de estudo do código: como as partes se encaixam, como uma tela conversa com o
servidor e por que cada regra importante foi feita do jeito que está. No fim há uma
lista de perguntas que a banca pode fazer, com respostas curtas.

Para instalar e rodar o projeto, veja o [README](../README.md).

---

## 1. A ideia em uma frase

O Verdanz é **um servidor Node.js (Express) que entrega duas coisas**: as telas (arquivos
HTML, CSS e JavaScript) e uma **API** que responde em JSON. O navegador abre a tela vazia,
e o JavaScript da tela pede os dados à API e monta o que a pessoa vê.

```
 NAVEGADOR                                  SERVIDOR (Node.js + Express)               BANCO
┌──────────────────────────┐   HTTP     ┌───────────────────────────────────────┐   ┌────────┐
│ src/views/inicio.html    │──────────▶ │ routes ▶ middlewares ▶ controllers    │──▶│ MySQL  │
│ public/js/inicio.js      │  JSON      │              (Prisma Client)          │◀──│        │
│ public/css/verdanz.css   │◀────────── │                                       │   └────────┘
└──────────────────────────┘            └───────────────────────────────────────┘
```

| Tecnologia | Para quê | Por que ela |
| --- | --- | --- |
| Node.js + Express | Servidor web e API | JavaScript nos dois lados (navegador e servidor); Express é simples e muito usado |
| Prisma (v6) | Falar com o banco sem escrever SQL na mão | Gera as consultas, cuida das migrations e dá transações (`$transaction`) |
| MySQL | Guardar os dados | Banco relacional, combina com o modelo em tabelas e chaves estrangeiras |
| bcrypt | Guardar senhas | Faz um *hash* lento e com sal: nem quem lê o banco descobre a senha |
| JWT (jsonwebtoken) | Saber quem está logado | Um "crachá" assinado que o navegador manda em cada pedido |
| HTML, CSS e JS puros | As telas | Sem framework nem etapa de build: tudo que roda é o que está escrito |

---

## 2. As camadas do servidor

Cada pedido que chega passa por três camadas, sempre nesta ordem:

1. **Rota** (`src/routes/`) — diz qual endereço chama qual função.
   Ex.: `POST /api/transacao` → `transacaoController.criarTransacao`.
2. **Middlewares** (`src/middlewares/auth.js`) — "porteiros" que rodam antes da função:
   - `autenticar` confere o token JWT. Sem token válido, responde **401** e para ali.
   - `verificarDono` confere se o `:id` da URL é o mesmo id do token. Se alguém trocar
     `/api/usuario/1/conta` por `/api/usuario/2/conta`, recebe **403**.
3. **Controller** (`src/controllers/`) — valida o que chegou, aplica a regra de negócio e
   usa o Prisma para ler ou gravar no banco. Responde sempre em JSON, com
   `{ erro: "mensagem" }` quando algo dá errado.

Não existe pasta `models/`: o **Prisma Client** faz esse papel. O modelo das tabelas fica em
`prisma/schema.prisma`, e os controllers chamam `prisma.conta`, `prisma.transacao` etc.

Arquivos em `src/` que não são rota nem controller guardam regras usadas por mais de um
controller, para a regra existir num lugar só:

| Arquivo | O que tem |
| --- | --- |
| `src/prisma.js` | A única instância do Prisma Client (uma só, para não abrir conexões demais) |
| `src/saldo.js` | Cálculo do saldo de hoje e do saldo previsto |
| `src/categorias.js` | Quais categorias cada usuário enxerga e quais são só do sistema |
| `src/notificacoes.js` | Regras dos avisos do sininho |
| `src/tokens.js` | Links de uso único enviados por e-mail |
| `src/email.js` | Envio de e-mail (SMTP) |
| `src/clienteBanco.js` e `src/importacao.js` | Conversa com o banco simulado e importação do extrato |

---

## 3. Como uma tela funciona

As telas ficam em `src/views/` e chegam ao navegador **sem nenhum dado**. Cada tela carrega
alguns scripts, nesta ordem (exemplo do Início):

| Script | Papel |
| --- | --- |
| `tema.js` (no `<head>`) | Aplica tema escuro e tamanho da letra antes de a tela aparecer, para não "piscar" |
| `auth.js` | Sessão (`Sessao`), chamadas à API (`chamarApi`), formatação de dinheiro e datas, regras de situação de uma transação |
| `base.js` | Ferramentas de tela: avisos (`avisar`), janelas de confirmação (`confirmar`), leitura de valores digitados |
| `casca.js` | O que é igual em todas as telas de dentro: confere a sessão, monta o menu, o sininho e o formulário de registrar gasto/ganho |
| `inicio.js` | Só o que é da tela Início |

### A sessão

Ao entrar (`acesso.js`), o servidor devolve um **token JWT**. O navegador guarda o token e o
id do usuário no `localStorage`. Em cada chamada, `chamarApi` manda o token no cabeçalho
`Authorization: Bearer <token>`. O token vale 1 dia.

A checagem de sessão do `casca.js` é só conforto (leva para `/entrar` quem não está logado).
**Quem protege os dados é o servidor**: sem token válido a API não devolve nada.

### Exemplo completo: registrar um gasto

1. A pessoa clica em "Registrar" (o formulário é montado pelo `casca.js` e abre em qualquer tela).
2. Ao salvar, `casca.js` lê os campos e, se for um gasto numa categoria com limite, avisa
   quando o gasto passa de 70% do limite do mês (`confirmarLimite`).
3. `chamarApi('/api/transacao', { method: 'POST', body: ... })` manda o pedido com o token.
4. No servidor: `transacaoRoutes.js` → `autenticar` → `criarTransacao`.
5. O controller valida o valor, a data, se a conta é da pessoa e se não é importada.
6. Dentro de um `prisma.$transaction`: busca a categoria, grava a transação e atualiza o
   saldo da conta. **Ou as duas coisas acontecem, ou nenhuma.**
7. O servidor responde `201` com a transação criada.
8. A tela mostra um aviso e chama `anunciarMudanca()`. Toda tela aberta escuta o evento
   `verdanz:mudou` e busca os dados de novo, e o saldo e as listas se atualizam sozinhos.

### Atalhos de endereço

- `?novo=gasto` ou `?novo=ganho` em qualquer tela de dentro abre o formulário.
- `/metas?nova=meta` abre a criação de meta; `/metas?limite=ID` abre o limite daquela categoria.
- Os filtros de `/transacoes` ficam no endereço (`?situacao=pendente&mes=2026-11`), então dá
  para salvar ou compartilhar uma busca.
- Endereços antigos (`/login`, `/cadastro`, `/dashboard`, `/novo/...`) levam para as telas
  atuais (`viewRoutes.js`).

---

## 4. O banco de dados

São 8 tabelas (`prisma/schema.prisma`):

| Tabela | O que guarda |
| --- | --- |
| `usuario` | Cadastro e login (senha só como hash bcrypt) |
| `conta` | Onde o dinheiro está (Carteira, poupança...), com o saldo |
| `categoria` | As 15 do sistema e as que cada pessoa cria |
| `transacao` | Cada ganho ou gasto |
| `meta` | Objetivos de dinheiro guardado |
| `limite_categoria` | "No máximo R$ X por mês nesta categoria" |
| `token_usuario` | Links de uso único mandados por e-mail (só o hash do link) |
| `conexao_bancaria` | Bancos que a pessoa autorizou a importar |

```
usuario 1──N conta 1──N transacao N──1 categoria
usuario 1──N meta
usuario 1──N categoria (personalizada)        categoria 1──N limite_categoria
usuario 1──N limite_categoria                  usuario 1──N conexao_bancaria 1──N conta (importada)
usuario 1──N token_usuario
```

### Por que a transação não tem `id_usuario` nem `tipo` (3ª Forma Normal)

- **Sem `id_usuario`:** toda conta já pertence a um usuário. Guardar o dono também na
  transação seria repetir a informação e abriria espaço para contradição (a transação dizer
  um dono e a conta, outro). Para listar as transações de alguém, o código passa pela conta:
  `where: { conta: { id_usuario } }`.
- **Sem `tipo_transacao`:** a categoria já diz se é receita ou despesa. Uma transação em
  "Salário" é sempre um ganho. O sinal (somar ou subtrair) vem de `transacao.categoria.tipo`.
- O **valor é sempre positivo**; a direção vem da categoria.

### A única repetição proposital: `conta.saldo`

O saldo poderia ser calculado somando todas as transações, mas isso seria lento conforme o
histórico cresce. Por isso ele é **guardado** e atualizado **na mesma operação atômica** que
cria a transação ou muda o pagamento. Regra:

```
conta.saldo = saldo inicial + ganhos lançados − gastos PAGOS
```

O que depende do dia de hoje **não é guardado**, porque mudaria sozinho à meia-noite. É
calculado na leitura (`src/saldo.js`):

| Valor mostrado | Conta |
| --- | --- |
| Saldo de hoje | `conta.saldo` − ganhos com data futura |
| Saldo previsto | `conta.saldo` − gastos ainda não pagos |

### O que é gravado e o que é calculado

Regra geral do projeto: **se dá para deduzir de outros dados, não se grava**. Assim os dados
nunca se contradizem.

| Calculado na hora (não gravado) | De onde vem |
| --- | --- |
| Pendente / atrasado de um gasto | `data_transacao`, `data_pagamento` e o dia de hoje (`statusTransacao` em `auth.js`) |
| Progresso de uma meta (%) | `valor_atual` ÷ `valor_alvo` |
| Quanto guardar por mês | O que falta ÷ meses até o prazo (`meta-calculos.js`) |
| Gasto do mês numa categoria com limite | Soma das transações do mês |
| Avisos do sininho | Transações, metas, contas e limites, no momento do pedido |

---

## 5. As regras de negócio, uma por uma

### Registrar uma transação é atômico

Criar a transação e atualizar o saldo acontecem dentro de um `prisma.$transaction`. Se a
segunda parte falhar, a primeira é desfeita. Sem isso, um erro no meio deixaria o saldo
diferente do histórico para sempre, sem nada indicando o problema.

### Gasto pago e não pago

- Um **ganho** entra no saldo assim que é lançado.
- Um **gasto** só sai do saldo quando está **pago**. Sem a informação, vale o mais comum:
  gasto de hoje ou de antes já foi pago; gasto com data futura é conta a pagar.
- "Paguei" e "desmarcar" usam `PATCH /api/transacao/:id/pagamento`. A condição sobre
  `data_pagamento` vai no próprio comando de atualização, então **dois cliques juntos não
  descontam duas vezes**.
- O saldo das contas manuais **pode ficar negativo**: quem informa o dinheiro é a própria pessoa.

### A Carteira nasce com o usuário

`POST /api/usuario` cria o usuário e a conta "Carteira" no mesmo `$transaction`. Ninguém
fica sem um lugar para registrar dinheiro.

### Metas: o dinheiro sai de uma conta

Guardar dinheiro numa meta (`guardarNaMeta` em `metaController.js`):

1. trava a linha da meta (`SELECT ... FOR UPDATE`), para duas somas ao mesmo tempo não
   passarem do valor da meta;
2. desconta da conta só o que falta para a meta (faltavam R$ 200 e a pessoa pediu R$ 500 →
   saem R$ 200). Aqui **exige saldo**: guardar é mover dinheiro que existe;
3. cria uma transação na categoria **"Metas"**, já paga, para o histórico explicar o saldo;
4. soma na meta e recalcula o status (`em_progresso` / `concluida`).

Dinheiro guardado **não é gasto**: a transação "Metas" fica fora de todas as somas de gastos
nas telas (`ehGasto` em `auth.js`). Excluir uma meta não devolve o dinheiro à conta; a tela
avisa antes.

### Transferência entre contas

`POST /api/conta/transferencia` vira **duas transações** no mesmo `$transaction`:
"Transferência enviada" na conta de origem e "Transferência recebida" na de destino. Só entre
contas manuais, e exige saldo na origem. Transferência não é ganho nem gasto: o dinheiro
continua sendo da pessoa.

### Categorias personalizadas

- `categoria.id_usuario` vazio = categoria do **sistema** (de todos); preenchido = criada por
  aquele usuário e visível só para ele.
- O código **nunca** busca uma categoria só pelo id: usa `buscarCategoriaVisivel`
  (sistema + do usuário). Senão, alguém lançaria gastos na categoria de outra pessoa.
- O tipo (gasto/ganho) só muda enquanto a categoria não tem transações. Trocar depois
  inverteria o efeito delas no saldo.
- Excluir uma categoria com transações exige mover as transações para outra do **mesmo tipo**.

### Limite de gasto por categoria

- "No máximo R$ 500 por mês em Lazer". Renova sozinho no dia 1, porque o gasto do mês é
  sempre calculado de novo.
- Não é uma meta: a meta se cumpre quando o valor **chega** ao alvo; o limite, quando o gasto
  fica **abaixo**.
- Situação: `ok` (menos de 70%), `atencao` (70% a 99%) e `estourado` (100% ou mais).
- É só um aviso: o servidor não recusa um gasto acima do limite.

### Avisos do sininho

Nenhum aviso fica gravado. `GET /api/usuario/:id/notificacao` calcula a lista na hora: contas
a vencer em até 3 dias ou atrasadas, metas a até 30 dias do prazo ou já vencidas, saldo negativo e limites em
atenção ou estourados. Pagou a conta, o aviso some sozinho.

### Resetar os dados e excluir a conta

Em Configurações, "Zona de perigo":

- **Resetar** pede a senha e apaga contas, transações, metas, limites, categorias criadas e
  bancos conectados, tudo num `$transaction`, criando uma Carteira nova. O login continua.
- **Excluir a conta** tem três passos: pede a senha → manda um link por e-mail → a página do
  link mostra o que será apagado, e só então a pessoa confirma. Excluir não tem volta, por
  isso o link prova que quem pede também tem acesso ao e-mail.

### Links por e-mail (senha, troca de e-mail, exclusão)

- O link leva um token aleatório de 256 bits. O banco guarda só o **hash** dele: quem copiar
  o banco não consegue usar nenhum link.
- Cada link vale **30 minutos** e **uma vez só**. Pedir outro cancela o anterior.
- "Esqueci a senha" responde a mesma coisa exista o e-mail ou não, para não revelar quem é
  cadastrado.
- Trocar o e-mail pede a senha atual, manda o link para o **endereço novo** e avisa o
  **endereço antigo**. Trocar a senha cancela pedidos de troca de e-mail e de exclusão abertos.

### Importação bancária (banco simulado)

Só instituições autorizadas pelo Banco Central acessam o Open Finance de verdade, então o
banco é simulado, mas o fluxo imita o real:

1. Em Contas, "Conectar um banco" pede um **consentimento** ao banco e leva a pessoa à tela
   do banco (`/banco-simulado/autorizar`).
2. A pessoa autoriza. O banco devolve um **código** para a tela de Contas.
3. O Verdanz troca o código por um **token de acesso** e importa as contas e o extrato.

Regras: o Verdanz e o banco **só conversam por HTTP** (`src/clienteBanco.js`), como sistemas
separados. A importação é atômica, **não duplica** nada (cada transação guarda o código que o
banco deu, com índice único) e categoriza pelas palavras do extrato. Conta importada só muda
pelo banco: não dá para editar, excluir nem lançar à mão. O token de acesso nunca sai do
servidor.

---

## 6. Segurança, em resumo

| Ameaça | Como o Verdanz se protege |
| --- | --- |
| Roubo do banco de dados | Senhas com bcrypt; tokens de e-mail só como hash |
| Mexer nos dados de outra pessoa | `verificarDono` e conferência do dono em cada controller (conta, meta, limite, categoria) |
| Descobrir quem tem conta | Login e "esqueci a senha" respondem igual para e-mail existente ou não |
| Sessão esquecida aberta | Trocar e-mail, resetar e excluir pedem a senha; excluir ainda pede o link do e-mail |
| Texto malicioso nas telas (XSS) | Tudo que a pessoa digita passa por `esc()` antes de virar HTML |
| Clique duplo / pedidos ao mesmo tempo | Condições no próprio comando do banco (`updateMany` com `WHERE`) e `SELECT ... FOR UPDATE` nas metas |
| Link de e-mail falsificado | O endereço do site vem do `.env` (`APP_URL`), nunca do cabeçalho da requisição |
| CPF inventado | Os dígitos verificadores do CPF/CNPJ são conferidos no cadastro |

Limitação conhecida (e que vale saber explicar): o token fica no `localStorage`, que o
JavaScript da página consegue ler. A alternativa mais segura seria um cookie `httpOnly`.

---

## 7. O que fica só no navegador

Algumas coisas não estão no banco, de propósito, e por isso valem só naquele navegador:

- **Perfis financeiros** (CLT, autônomo...) escolhidos na pesquisa (`/perfil`) e o que a
  pessoa digita nas ferramentas de `/meu-perfil`. Guardar no banco exigiria tabelas novas.
- **Preferências**: tema, tamanho da letra e quais avisos do sininho mostrar.

Os valores oficiais usados nas ferramentas (salário mínimo, INSS, MEI, seguro-desemprego)
ficam em `VALORES_2026` (`public/js/perfil-calculos.js`) e mudam todo janeiro.

---

## 8. Mapa dos arquivos

| Onde | O que tem |
| --- | --- |
| `index.js` | Liga o Express: arquivos estáticos, telas, API, banco simulado e o tratamento de erros |
| `src/routes/viewRoutes.js` | Endereços das telas e os desvios dos endereços antigos |
| `src/routes/*Routes.js` | Endereços da API |
| `src/controllers/` | Regras de cada assunto (usuário, conta, transação, meta, limite, categoria, e-mail, senha, exclusão, notificação, conexão bancária) |
| `src/bancoSimulado/` | O banco de mentira: rotas próprias, tela de autorização e os dados (`dados.json`) |
| `src/views/` | As 14 telas em HTML |
| `public/css/verdanz.css` | Todo o visual: cores (com tema escuro), botões, cartões, menu, janelas |
| `public/css/inicial.css` | Só a página inicial |
| `public/js/` | Um script por tela, mais os compartilhados (`auth.js`, `base.js`, `casca.js`, `tema.js`) e os de cálculo (`meta-calculos.js`, `perfil-*.js`) |
| `prisma/schema.prisma` | O modelo do banco |
| `prisma/migrations/` | A migration que cria o banco |
| `prisma/seed.js` | As 15 categorias do sistema |
| `Docs/Testes/*.js` | Testes automáticos dos cálculos (`node Docs/Testes/teste-calculos-meta.js`...) |

### Convenções do código

- Nomes de tabelas e campos em português e em `snake_case` (`nome_usuario`, `id_categoria`);
  os models do Prisma em `PascalCase` (`Usuario`), ligados à tabela por `@@map("usuario")`.
- JavaScript em CommonJS (`require` / `module.exports`). Cada controller exporta suas funções
  nomeadas: `module.exports = { criarMeta, listarMetas, ... }`.
- Toda rota da API começa com `/api`, para não se misturar com os endereços das telas.
- Todo controller valida o que chegou **antes** de chamar o banco e responde erros em JSON
  dentro de um `try/catch`.
- Valores em dinheiro: sempre positivos no banco, com 2 casas (`Decimal(12, 2)`). Contas de
  somar e subtrair são feitas em centavos inteiros, porque em JavaScript `0.1 + 0.2` dá
  `0.30000000000000004`.

---

## 9. Rotas da API

Todas com prefixo `/api`. As marcadas com 🔓 são públicas; as outras exigem o token.

| Método | Rota | O que faz |
| --- | --- | --- |
| POST | `/usuario` 🔓 | Cadastrar (cria a Carteira junto) |
| POST | `/usuario/login` 🔓 | Entrar (devolve o token) |
| GET / PUT | `/usuario/:id` | Ver / alterar nome e CPF |
| POST | `/usuario/esqueci-senha` 🔓 | Mandar o link de senha nova |
| POST | `/usuario/redefinir-senha/verificar` 🔓 | Conferir se o link ainda vale |
| POST | `/usuario/redefinir-senha` 🔓 | Gravar a senha nova |
| POST | `/usuario/:id/email` | Pedir a troca de e-mail (com a senha atual) |
| POST | `/usuario/confirmar-email/verificar` 🔓 | Conferir o link da troca |
| POST | `/usuario/confirmar-email` 🔓 | Confirmar a troca |
| POST | `/usuario/:id/resetar` | Apagar os dados financeiros (com a senha) |
| POST | `/usuario/:id/excluir-conta` | Pedir a exclusão (com a senha; manda o link) |
| POST | `/usuario/excluir-conta/verificar` 🔓 | Mostrar o que será apagado |
| POST | `/usuario/excluir-conta` 🔓 | Confirmar a exclusão |
| GET | `/usuario/:id/conta` | Contas com saldo de hoje e previsto |
| POST | `/conta` | Criar conta |
| PUT / DELETE | `/conta/:id` | Alterar / excluir conta manual |
| POST | `/conta/transferencia` | Transferir entre duas contas manuais |
| GET | `/categoria` | Categorias do sistema + as do usuário |
| POST | `/categoria` | Criar categoria |
| PUT / DELETE | `/categoria/:id` | Alterar / excluir (`?mover_para=ID` se tiver transações) |
| POST | `/transacao` | Registrar ganho ou gasto |
| PATCH | `/transacao/:id/pagamento` | Marcar gasto como pago ou não pago |
| GET | `/usuario/:id/transacao` | Listar transações |
| POST | `/meta` | Criar meta (com valor inicial opcional) |
| GET | `/usuario/:id/meta` | Listar metas |
| PUT / DELETE | `/meta/:id` | Alterar / guardar dinheiro (`adicionar`) / excluir |
| POST | `/limite` | Criar limite |
| GET | `/usuario/:id/limite` | Limites com o gasto do mês e a situação |
| PUT / DELETE | `/limite/:id` | Alterar / remover limite |
| GET | `/usuario/:id/notificacao` | Avisos do sininho |
| POST | `/conexao-bancaria` | Começar a conexão com o banco |
| POST | `/conexao-bancaria/finalizar` | Trocar o código pelo acesso e importar |
| GET | `/conexao-bancaria` | Listar bancos conectados |
| POST | `/conexao-bancaria/:id/sincronizar` | Importar o que for novo |
| DELETE | `/conexao-bancaria/:id` | Desconectar (apaga as contas importadas) |

Códigos de resposta usados: **200/201** deu certo · **400** dado inválido · **401** sem login
ou token vencido · **403** não é seu · **404** não existe · **409** conflito (já existe, já
foi pago...) · **500** erro inesperado no servidor.

---

## 10. Perguntas que a banca pode fazer

**Por que a transação não guarda o usuário?**
Porque a conta já guarda. Repetir o dono na transação quebraria a 3ª Forma Normal e permitiria
uma transação "dizer" um dono diferente do da conta. O dono é encontrado pela conta.

**Como o sistema sabe se uma transação é ganho ou gasto?**
Pela categoria. "Salário" é receita, "Alimentação" é despesa. O valor é sempre positivo.

**Por que o saldo é guardado, se dá para calcular?**
Por desempenho: somar todo o histórico a cada tela aberta ficaria lento. Para não ficar
errado, ele só muda dentro da mesma operação atômica que cria ou altera uma transação.

**O que é uma operação atômica e onde vocês usam?**
Um conjunto de gravações que acontece inteiro ou não acontece (`prisma.$transaction`). Usamos
ao registrar transação, cadastrar usuário (com a Carteira), guardar dinheiro em meta,
transferir, importar extrato, resetar e excluir conta.

**Como vocês impedem que um usuário veja os dados de outro?**
O token JWT diz quem é a pessoa. O middleware `verificarDono` compara o id da URL com o do
token, e cada controller confere se a conta, meta, limite ou categoria pertence a quem pediu.

**Como a senha é guardada?**
Como hash bcrypt (custo 10). O hash não pode ser "descriptografado"; no login, o bcrypt aplica
o mesmo cálculo na senha digitada e compara.

**Para que serve o JWT?**
É um crachá assinado pelo servidor com o id do usuário. O navegador manda o crachá em cada
pedido; o servidor confere a assinatura com a `JWT_SECRET`. Ninguém consegue falsificar sem
a chave. Ele vale 1 dia.

**Por que o banco é simulado?**
O Open Finance real só aceita instituições autorizadas pelo Banco Central. O banco simulado
roda separado (só conversa por HTTP) e imita o fluxo real: consentimento, autorização,
código e token de acesso.

**Por que os perfis não estão no banco?**
O escopo foi reduzido de propósito para terminar o núcleo (contas, transações, categorias e
metas). Os perfis ficam no navegador; levá-los ao banco exigiria tabelas novas.

**Por que juntar as migrations numa só?**
Durante o desenvolvimento o banco mudou 11 vezes (o modelo começou com 12 entidades e foi
reduzido). Para a entrega, uma migration só cria o banco final direto, sem criar e apagar
tabelas no caminho. O histórico continua no git, e o banco resultante foi conferido como
idêntico.

**O que acontece se duas pessoas clicarem "Paguei" ao mesmo tempo?**
A condição "ainda não pago" vai no próprio comando de atualização do banco. Só o primeiro
pedido encontra a linha nessa condição e desconta o saldo; o segundo recebe "já está pago".
