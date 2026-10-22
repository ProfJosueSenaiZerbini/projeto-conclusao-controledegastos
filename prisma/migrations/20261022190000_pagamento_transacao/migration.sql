-- Acrescenta a data de pagamento dos gastos.
--
-- A partir desta versão, um gasto só sai do saldo quando é marcado como
-- pago (ver transacaoController.js). Vazio = ainda não pago.
-- Ganhos não usam este campo.
ALTER TABLE `transacao` ADD COLUMN `data_pagamento` DATE NULL;

-- Até aqui, todo gasto saía do saldo no momento em que era lançado.
-- Para o saldo continuar certo com a regra nova:
--
-- 1) Gastos com data até hoje, gastos importados do banco e os de "Metas"
--    contam como pagos, no próprio dia do gasto.
UPDATE `transacao` t
JOIN `categoria` c ON c.`id_categoria` = t.`id_categoria`
JOIN `conta` ct ON ct.`id_conta` = t.`id_conta`
SET t.`data_pagamento` = t.`data_transacao`
WHERE c.`tipo` = 'despesa'
  AND (t.`data_transacao` <= CURDATE()
       OR ct.`id_conexao` IS NOT NULL
       OR c.`nome_categoria` = 'Metas');

-- 2) Gastos com data futura (contas a pagar) ficam como NÃO pagos.
--    Eles já tinham sido descontados do saldo, então o valor volta para a
--    conta: agora só sai quando a pessoa marcar como pago.
UPDATE `conta` ct
JOIN (
  SELECT t.`id_conta`, SUM(t.`valor_transacao`) AS `total`
  FROM `transacao` t
  JOIN `categoria` c ON c.`id_categoria` = t.`id_categoria`
  WHERE c.`tipo` = 'despesa' AND t.`data_pagamento` IS NULL
  GROUP BY t.`id_conta`
) p ON p.`id_conta` = ct.`id_conta`
SET ct.`saldo` = ct.`saldo` + p.`total`;
