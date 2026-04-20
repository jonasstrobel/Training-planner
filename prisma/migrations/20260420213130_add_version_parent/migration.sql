-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlanVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "rationale" TEXT,
    "parentVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "PlanVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlanVersion" ("createdAt", "id", "planId", "rationale", "versionNumber") SELECT "createdAt", "id", "planId", "rationale", "versionNumber" FROM "PlanVersion";
DROP TABLE "PlanVersion";
ALTER TABLE "new_PlanVersion" RENAME TO "PlanVersion";
CREATE INDEX "PlanVersion_planId_idx" ON "PlanVersion"("planId");
CREATE INDEX "PlanVersion_parentVersionId_idx" ON "PlanVersion"("parentVersionId");
CREATE UNIQUE INDEX "PlanVersion_planId_versionNumber_key" ON "PlanVersion"("planId", "versionNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
