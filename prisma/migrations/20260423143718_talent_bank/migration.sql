/*
  Warnings:

  - Added the required column `updatedAt` to the `RubricVersion` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillTrack" TEXT,
    "level" TEXT,
    "slot" INTEGER,
    "theme" TEXT,
    "prompt" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuestionVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionVariant_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RubricVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleType" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RubricVersion" ("createdAt", "definition", "id", "level", "roleType", "version") SELECT "createdAt", "definition", "id", "level", "roleType", "version" FROM "RubricVersion";
DROP TABLE "RubricVersion";
ALTER TABLE "new_RubricVersion" RENAME TO "RubricVersion";
CREATE UNIQUE INDEX "RubricVersion_roleType_level_version_key" ON "RubricVersion"("roleType", "level", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
