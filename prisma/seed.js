const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// As 13 categorias do SISTEMA: 9 de despesa e 4 de receita. Elas ficam
// com id_usuario vazio e valem para todos. Além delas, cada usuário pode
// criar as suas (categorias personalizadas, ver categoriaController.js),
// que não passam pelo seed.
//
// O `tipo` aqui é o que define se uma transação é entrada ou saída.
// A transação não guarda essa informação por conta própria: quem
// classifica é a categoria (ver comentário em schema.prisma).

const categorias = [
  // ---- DESPESAS (8) ----
  { nome_categoria: 'Alimentação', tipo: 'despesa' },
  { nome_categoria: 'Moradia', tipo: 'despesa' },
  { nome_categoria: 'Transporte', tipo: 'despesa' },
  { nome_categoria: 'Saúde', tipo: 'despesa' },
  { nome_categoria: 'Educação', tipo: 'despesa' },
  { nome_categoria: 'Lazer', tipo: 'despesa' },
  { nome_categoria: 'Compras', tipo: 'despesa' },
  { nome_categoria: 'Outras despesas', tipo: 'despesa' },

  // ---- RECEITAS (4) ----
  { nome_categoria: 'Salário', tipo: 'receita' },
  { nome_categoria: 'Freelance', tipo: 'receita' },
  { nome_categoria: 'Investimentos', tipo: 'receita' },
  { nome_categoria: 'Outras receitas', tipo: 'receita' },

  // ---- METAS ----
  // Usada só pelo sistema: quando a pessoa guarda dinheiro numa meta, sai
  // uma transação desta categoria da conta escolhida (ver metaController).
  // Fica por último para ter o mesmo id (13) num banco novo e num banco
  // que recebeu a categoria pela migration "categoria_metas".
  { nome_categoria: 'Metas', tipo: 'despesa' },
];

async function main() {
  let criadas = 0;

  for (const categoria of categorias) {
    // Guarda de duplicidade: só cria se ainda não existir.
    // É isso que torna o seed idempotente — pode rodar quantas
    // vezes quiser sem duplicar nada.
    // id_usuario: null = procura só entre as do sistema. Uma categoria
    // personalizada com o mesmo nome não conta.
    const existente = await prisma.categoria.findFirst({
      where: { nome_categoria: categoria.nome_categoria, id_usuario: null },
    });

    if (!existente) {
      await prisma.categoria.create({ data: categoria });
      criadas++;
    }
  }

  const total = await prisma.categoria.count();
  console.log(`Categorias: ${criadas} criadas agora, ${total} no total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
