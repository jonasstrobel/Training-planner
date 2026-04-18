-- CreateTable
CREATE TABLE "AthleteProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "dob" DATETIME,
    "ftpWatts" INTEGER,
    "runThresholdPaceSecPerKm" INTEGER,
    "swimThresholdPaceSecPer100m" INTEGER,
    "weeklyHoursAvailable" REAL,
    "lastGarminSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "raceDistance" TEXT NOT NULL,
    "raceDate" DATETIME NOT NULL,
    "goal" TEXT,
    "startDate" DATETIME NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Plan_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "PlanVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "rationale" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Week" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "phase" TEXT NOT NULL,
    "focus" TEXT,
    "notes" TEXT,
    CONSTRAINT "Week_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "discipline" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMin" INTEGER NOT NULL,
    "intensityZone" TEXT,
    "targetDistanceKm" REAL,
    "targetLoadTss" INTEGER,
    CONSTRAINT "Session_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCallJson" TEXT,
    "toolResultJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT,
    "garminActivityId" TEXT,
    "source" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "discipline" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "distanceKm" REAL,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "avgPowerWatts" INTEGER,
    "trainingLoad" REAL,
    "rawJson" TEXT,
    CONSTRAINT "Activity_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_currentVersionId_key" ON "Plan"("currentVersionId");

-- CreateIndex
CREATE INDEX "PlanVersion_planId_idx" ON "PlanVersion"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_versionNumber_key" ON "PlanVersion"("planId", "versionNumber");

-- CreateIndex
CREATE INDEX "Week_planVersionId_idx" ON "Week"("planVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Week_planVersionId_weekNumber_key" ON "Week"("planVersionId", "weekNumber");

-- CreateIndex
CREATE INDEX "Session_weekId_idx" ON "Session"("weekId");

-- CreateIndex
CREATE INDEX "ChatMessage_planId_createdAt_idx" ON "ChatMessage"("planId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_garminActivityId_key" ON "Activity"("garminActivityId");

-- CreateIndex
CREATE INDEX "Activity_startedAt_idx" ON "Activity"("startedAt");

-- CreateIndex
CREATE INDEX "Activity_planId_idx" ON "Activity"("planId");
