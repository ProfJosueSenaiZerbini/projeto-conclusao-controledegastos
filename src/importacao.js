const prisma = require('./prisma');
const banco = require('./clienteBanco');

const { ErroBanco } = banco;

// ---- IMPORTAÇÃO DE CONTAS E TRANSAÇÕES ----
//
// Busca no banco as contas e o extrato de uma conexão e grava no Verdanz.
// É aqui que acontece a TRADUÇÃO: o banco fala o "jeito do banco"
// (transactionName, creditDebitType...) e o Verdanz guarda no próprio
// modelo (descricao, id_categoria...).
//
// Pode ser chamada quantas vezes quiser: o que já foi importado é
// reconhecido pelo id_externo e não entra de novo.

// O tipo de conta do banco vira o nome da conta no Verdanz.
const NOME_DO_TIPO = {
  CONTA_DEPOSITO_A_VISTA: 'Conta corrente',
  CONTA_POUPANCA: 'Poupança',
};

// ---- CATEGORIZAÇÃO ----
//
// O banco não diz se uma compra foi "Alimentação" ou "Lazer": ele manda
// só a descrição do extrato, como "IFOOD *RESTAURANTE". Estas regras
// procuram palavras-chave na descrição.
//
// A primeira regra que bater E for do tipo certo vence. "Do tipo certo"
// quer dizer: uma entrada de dinheiro (CREDITO) só pode cair numa
// categoria de receita, e uma saída (DEBITO) numa de despesa. Assim uma
// transação nunca soma no saldo quando deveria subtrair.
//
// O que não bater com nenhuma regra cai em "Outras despesas" ou
// "Outras receitas". As palavras foram escolhidas para os dados do
// banco simulado; um app real usaria a categoria que o próprio banco
// informa ou um classificador mais sofisticado.
const REGRAS = [
  { categoria: 'Salário', palavras: ['SALARIO', 'BOLSA ESTAGIO'] },
  { categoria: 'Freelance', palavras: ['PROJETO', 'STUDIO', 'AGENCIA'] },
  { categoria: 'Investimentos', palavras: ['RENDIMENTO'] },
  { categoria: 'Alimentação', palavras: ['IFOOD', 'MERCADO', 'ATACADAO', 'PADARIA', 'CANTINA', 'RESTAURANTE'] },
  { categoria: 'Transporte', palavras: ['UBER', 'POSTO', 'BILHETE'] },
  { categoria: 'Moradia', palavras: ['ALUGUEL', 'IMOBILIARIA', 'ENERGIA', 'INTERNET'] },
  { categoria: 'Saúde', palavras: ['FARMACIA', 'DROGARIA'] },
  { categoria: 'Educação', palavras: ['FACULDADE', 'LIVRARIA', 'CURSO'] },
  { categoria: 'Lazer', palavras: ['NETFLIX', 'SPOTIFY', 'CINEMA'] },
  { categoria: 'Compras', palavras: ['RENNER', 'LOJA'] },
];

// "Farmácia" e "FARMACIA" precisam ser a mesma coisa para a comparação.
function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

// Carrega as 12 categorias num Map por nome, para não consultar o banco
// a cada transação.
async function carregarCategorias(cliente) {
  const lista = await cliente.categoria.findMany();
  const porNome = new Map(lista.map((c) => [c.nome_categoria, c]));

  if (!porNome.has('Outras despesas') || !porNome.has('Outras receitas')) {
    throw new ErroBanco(500, 'As categorias não estão cadastradas. Rode: npx prisma db seed');
  }

  return porNome;
}

function categorizar(transacao, categorias) {
  const tipo = transacao.creditDebitType === 'CREDITO' ? 'receita' : 'despesa';
  const descricao = normalizar(transacao.transactionName);

  for (const regra of REGRAS) {
    const categoria = categorias.get(regra.categoria);
    if (categoria && categoria.tipo === tipo && regra.palavras.some((p) => descricao.includes(p))) {
      return categoria;
    }
  }

  return categorias.get(tipo === 'receita' ? 'Outras receitas' : 'Outras despesas');
}

