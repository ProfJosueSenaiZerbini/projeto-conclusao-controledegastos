// Instância única (singleton) do Prisma Client.
//
// Todos os controllers importam DESTE arquivo em vez de criar
// um `new PrismaClient()` próprio. Cada instância abre seu próprio
// pool de conexões com o MySQL — ter uma por controller desperdiça
// conexões e pode estourar o limite do banco.

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
