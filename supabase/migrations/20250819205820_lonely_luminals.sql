DROP INDEX "course_name_key";--> statement-breakpoint
CREATE UNIQUE INDEX "course_name_country_city_key" ON "course" USING btree ("name" text_ops,"country" text_ops,"city" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "hole_teeId_holeNumber_key" ON "hole" USING btree ("teeId" int4_ops,"holeNumber" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "teeInfo_courseId_name_gender_key" ON "teeInfo" USING btree ("courseId" int4_ops,"name" text_ops,"gender" text_ops);