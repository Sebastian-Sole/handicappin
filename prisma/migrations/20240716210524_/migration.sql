-- DropForeignKey
ALTER TABLE "Round" DROP CONSTRAINT "Round_courseId_fkey";

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
