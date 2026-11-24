-- Cria o banco do Verdanz inteiro, já no formato final.
--
-- Durante o desenvolvimento o banco mudou em 11 migrations (o modelo
-- começou com 12 entidades e foi reduzido, depois vieram os links por
-- e-mail, o banco simulado, as categorias personalizadas e os limites).
-- Para a entrega, elas foram juntadas nesta única migration, gerada a
-- partir do prisma/schema.prisma com:
--
--   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
--
-- As 15 categorias do sistema não estão aqui: quem as cadastra é o
-- prisma/seed.js, que roda logo depois (npx prisma migrate dev faz os dois).
-- O histórico das migrations antigas continua no git.

-- CreateTable
CREATE TABLE `usuario` (
    `id_usuario` INTEGER NOT NULL AUTO_INCREMENT,
    `nome_usuario` VARCHAR(100) NOT NULL,
    `cpf_cnpj` VARCHAR(20) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `senha` VARCHAR(255) NOT NULL,
    `data_cadastro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuario_cpf_cnpj_key`(`cpf_cnpj`),
    UNIQUE INDEX `usuario_email_key`(`email`),
    PRIMARY KEY (`id_usuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `token_usuario` (
    `id_token` INTEGER NOT NULL AUTO_INCREMENT,
    `token_hash` CHAR(64) NOT NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `email_novo` VARCHAR(100) NULL,
    `expira_em` DATETIME(3) NOT NULL,
    `usado_em` DATETIME(3) NULL,
    `data_criacao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id_usuario` INTEGER NOT NULL,

    UNIQUE INDEX `token_usuario_token_hash_key`(`token_hash`),
    INDEX `token_usuario_id_usuario_tipo_idx`(`id_usuario`, `tipo`),
    PRIMARY KEY (`id_token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conta` (
    `id_conta` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(100) NOT NULL,
    `saldo` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `id_usuario` INTEGER NOT NULL,
    `id_conexao` INTEGER NULL,
    `id_externo` VARCHAR(50) NULL,

    UNIQUE INDEX `conta_id_conexao_id_externo_key`(`id_conexao`, `id_externo`),
    PRIMARY KEY (`id_conta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `categoria` (
    `id_categoria` INTEGER NOT NULL AUTO_INCREMENT,
    `nome_categoria` VARCHAR(100) NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `id_usuario` INTEGER NULL,

    UNIQUE INDEX `categoria_id_usuario_nome_categoria_key`(`id_usuario`, `nome_categoria`),
    PRIMARY KEY (`id_categoria`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transacao` (
    `id_transacao` INTEGER NOT NULL AUTO_INCREMENT,
    `valor_transacao` DECIMAL(12, 2) NOT NULL,
    `data_transacao` DATE NOT NULL,
    `descricao` VARCHAR(150) NULL,
    `id_categoria` INTEGER NOT NULL,
    `id_conta` INTEGER NOT NULL,
    `id_externo` VARCHAR(50) NULL,
    `data_pagamento` DATE NULL,

    INDEX `transacao_id_conta_data_transacao_idx`(`id_conta`, `data_transacao`),
    UNIQUE INDEX `transacao_id_conta_id_externo_key`(`id_conta`, `id_externo`),
    PRIMARY KEY (`id_transacao`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta` (
    `id_meta` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(100) NOT NULL,
    `valor_alvo` DECIMAL(12, 2) NOT NULL,
    `valor_atual` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `data_limite` DATE NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'em_progresso',
    `id_usuario` INTEGER NOT NULL,

    INDEX `meta_id_usuario_status_idx`(`id_usuario`, `status`),
    PRIMARY KEY (`id_meta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `limite_categoria` (
    `id_limite` INTEGER NOT NULL AUTO_INCREMENT,
    `valor_limite` DECIMAL(12, 2) NOT NULL,
    `id_usuario` INTEGER NOT NULL,
    `id_categoria` INTEGER NOT NULL,

    UNIQUE INDEX `limite_categoria_id_usuario_id_categoria_key`(`id_usuario`, `id_categoria`),
    PRIMARY KEY (`id_limite`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `token_usuario` ADD CONSTRAINT `token_usuario_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conta` ADD CONSTRAINT `conta_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conta` ADD CONSTRAINT `conta_id_conexao_fkey` FOREIGN KEY (`id_conexao`) REFERENCES `conexao_bancaria`(`id_conexao`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conexao_bancaria` ADD CONSTRAINT `conexao_bancaria_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categoria` ADD CONSTRAINT `categoria_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transacao` ADD CONSTRAINT `transacao_id_categoria_fkey` FOREIGN KEY (`id_categoria`) REFERENCES `categoria`(`id_categoria`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transacao` ADD CONSTRAINT `transacao_id_conta_fkey` FOREIGN KEY (`id_conta`) REFERENCES `conta`(`id_conta`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meta` ADD CONSTRAINT `meta_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `limite_categoria` ADD CONSTRAINT `limite_categoria_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `limite_categoria` ADD CONSTRAINT `limite_categoria_id_categoria_fkey` FOREIGN KEY (`id_categoria`) REFERENCES `categoria`(`id_categoria`) ON DELETE CASCADE ON UPDATE CASCADE;

