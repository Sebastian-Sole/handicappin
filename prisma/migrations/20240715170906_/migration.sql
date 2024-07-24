/*
  Warnings:

  - You are about to drop the column `par` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `adjustedPar` on the `Round` table. All the data in the column will be lost.
  - Added the required column `eighteenHolePar` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nineHolePar` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Course" DROP COLUMN "par",
ADD COLUMN     "eighteenHolePar" INTEGER NOT NULL,
ADD COLUMN     "nineHolePar" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Round" DROP COLUMN "adjustedPar",
ADD COLUMN     "notes" TEXT;