// ---- CONFERÊNCIA DO QUE O BANCO MANDOU ----
//
// Dado que vem de fora não é confiável só por vir de um banco. Um valor
// negativo ou uma data malformada corromperiam o saldo. Se algo estiver
// errado, a importação da conta inteira é cancelada.
function validarTransacao(t) {
  const valido =
    typeof t?.transactionId === 'string' && t.transactionId.length > 0 && t.transactionId.length <= 50 &&
    ['CREDITO', 'DEBITO'].includes(t.creditDebitType) &&
    /^\d{4}-\d{2}-\d{2}$/.test(t.transactionDate) &&
    /^\d+(\.\d{1,2})?$/.test(t.transactionAmount?.amount) &&
    Number(t.transactionAmount.amount) > 0;

  if (!valido) {
    throw new ErroBanco(502, 'O banco enviou uma transação em formato inválido. Nada foi importado dessa conta.');
  }
}

// Valores em centavos (inteiros) para somar sem erro de arredondamento:
// 0.1 + 0.2 em JavaScript dá 0.30000000000000004.
function emCentavos(valorTexto) {
  return Math.round(Number(valorTexto) * 100);
}

// "AAAA-MM-DD" de N dias antes de uma data.
function diasAntes(data, dias) {
  const copia = new Date(data);
  copia.setUTCDate(copia.getUTCDate() - dias);
  return copia.toISOString().slice(0, 10);
}

// ---- IMPORTAR UMA CONTA ----

async function acharOuCriarConta(conexao, contaBanco) {
  const filtro = { id_conexao: conexao.id_conexao, id_externo: contaBanco.accountId };

  const existente = await prisma.conta.findFirst({ where: filtro });
  if (existente) return { conta: existente, nova: false };

  try {
    const conta = await prisma.conta.create({
      data: {
        ...filtro,
        nome: NOME_DO_TIPO[contaBanco.type] || 'Conta bancária',
        saldo: 0,
        id_usuario: conexao.id_usuario,
      },
    });
    return { conta, nova: true };
  } catch (erro) {
    // P2002 = outra sincronização criou a mesma conta ao mesmo tempo.
    // O @@unique([id_conexao, id_externo]) barrou a segunda; usamos a
    // que já foi criada.
    if (erro.code === 'P2002') {
      return { conta: await prisma.conta.findFirst({ where: filtro }), nova: false };
    }
    throw erro;
  }
}

