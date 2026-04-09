-- CreateEnum
CREATE TYPE "EconomicIndexType" AS ENUM ('USD_OBSERVED', 'UF', 'IPC');

-- CreateEnum
CREATE TYPE "AssetCurrency" AS ENUM ('CLP', 'USD', 'EUR', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'DISPOSED', 'TRANSFERRED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicIndex" (
    "id" TEXT NOT NULL,
    "type" "EconomicIndexType" NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(24,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomicIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsefulLifeCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalLifeMonths" INTEGER NOT NULL,
    "acceleratedLifeMonths" INTEGER NOT NULL,

    CONSTRAINT "UsefulLifeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "acquisitionDate" DATE NOT NULL,
    "invoiceNumber" TEXT,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "acquisitionCurrency" "AssetCurrency" NOT NULL,
    "acquisitionAmountOriginal" DECIMAL(24,4) NOT NULL,
    "historicalValueClp" DECIMAL(24,2) NOT NULL,
    "creditAfPercent" DECIMAL(7,4),
    "acceleratedDepreciation" BOOLEAN NOT NULL DEFAULT false,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "disposedAt" DATE,
    "disposalReason" TEXT,
    "odooAssetRef" TEXT,
    "odooMoveRef" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPeriodSnapshot" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "cmFactor" DECIMAL(24,10) NOT NULL,
    "updatedGrossValue" DECIMAL(24,2) NOT NULL,
    "depHistorical" DECIMAL(24,2) NOT NULL,
    "depCmAdjustment" DECIMAL(24,2) NOT NULL,
    "depUpdated" DECIMAL(24,2) NOT NULL,
    "netToDepreciate" DECIMAL(24,2) NOT NULL,
    "monthsRemainingInYear" INTEGER NOT NULL,
    "depreciationForPeriod" DECIMAL(24,2) NOT NULL,
    "accumulatedDepreciation" DECIMAL(24,2) NOT NULL,
    "netBookValue" DECIMAL(24,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPeriodSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "EconomicIndex_type_date_idx" ON "EconomicIndex"("type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicIndex_type_date_key" ON "EconomicIndex"("type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "UsefulLifeCategory_code_key" ON "UsefulLifeCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_year_month_key" ON "AccountingPeriod"("year", "month");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "Asset_acquisitionDate_idx" ON "Asset"("acquisitionDate");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPeriodSnapshot_assetId_periodId_key" ON "AssetPeriodSnapshot"("assetId", "periodId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "UsefulLifeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPeriodSnapshot" ADD CONSTRAINT "AssetPeriodSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPeriodSnapshot" ADD CONSTRAINT "AssetPeriodSnapshot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
