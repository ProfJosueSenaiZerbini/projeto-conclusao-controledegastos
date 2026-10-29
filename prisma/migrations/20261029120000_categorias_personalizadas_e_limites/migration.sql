-- Categorias personalizadas e limite de gasto por categoria (Sprint 02).
--
-- 1) categoria.id_usuario: vazio = categoria do sistema (as 13 que já
--    existem continuam assim, sem nenhuma mudança nos dados);
--    preenchido = categoria criada por aquele usuário.
ALTER TABLE `categoria` ADD COLUMN `id_usuario` INTEGER NULL;

-- O mesmo usuário não repete nome de categoria.
CREATE UNIQUE INDEX `categoria_id_usuario_nome_categoria_key` ON `categoria`(`id_usuario`, `nome_categoria`);

-- Excluir o usuário apaga as categorias dele.
ALTER TABLE `categoria` ADD CONSTRAINT `categoria_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) limite_categoria: "no máximo X por mês nesta categoria".
--    O quanto já foi gasto não é uma coluna: é calculado das transações.
CREATE TABLE `limite_categoria` (
    `id_limite` INTEGER NOT NULL AUTO_INCREMENT,
    `valor_limite` DECIMAL(12, 2) NOT NULL,
    `id_usuario` INTEGER NOT NULL,
    `id_categoria` INTEGER NOT NULL,

    UNIQUE INDEX `limite_categoria_id_usuario_id_categoria_key`(`id_usuario`, `id_categoria`),
    PRIMARY KEY (`id_limite`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `limite_categoria` ADD CONSTRAINT `limite_categoria_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Excluir uma categoria personalizada apaga o limite dela.
ALTER TABLE `limite_categoria` ADD CONSTRAINT `limite_categoria_id_categoria_fkey` FOREIGN KEY (`id_categoria`) REFERENCES `categoria`(`id_categoria`) ON DELETE CASCADE ON UPDATE CASCADE;
