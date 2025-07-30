-- St. Andrews Old Course Seed Data

-- Insert course
INSERT INTO course (id, name, "approvalStatus") VALUES 
(10823, 'St. Andrews Old Course', 'approved');

-- Insert tee information for female tees
INSERT INTO "teeInfo" ("courseId", name, gender, "courseRating18", "slopeRating18", "courseRatingFront9", "slopeRatingFront9", "courseRatingBack9", "slopeRatingBack9", "outPar", "inPar", "totalPar", "outDistance", "inDistance", "totalDistance", "distanceMeasurement", "approvalStatus", "isArchived", version) VALUES
-- Female Black Tee
(10823, 'Black', 'female', 79.8, 148, 39.5, 147, 40.3, 149, 38, 38, 76, 3350, 2749, 6099, 'yards', 'approved', false, 1),
-- Female Blue Tee
(10823, 'Blue', 'female', 78.2, 143, 38.6, 141, 39.6, 145, 38, 38, 76, 3150, 2658, 5808, 'yards', 'approved', false, 1),
-- Female Championship Tee
(10823, 'Championship', 'female', 77.6, 142, 38.4, 139, 39.2, 145, 38, 38, 76, 3100, 2608, 5708, 'yards', 'approved', false, 1),
-- Female Green Tee
(10823, 'Green', 'female', 76.5, 140, 37.7, 138, 38.8, 142, 38, 38, 76, 2950, 2570, 5520, 'yards', 'approved', false, 1),
-- Male Championship Tee
(10823, 'Championship', 'male', 75.8, 143, 37.4, 145, 38.4, 140, 36, 36, 72, 3400, 3185, 6585, 'yards', 'approved', false, 1),
-- Male Black Tee
(10823, 'Black', 'male', 73.4, 136, 36.3, 139, 37.1, 133, 36, 36, 72, 3350, 2749, 6099, 'yards', 'approved', false, 1),
-- Male Blue Tee
(10823, 'Blue', 'male', 71.8, 133, 35.4, 137, 36.4, 129, 36, 36, 72, 3150, 2658, 5808, 'yards', 'approved', false, 1),
-- Male Green Tee
(10823, 'Green', 'male', 70.2, 127, 34.5, 128, 35.7, 126, 36, 36, 72, 2950, 2570, 5520, 'yards', 'approved', false, 1);

-- Insert holes for Female Black Tee (teeId = 1)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(1, 1, 4, 11, 367), (1, 2, 5, 3, 400), (1, 3, 4, 7, 366), (1, 4, 5, 13, 413), (1, 5, 5, 1, 519),
(1, 6, 4, 9, 368), (1, 7, 4, 5, 359), (1, 8, 3, 15, 170), (1, 9, 4, 17, 349), (1, 10, 4, 18, 341),
(1, 11, 3, 16, 173), (1, 12, 4, 6, 309), (1, 13, 5, 2, 414), (1, 14, 5, 10, 527), (1, 15, 4, 8, 415),
(1, 16, 4, 4, 377), (1, 17, 5, 14, 449), (1, 18, 4, 12, 354);

-- Insert holes for Female Blue Tee (teeId = 2)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(2, 1, 4, 11, 355), (2, 2, 5, 3, 385), (2, 3, 4, 7, 344), (2, 4, 5, 13, 402), (2, 5, 5, 1, 509),
(2, 6, 4, 9, 358), (2, 7, 4, 5, 347), (2, 8, 3, 15, 157), (2, 9, 4, 17, 283), (2, 10, 4, 18, 310),
(2, 11, 3, 16, 164), (2, 12, 4, 6, 303), (2, 13, 5, 2, 391), (2, 14, 5, 10, 514), (2, 15, 4, 8, 391),
(2, 16, 4, 4, 346), (2, 17, 5, 14, 427), (2, 18, 4, 12, 366);

