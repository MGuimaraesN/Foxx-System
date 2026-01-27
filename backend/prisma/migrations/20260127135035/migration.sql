-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ServiceOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "osNumber" INTEGER NOT NULL,
    "entryDate" DATETIME NOT NULL,
    "customerName" TEXT NOT NULL,
    "serviceValue" DECIMAL NOT NULL,
    "commissionValue" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "brandId" TEXT NOT NULL,
    "periodId" TEXT,
    CONSTRAINT "ServiceOrder_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceOrder_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceOrder" ("brandId", "commissionValue", "createdAt", "customerName", "entryDate", "id", "osNumber", "paidAt", "paymentMethod", "periodId", "serviceValue", "status") SELECT "brandId", "commissionValue", "createdAt", "customerName", "entryDate", "id", "osNumber", "paidAt", "paymentMethod", "periodId", "serviceValue", "status" FROM "ServiceOrder";
DROP TABLE "ServiceOrder";
ALTER TABLE "new_ServiceOrder" RENAME TO "ServiceOrder";
CREATE UNIQUE INDEX "ServiceOrder_osNumber_key" ON "ServiceOrder"("osNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
