-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LOCATION_FAX';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LOCATION_LICENSING';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LOCATION_LICENSING_NAME';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LOCATION_ADMINISTRATOR_NAME';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LOCATION_ADMINISTRATOR_PHONE';
