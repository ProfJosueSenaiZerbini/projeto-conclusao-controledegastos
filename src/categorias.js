// Regras de categoria usadas por mais de um controller.
//
// Existem dois tipos de categoria na mesma tabela:
//
//   - do SISTEMA: id_usuario vazio. São as 13 do seed, iguais para todos.
//   - PERSONALIZADA: id_usuario preenchido. Criada por um usuário e
//     visível só para ele.
//
// Por isso, sempre que o código procurar uma categoria, ele precisa dizer
// de quem ela pode ser. Procurar só pelo id ou pelo nome encontraria a
// categoria de outra pessoa.

// Usada só pelo sistema: guardar dinheiro numa meta gera uma transação
// nesta categoria (ver guardarNaMeta em metaController.js).
const CATEGORIA_METAS = 'Metas';

// Usadas só pelo sistema: transferir dinheiro de uma conta para outra gera
// uma saída na conta de origem e uma entrada na de destino, nestas duas
// categorias (ver transferir em contaController.js). Transferência não é
// ganho nem gasto: o dinheiro continua sendo da pessoa.
const CATEGORIA_TRANSFERENCIA_SAIDA = 'Transferência enviada';
const CATEGORIA_TRANSFERENCIA_ENTRADA = 'Transferência recebida';

// Categorias que a pessoa não escolhe à mão: quem lança nelas é o sistema.
const CATEGORIAS_SO_DO_SISTEMA = [CATEGORIA_METAS, CATEGORIA_TRANSFERENCIA_SAIDA, CATEGORIA_TRANSFERENCIA_ENTRADA];

// A categoria é de transferência? Só vale para as do sistema: ninguém
// consegue criar uma personalizada com esses nomes (conferirNome).
function ehTransferencia(categoria) {
  return (
    categoria.id_usuario === null &&
    [CATEGORIA_TRANSFERENCIA_SAIDA, CATEGORIA_TRANSFERENCIA_ENTRADA].includes(categoria.nome_categoria)
  );
}

// "Lazer", "lazer" e "LÁZER" precisam ser o mesmo nome na comparação.
function normalizarNome(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

// Filtro do Prisma: as categorias do sistema mais as do usuário.
function visiveisPara(id_usuario) {
  return { OR: [{ id_usuario: null }, { id_usuario }] };
}

// Busca uma categoria que o usuário pode usar: do sistema ou dele.
// Devolve null se não existir ou se for de outra pessoa (para quem
// pergunta, as duas situações são iguais: "não encontrada").
// `cliente` é o prisma ou o `tx` de um $transaction.
function buscarCategoriaVisivel(cliente, id_categoria, id_usuario) {
  return cliente.categoria.findFirst({
    where: { id_categoria, ...visiveisPara(id_usuario) },
  });
}

module.exports = {
  CATEGORIA_METAS,
  CATEGORIA_TRANSFERENCIA_SAIDA,
  CATEGORIA_TRANSFERENCIA_ENTRADA,
  CATEGORIAS_SO_DO_SISTEMA,
  ehTransferencia,
  normalizarNome,
  visiveisPara,
  buscarCategoriaVisivel,
};
