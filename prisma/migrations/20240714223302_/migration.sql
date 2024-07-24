/*
  Warnings:

  - You are about to drop the column `score` on the `Round` table. All the data in the column will be lost.
  - Added the required column `adjustedGrossScore` to the `Round` table without a default value. This is not possible if the table is not empty.
  - Added the required column `existingHandicapIndex` to the `Round` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scoreDifferential` to the `Round` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalStrokes` to the `Round` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Round" DROP COLUMN "score",
ADD COLUMN     "adjustedGrossScore" INTEGER NOT NULL,
ADD COLUMN     "existingHandicapIndex" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "scoreDifferential" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalStrokes" INTEGER NOT NULL;
