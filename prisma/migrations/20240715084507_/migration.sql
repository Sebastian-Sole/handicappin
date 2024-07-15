/*
  Warnings:

  - Added the required column `adjustedPar` to the `Round` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "adjustedPar" INTEGER NOT NULL;
