-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_FIRST_NAME';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LAST_NAME';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_DOB';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_GENDER_IDENTITY';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LOCATION_NAME';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LOCATION_STATE';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LOCATION_ADDRESS';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LOCATION_CITY';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LOCATION_ZIP_CODE';
ALTER TYPE "FieldType" ADD VALUE 'RESIDENT_LOCATION_COUNTRY';
