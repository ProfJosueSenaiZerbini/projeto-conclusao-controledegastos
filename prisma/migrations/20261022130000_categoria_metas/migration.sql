-- Acrescenta a categoria "Metas" (despesa) nos bancos que já existem.
--
-- Esta migration não muda a estrutura do banco, só os dados. A partir desta
-- versão, guardar dinheiro numa meta tira o valor de uma conta e registra uma
-- transação nesta categoria (ver guardarNaMeta em src/controllers/metaController.js).
--
-- As duas condições do WHERE:
-- - "EXISTS": num banco novo, a tabela ainda está vazia neste ponto, porque
--   quem cadastra as categorias é o seed (que já inclui "Metas"). Sem esta
--   condição, "Metas" nasceria com o id 1 e empurraria as outras.
-- - "NOT EXISTS": não duplica, se a categoria já tiver sido criada pelo seed.
INSERT INTO `categoria` (`nome_categoria`, `tipo`)
SELECT 'Metas', 'despesa' FROM DUAL
WHERE EXISTS (SELECT 1 FROM `categoria`)
  AND NOT EXISTS (SELECT 1 FROM `categoria` WHERE `nome_categoria` = 'Metas');
