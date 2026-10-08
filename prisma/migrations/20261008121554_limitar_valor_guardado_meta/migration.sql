-- Corrige metas que ficaram com mais dinheiro guardado do que o valor delas,
-- como "R$ 5.344 de R$ 3.000".
--
-- Esta migration não muda a estrutura do banco, só os dados. A partir desta
-- versão, o servidor não deixa o valor guardado passar do valor da meta
-- (ver atualizarMeta em src/controllers/metaController.js); aqui se acerta o
-- que já estava gravado antes de a regra existir.
UPDATE `meta` SET `valor_atual` = `valor_alvo` WHERE `valor_atual` > `valor_alvo`;
