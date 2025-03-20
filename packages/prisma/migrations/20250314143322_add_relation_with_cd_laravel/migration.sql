-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "activityStatus" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "documentDetails" JSONB,
ADD COLUMN     "formKey" VARCHAR(255),
ADD COLUMN     "residentId" UUID;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "activityStatus" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "formKey" VARCHAR(255);
