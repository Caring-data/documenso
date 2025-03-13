-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "documentDetails" JSONB,
ADD COLUMN     "formKey" VARCHAR(255),
ADD COLUMN     "residentId" UUID;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "formKey" VARCHAR(255),
ADD COLUMN     "status" "TemplateStatus" NOT NULL DEFAULT 'ACTIVE';
