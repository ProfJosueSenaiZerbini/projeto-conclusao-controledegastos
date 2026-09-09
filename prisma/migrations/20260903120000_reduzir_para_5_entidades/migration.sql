-- DropForeignKey
ALTER TABLE `categoria` DROP FOREIGN KEY `categoria_id_categoria_pai_fkey`;

-- DropForeignKey
ALTER TABLE `formulario_perfil` DROP FOREIGN KEY `formulario_perfil_id_usuario_fkey`;

-- DropForeignKey
ALTER TABLE `pergunta_formulario` DROP FOREIGN KEY `pergunta_formulario_id_perfil_fkey`;

-- DropForeignKey
ALTER TABLE `resposta_formulario` DROP FOREIGN KEY `resposta_formulario_id_formulario_fkey`;

-- DropForeignKey
ALTER TABLE `resposta_formulario` DROP FOREIGN KEY `resposta_formulario_id_pergunta_fkey`;

-- DropForeignKey
ALTER TABLE `transacao` DROP FOREIGN KEY `transacao_id_usuario_fkey`;

-- DropForeignKey
ALTER TABLE `usuario_perfil` DROP FOREIGN KEY `usuario_perfil_id_perfil_fkey`;

-- DropForeignKey
ALTER TABLE `usuario_perfil` DROP FOREIGN KEY `usuario_perfil_id_usuario_fkey`;

-- DropIndex
DROP INDEX `categoria_id_categoria_pai_fkey` ON `categoria`;

-- DropIndex
DROP INDEX `transacao_id_usuario_data_transacao_idx` ON `transacao`;

-- AlterTable
ALTER TABLE `categoria` DROP COLUMN `descricao`,
    DROP COLUMN `id_categoria_pai`,
    MODIFY `tipo` VARCHAR(20) NOT NULL;

-- AlterTable
ALTER TABLE `conta` DROP COLUMN `data_vencimento`,
    DROP COLUMN `status`,
    DROP COLUMN `tipo`,
    DROP COLUMN `valor`,
    MODIFY `saldo` DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE `transacao` DROP COLUMN `id_usuario`,
    DROP COLUMN `recebedor`,
    DROP COLUMN `tipo_transacao`,
    ADD COLUMN `descricao` VARCHAR(150) NULL;

-- DropTable
DROP TABLE `formulario_perfil`;

-- DropTable
DROP TABLE `perfil`;

-- DropTable
DROP TABLE `pergunta_formulario`;

-- DropTable
DROP TABLE `resposta_formulario`;

-- DropTable
DROP TABLE `usuario_perfil`;

-- CreateIndex
CREATE INDEX `transacao_id_conta_data_transacao_idx` ON `transacao`(`id_conta`, `data_transacao`);

