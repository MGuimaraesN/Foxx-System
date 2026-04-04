CREATE INDEX IF NOT EXISTS "ServiceOrder_entryDate_osNumber_idx" ON "ServiceOrder"("entryDate", "osNumber");
CREATE INDEX IF NOT EXISTS "ServiceOrder_status_entryDate_idx" ON "ServiceOrder"("status", "entryDate");
CREATE INDEX IF NOT EXISTS "ServiceOrder_brandId_entryDate_idx" ON "ServiceOrder"("brandId", "entryDate");
