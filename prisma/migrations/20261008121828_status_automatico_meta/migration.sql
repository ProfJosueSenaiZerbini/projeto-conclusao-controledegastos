-- Acerta o status das metas que já existiam antes do status automático.
--
-- A partir desta versão, "em_progresso" e "concluida" acompanham os valores
-- (ver recalcularStatus em src/controllers/metaController.js). Uma meta que
-- já tinha chegado ao valor continuava como em_progresso e contava como
-- ativa. Metas canceladas não mudam: cancelar é decisão da pessoa.
UPDATE `meta`
SET `status` = CASE WHEN `valor_atual` >= `valor_alvo` THEN 'concluida' ELSE 'em_progresso' END
WHERE `status` <> 'cancelada';
