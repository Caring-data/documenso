/*
  Warnings:

  - Added the required column `formKey` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `residentId` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "formKey" VARCHAR(255) NOT NULL,
ADD COLUMN     "residentId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "status" "TemplateStatus" NOT NULL DEFAULT 'ACTIVE';
