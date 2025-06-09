-- DropIndex
DROP INDEX "Recipient_documentId_email_key";

-- DropIndex
DROP INDEX "Recipient_templateId_email_key";

-- AlterTable
ALTER TABLE "Recipient" ALTER COLUMN "email" DROP NOT NULL;
