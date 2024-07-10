/*
  Warnings:

  - You are about to drop the column `score` on the `Hole` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `holeNumber` to the `Hole` table without a default value. This is not possible if the table is not empty.
  - Added the required column `par` to the `Hole` table without a default value. This is not possible if the table is not empty.
  - Added the required column `courseId` to the `Round` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teeTime` to the `Round` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `userId` on the `Round` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Round" DROP CONSTRAINT "Round_userId_fkey";

-- AlterTable
ALTER TABLE "Hole" DROP COLUMN "score",
ADD COLUMN     "holeNumber" INTEGER NOT NULL,
ADD COLUMN     "par" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "courseId" INTEGER NOT NULL,
ADD COLUMN     "teeTime" TIMESTAMP(3) NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID NOT NULL;

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "handicapIndex" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "par" INTEGER NOT NULL,
    "courseRating" DOUBLE PRECISION NOT NULL,
    "slopeRating" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
