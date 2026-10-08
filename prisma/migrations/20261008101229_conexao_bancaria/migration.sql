-- AlterTable
ALTER TABLE `conta` ADD COLUMN `id_conexao` INTEGER NULL,
    ADD COLUMN `id_externo` VARCHAR(50) NULL;

-- AlterTable
ALTER TABLE `transacao` ADD COLUMN `id_externo` VARCHAR(50) NULL;

-- CreateTable
CREATE TABLE `conexao_bancaria` (
    `id_conexao` INTEGER NOT NULL AUTO_INCREMENT,
    `banco` VARCHAR(100) NOT NULL,
    `token_acesso` TEXT NOT NULL,
    `acesso_expira_em` DATETIME(3) NOT NULL,
    `data_conexao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ultima_sincronizacao` DATETIME(3) NULL,
    `id_usuario` INTEGER NOT NULL,
    UNIQUE INDEX `conexao_bancaria_id_usuario_banco_key`(`id_usuario`, `banco`),
    PRIMARY KEY (`id_conexao`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `conta_id_conexao_id_externo_key` ON `conta`(`id_conexao`, `id_externo`);

-- CreateIndex
CREATE UNIQUE INDEX `transacao_id_conta_id_externo_key` ON `transacao`(`id_conta`, `id_externo`);

-- AddForeignKey
ALTER TABLE `conta` ADD CONSTRAINT `conta_id_conexao_fkey` FOREIGN KEY (`id_conexao`) REFERENCES `conexao_bancaria`(`id_conexao`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conexao_bancaria` ADD CONSTRAINT `conexao_bancaria_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;
