-- CreateTable
CREATE TABLE `token_usuario` (
    `id_token` INTEGER NOT NULL AUTO_INCREMENT,
    `token_hash` CHAR(64) NOT NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `expira_em` DATETIME(3) NOT NULL,
    `usado_em` DATETIME(3) NULL,
    `data_criacao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id_usuario` INTEGER NOT NULL,

    UNIQUE INDEX `token_usuario_token_hash_key`(`token_hash`),
    INDEX `token_usuario_id_usuario_tipo_idx`(`id_usuario`, `tipo`),
    PRIMARY KEY (`id_token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `token_usuario` ADD CONSTRAINT `token_usuario_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;