async function importarConta(conexao, contaBanco, categorias) {
  const { conta, nova } = await acharOuCriarConta(conexao, contaBanco);

  // Pede só o extrato recente, a partir da última transação já
  // importada. Volta 7 dias por segurança: bancos às vezes registram um
  // lançamento com data de alguns dias atrás. O que vier repetido é
  // reconhecido pelo id_externo e ignorado logo abaixo.
  const ultima = await prisma.transacao.findFirst({
    where: { id_conta: conta.id_conta, id_externo: { not: null } },
    orderBy: { data_transacao: 'desc' },
  });
  const desde = ultima ? diasAntes(ultima.data_transacao, 7) : undefined;

  const doBanco = await banco.listarTransacoes(conexao.token_acesso, contaBanco.accountId, desde);
  doBanco.forEach(validarTransacao);

  // ---- A OPERAÇÃO ATÔMICA ----
  //
  // Gravar as transações novas e atualizar o saldo acontecem juntos,
  // dentro do $transaction: ou tudo entra, ou nada entra. É a mesma
  // regra do registro manual, aplicada a um lote de transações.
  let novas;
  try {
    novas = await prisma.$transaction(async (tx) => {
      const existentes = await tx.transacao.findMany({
        where: { id_conta: conta.id_conta, id_externo: { in: doBanco.map((t) => t.transactionId) } },
        select: { id_externo: true },
      });
      const jaImportadas = new Set(existentes.map((t) => t.id_externo));
      const lista = doBanco.filter((t) => !jaImportadas.has(t.transactionId));

      if (lista.length === 0) return 0;

      let diferencaCentavos = 0;

      const linhas = lista.map((t) => {
        const categoria = categorizar(t, categorias);
        const centavos = emCentavos(t.transactionAmount.amount);
        diferencaCentavos += categoria.tipo === 'receita' ? centavos : -centavos;

        return {
          // Valor sempre positivo: a direção vem da categoria (3FN).
          valor_transacao: t.transactionAmount.amount,
          data_transacao: new Date(t.transactionDate),
          descricao: String(t.transactionName || '').slice(0, 150) || null,
          id_categoria: categoria.id_categoria,
          id_conta: conta.id_conta,
          id_externo: t.transactionId,
        };
      });

      await tx.transacao.createMany({ data: linhas });

      // Aqui NÃO existe a checagem de "saldo insuficiente" do registro
      // manual. Numa conta importada, quem manda é o banco: se ele diz
      // que a transação aconteceu, ela aconteceu. Recusar uma deixaria o
      // Verdanz diferente do extrato real.
      await tx.conta.update({
        where: { id_conta: conta.id_conta },
        data: { saldo: { increment: (diferencaCentavos / 100).toFixed(2) } },
      });

      return lista.length;
    });
  } catch (erro) {
    // Duas sincronizações ao mesmo tempo leram "não importada" e tentaram
    // gravar a mesma transação. O @@unique([id_conta, id_externo]) deixou
    // só a primeira passar, e a segunda foi desfeita por inteiro.
    if (erro.code === 'P2002') {
      throw new ErroBanco(409, 'Já existe uma sincronização em andamento. Aguarde e tente de novo.');
    }
    throw erro;
  }

  // ---- CONFERÊNCIA FINAL ----
  // O saldo do Verdanz tem que bater com o que o banco informa. Se não
  // bater, algo se perdeu no caminho, e a tela avisa em vez de esconder.
  const [saldoBanco, contaAtualizada] = await Promise.all([
    banco.buscarSaldo(conexao.token_acesso, contaBanco.accountId),
    prisma.conta.findUnique({ where: { id_conta: conta.id_conta } }),
  ]);

  return {
    id_conta: conta.id_conta,
    nome: conta.nome,
    conta_nova: nova,
    transacoes_novas: novas,
    saldo: Number(contaAtualizada.saldo),
    saldo_confere: emCentavos(contaAtualizada.saldo) === emCentavos(saldoBanco),
  };
}

// ---- SINCRONIZAR UMA CONEXÃO INTEIRA ----

async function sincronizar(conexao) {
  if (conexao.acesso_expira_em < new Date()) {
    throw new ErroBanco(409, 'A autorização do banco expirou. Conecte o banco de novo.', 'CONEXAO_EXPIRADA');
  }

  const categorias = await carregarCategorias(prisma);
  const contasDoBanco = await banco.listarContas(conexao.token_acesso);

  // Uma conta por vez, e não todas em paralelo: o extrato de cada uma
  // entra numa operação atômica própria, e o banco não é sobrecarregado.
  const contas = [];
  for (const contaBanco of contasDoBanco) {
    contas.push(await importarConta(conexao, contaBanco, categorias));
  }

  await prisma.conexaoBancaria.update({
    where: { id_conexao: conexao.id_conexao },
    data: { ultima_sincronizacao: new Date() },
  });

  return {
    contas,
    contas_novas: contas.filter((c) => c.conta_nova).length,
    transacoes_novas: contas.reduce((soma, c) => soma + c.transacoes_novas, 0),
    saldos_conferem: contas.every((c) => c.saldo_confere),
  };
}

module.exports = { sincronizar };
