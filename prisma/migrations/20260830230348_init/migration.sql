-- CreateTable
CREATE TABLE `perfil` (
    `id_perfil` INTEGER NOT NULL AUTO_INCREMENT,
    `nome_perfil` VARCHAR(50) NOT NULL,
    `descricao` VARCHAR(200) NULL,
    `regra_economica_sugerida` VARCHAR(200) NULL,

    UNIQUE INDEX `perfil_nome_perfil_key`(`nome_perfil`),
    PRIMARY KEY (`id_perfil`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
CREATE TABLE `usuario_perfil` (
    `id_usuario` INTEGER NOT NULL,
    `id_perfil` INTEGER NOT NULL,
    `data_selecao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id_usuario`, `id_perfil`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pergunta_formulario` (
    `id_pergunta` INTEGER NOT NULL AUTO_INCREMENT,
    `texto_pergunta` VARCHAR(300) NOT NULL,
    `id_perfil` INTEGER NOT NULL,

    PRIMARY KEY (`id_pergunta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `formulario_perfil` (
    `id_formulario` INTEGER NOT NULL AUTO_INCREMENT,
    `data_preenchimento` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id_usuario` INTEGER NOT NULL,

    PRIMARY KEY (`id_formulario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resposta_formulario` (
    `id_resposta` INTEGER NOT NULL AUTO_INCREMENT,
    `id_formulario` INTEGER NOT NULL,
    `id_pergunta` INTEGER NOT NULL,
    `resposta_texto` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id_resposta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categoria` (
    `id_categoria` INTEGER NOT NULL AUTO_INCREMENT,
    `nome_categoria` VARCHAR(100) NOT NULL,
    `tipo` VARCHAR(50) NOT NULL,
    `descricao` VARCHAR(200) NULL,
    `id_categoria_pai` INTEGER NULL,

    PRIMARY KEY (`id_categoria`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conta` (
    `id_conta` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(100) NOT NULL,
    `tipo` VARCHAR(50) NOT NULL,
    `saldo` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `valor` DECIMAL(12, 2) NULL,
    `data_vencimento` DATE NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ativo',
    `id_usuario` INTEGER NOT NULL,

    PRIMARY KEY (`id_conta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transacao` (
    `id_transacao` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo_transacao` VARCHAR(50) NOT NULL,
    `valor_transacao` DECIMAL(12, 2) NOT NULL,
    `data_transacao` DATE NOT NULL,
    `recebedor` VARCHAR(100) NULL,
    `id_categoria` INTEGER NOT NULL,
    `id_conta` INTEGER NOT NULL,
    `id_usuario` INTEGER NOT NULL,

    INDEX `transacao_id_usuario_data_transacao_idx`(`id_usuario`, `data_transacao`),
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

-- AddForeignKey
ALTER TABLE `usuario_perfil` ADD CONSTRAINT `usuario_perfil_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_perfil` ADD CONSTRAINT `usuario_perfil_id_perfil_fkey` FOREIGN KEY (`id_perfil`) REFERENCES `perfil`(`id_perfil`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pergunta_formulario` ADD CONSTRAINT `pergunta_formulario_id_perfil_fkey` FOREIGN KEY (`id_perfil`) REFERENCES `perfil`(`id_perfil`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `formulario_perfil` ADD CONSTRAINT `formulario_perfil_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resposta_formulario` ADD CONSTRAINT `resposta_formulario_id_formulario_fkey` FOREIGN KEY (`id_formulario`) REFERENCES `formulario_perfil`(`id_formulario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resposta_formulario` ADD CONSTRAINT `resposta_formulario_id_pergunta_fkey` FOREIGN KEY (`id_pergunta`) REFERENCES `pergunta_formulario`(`id_pergunta`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categoria` ADD CONSTRAINT `categoria_id_categoria_pai_fkey` FOREIGN KEY (`id_categoria_pai`) REFERENCES `categoria`(`id_categoria`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conta` ADD CONSTRAINT `conta_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transacao` ADD CONSTRAINT `transacao_id_categoria_fkey` FOREIGN KEY (`id_categoria`) REFERENCES `categoria`(`id_categoria`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transacao` ADD CONSTRAINT `transacao_id_conta_fkey` FOREIGN KEY (`id_conta`) REFERENCES `conta`(`id_conta`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transacao` ADD CONSTRAINT `transacao_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meta` ADD CONSTRAINT `meta_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;
