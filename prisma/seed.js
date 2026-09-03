const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// As 12 categorias fixas do escopo atual: 8 de despesa e 4 de receita.
// A lista é fechada — o usuário não cria categorias nesta fase.
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
];

async function main() {
  let criadas = 0;

  for (const categoria of categorias) {
    // Guarda de duplicidade: só cria se ainda não existir.
    // É isso que torna o seed idempotente — pode rodar quantas
    // vezes quiser sem duplicar nada.
    const existente = await prisma.categoria.findFirst({
      where: { nome_categoria: categoria.nome_categoria },
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
