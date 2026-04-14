-- ============================================================
-- Step 1: Migrate data away from enum values being removed
-- ============================================================

-- Migrate statuses that disappear: TRANSFERRED, UNDER_REVIEW → DISPOSED
UPDATE "Asset" SET "status" = 'DISPOSED'
WHERE "status" IN ('TRANSFERRED', 'UNDER_REVIEW');

-- Migrate currencies that disappear: EUR, OTHER → CLP
UPDATE "Asset" SET "acquisitionCurrency" = 'CLP'
WHERE "acquisitionCurrency" IN ('EUR', 'OTHER');

-- ============================================================
-- Step 2: Replace AssetCurrency enum
-- ============================================================

ALTER TYPE "AssetCurrency" RENAME TO "AssetCurrency_old";
CREATE TYPE "AssetCurrency" AS ENUM ('CLP', 'PEN', 'USD', 'COP', 'ARS');
ALTER TABLE "Asset" ALTER COLUMN "acquisitionCurrency" TYPE "AssetCurrency" USING "acquisitionCurrency"::text::"AssetCurrency";
DROP TYPE "AssetCurrency_old";

-- ============================================================
-- Step 3: Replace AssetStatus enum
-- ============================================================

ALTER TYPE "AssetStatus" RENAME TO "AssetStatus_old";
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'DISPOSED', 'SOLD');
-- Drop the default before changing the column type, then restore it
ALTER TABLE "Asset" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Asset" ALTER COLUMN "status" TYPE "AssetStatus" USING "status"::text::"AssetStatus";
ALTER TABLE "Asset" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "AssetStatus_old";

-- ============================================================
-- Step 4: Add uniqueIdentifier column
-- ============================================================

ALTER TABLE "Asset" ADD COLUMN "uniqueIdentifier" TEXT;
CREATE UNIQUE INDEX "Asset_uniqueIdentifier_key" ON "Asset"("uniqueIdentifier");

-- ============================================================
-- Step 5: Seed the 4 required categories (upsert by code)
-- ============================================================

INSERT INTO "UsefulLifeCategory" ("id", "code", "name", "normalLifeMonths", "acceleratedLifeMonths")
VALUES
  (gen_random_uuid()::text, 'COMPUTADOR',    'Computador',        36, 36),
  (gen_random_uuid()::text, 'MONITOR',       'Monitor',           36, 36),
  (gen_random_uuid()::text, 'MUEBLE',        'Mueble',            84, 84),
  (gen_random_uuid()::text, 'AP_ELECTRONICO','Ap. electrónico',   36, 36)
ON CONFLICT ("code") DO UPDATE
  SET "name"                  = EXCLUDED."name",
      "normalLifeMonths"      = EXCLUDED."normalLifeMonths",
      "acceleratedLifeMonths" = EXCLUDED."acceleratedLifeMonths";
