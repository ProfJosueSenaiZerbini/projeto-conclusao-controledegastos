-- Acrescenta as categorias de transferência entre contas nos bancos que já existem.
--
-- Esta migration não muda a estrutura do banco, só os dados. A partir desta
-- versão, passar dinheiro de uma conta para outra (tela de Contas) registra
-- uma saída em "Transferência enviada" na conta de origem e uma entrada em
-- "Transferência recebida" na de destino (ver transferir em
-- src/controllers/contaController.js).
--
-- As condições do WHERE são as mesmas da migration "categoria_metas":
-- - "EXISTS": num banco novo, a tabela ainda está vazia neste ponto, porque
--   quem cadastra as categorias é o seed (que já inclui estas duas).
-- - "NOT EXISTS": não duplica, se a categoria do sistema já existir.
INSERT INTO `categoria` (`nome_categoria`, `tipo`)
SELECT 'Transferência enviada', 'despesa' FROM DUAL
WHERE EXISTS (SELECT 1 FROM `categoria`)
  AND NOT EXISTS (SELECT 1 FROM `categoria` WHERE `nome_categoria` = 'Transferência enviada' AND `id_usuario` IS NULL);

INSERT INTO `categoria` (`nome_categoria`, `tipo`)
SELECT 'Transferência recebida', 'receita' FROM DUAL
WHERE EXISTS (SELECT 1 FROM `categoria`)
  AND NOT EXISTS (SELECT 1 FROM `categoria` WHERE `nome_categoria` = 'Transferência recebida' AND `id_usuario` IS NULL);