-- Insert holes for Female Championship Tee (teeId = 3)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(3, 1, 4, 11, 342), (3, 2, 5, 3, 395), (3, 3, 4, 7, 337), (3, 4, 5, 13, 411), (3, 5, 5, 1, 454),
(3, 6, 4, 9, 360), (3, 7, 4, 5, 349), (3, 8, 3, 15, 154), (3, 9, 4, 17, 289), (3, 10, 4, 18, 311),
(3, 11, 3, 16, 164), (3, 12, 4, 6, 304), (3, 13, 5, 2, 388), (3, 14, 5, 10, 500), (3, 15, 4, 8, 391),
(3, 16, 4, 4, 325), (3, 17, 5, 14, 426), (3, 18, 4, 12, 342);

-- Insert holes for Female Green Tee (teeId = 4)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(4, 1, 4, 11, 346), (4, 2, 5, 3, 368), (4, 3, 4, 7, 322), (4, 4, 5, 13, 397), (4, 5, 5, 1, 462),
(4, 6, 4, 9, 324), (4, 7, 4, 5, 340), (4, 8, 3, 15, 143), (4, 9, 4, 17, 256), (4, 10, 4, 18, 296),
(4, 11, 3, 16, 154), (4, 12, 4, 6, 299), (4, 13, 5, 2, 379), (4, 14, 5, 10, 492), (4, 15, 4, 8, 369),
(4, 16, 4, 4, 327), (4, 17, 5, 14, 417), (4, 18, 4, 12, 346);

-- Insert holes for Male Championship Tee (teeId = 5)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(5, 1, 4, 11, 376), (5, 2, 4, 3, 411), (5, 3, 4, 7, 397), (5, 4, 4, 1, 480), (5, 5, 5, 13, 568),
(5, 6, 4, 9, 412), (5, 7, 4, 5, 371), (5, 8, 3, 15, 188), (5, 9, 4, 17, 352), (5, 10, 4, 18, 386),
(5, 11, 3, 6, 174), (5, 12, 4, 14, 348), (5, 13, 4, 2, 430), (5, 14, 5, 12, 618), (5, 15, 4, 8, 455),
(5, 16, 4, 10, 423), (5, 17, 4, 4, 455), (5, 18, 4, 16, 357);

-- Insert holes for Male Black Tee (teeId = 6)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(6, 1, 4, 11, 367), (6, 2, 4, 3, 400), (6, 3, 4, 7, 366), (6, 4, 4, 1, 413), (6, 5, 5, 13, 519),
(6, 6, 4, 9, 368), (6, 7, 4, 5, 359), (6, 8, 3, 15, 170), (6, 9, 4, 17, 349), (6, 10, 4, 18, 341),
(6, 11, 3, 6, 173), (6, 12, 4, 14, 309), (6, 13, 4, 2, 414), (6, 14, 5, 12, 527), (6, 15, 4, 8, 415),
(6, 16, 4, 10, 377), (6, 17, 4, 4, 449), (6, 18, 4, 16, 354);

-- Insert holes for Male Blue Tee (teeId = 7)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(7, 1, 4, 11, 355), (7, 2, 4, 3, 385), (7, 3, 4, 7, 344), (7, 4, 4, 1, 402), (7, 5, 5, 13, 509),
(7, 6, 4, 9, 358), (7, 7, 4, 5, 347), (7, 8, 3, 15, 157), (7, 9, 4, 17, 283), (7, 10, 4, 18, 310),
(7, 11, 3, 6, 164), (7, 12, 4, 14, 303), (7, 13, 4, 2, 391), (7, 14, 5, 12, 514), (7, 15, 4, 8, 391),
(7, 16, 4, 10, 346), (7, 17, 4, 4, 427), (7, 18, 4, 16, 366);

-- Insert holes for Male Green Tee (teeId = 8)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(8, 1, 4, 11, 346), (8, 2, 4, 3, 368), (8, 3, 4, 7, 322), (8, 4, 4, 1, 397), (8, 5, 5, 13, 462),
(8, 6, 4, 9, 324), (8, 7, 4, 5, 340), (8, 8, 3, 15, 143), (8, 9, 4, 17, 256), (8, 10, 4, 18, 296),
(8, 11, 3, 6, 154), (8, 12, 4, 14, 299), (8, 13, 4, 2, 379), (8, 14, 5, 12, 492), (8, 15, 4, 8, 369),
(8, 16, 4, 10, 327), (8, 17, 4, 4, 417), (8, 18, 4, 16, 346);
