-- St. Andrews Old Course Seed Data

-- Insert course
INSERT INTO course (id, name, "approvalStatus") VALUES 
(10823, 'St. Andrews Old Course', 'approved');

-- Insert tee information for all tees
INSERT INTO "teeInfo" ("courseId", name, gender, "courseRating18", "slopeRating18", "courseRatingFront9", "slopeRatingFront9", "courseRatingBack9", "slopeRatingBack9", "outPar", "inPar", "totalPar", "outDistance", "inDistance", "totalDistance", "distanceMeasurement", "approvalStatus", "isArchived", version) VALUES
-- Ladies Black Tee
(10823, 'Black', 'ladies', 79.8, 148, 39.5, 147, 40.3, 149, 38, 38, 76, 3350, 2749, 6099, 'yards', 'approved', false, 1),
-- Ladies Blue Tee
(10823, 'Blue', 'ladies', 78.2, 143, 38.6, 141, 39.6, 145, 38, 38, 76, 3150, 2658, 5808, 'yards', 'approved', false, 1),
-- ladies Championship Tee
(10823, 'Championship', 'ladies', 77.6, 142, 38.4, 139, 39.2, 145, 38, 38, 76, 3100, 2608, 5708, 'yards', 'approved', false, 1),
-- ladies Green Tee
(10823, 'Green', 'ladies', 76.5, 140, 37.7, 138, 38.8, 142, 38, 38, 76, 2950, 2570, 5520, 'yards', 'approved', false, 1),
-- mens Championship Tee
(10823, 'Championship', 'mens', 75.8, 143, 37.4, 145, 38.4, 140, 36, 36, 72, 3400, 3185, 6585, 'yards', 'approved', false, 1),
-- mens Black Tee
(10823, 'Black', 'mens', 73.4, 136, 36.3, 139, 37.1, 133, 36, 36, 72, 3350, 2749, 6099, 'yards', 'approved', false, 1),
-- mens Blue Tee
(10823, 'Blue', 'mens', 71.8, 133, 35.4, 137, 36.4, 129, 36, 36, 72, 3150, 2658, 5808, 'yards', 'approved', false, 1),
-- mens Green Tee
(10823, 'Green', 'mens', 70.2, 127, 34.5, 128, 35.7, 126, 36, 36, 72, 2950, 2570, 5520, 'yards', 'approved', false, 1);

-- Insert holes for ladies Black Tee (teeId = 1)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(1, 1, 4, 11, 367), (1, 2, 5, 3, 400), (1, 3, 4, 7, 366), (1, 4, 5, 13, 413), (1, 5, 5, 1, 519),
(1, 6, 4, 9, 368), (1, 7, 4, 5, 359), (1, 8, 3, 15, 170), (1, 9, 4, 17, 349), (1, 10, 4, 18, 341),
(1, 11, 3, 16, 173), (1, 12, 4, 6, 309), (1, 13, 5, 2, 414), (1, 14, 5, 10, 527), (1, 15, 4, 8, 415),
(1, 16, 4, 4, 377), (1, 17, 5, 14, 449), (1, 18, 4, 12, 354);

-- Insert holes for ladies Blue Tee (teeId = 2)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(2, 1, 4, 11, 355), (2, 2, 5, 3, 385), (2, 3, 4, 7, 344), (2, 4, 5, 13, 402), (2, 5, 5, 1, 509),
(2, 6, 4, 9, 358), (2, 7, 4, 5, 347), (2, 8, 3, 15, 157), (2, 9, 4, 17, 283), (2, 10, 4, 18, 310),
(2, 11, 3, 16, 164), (2, 12, 4, 6, 303), (2, 13, 5, 2, 391), (2, 14, 5, 10, 514), (2, 15, 4, 8, 391),
(2, 16, 4, 4, 346), (2, 17, 5, 14, 427), (2, 18, 4, 12, 366);

-- Insert holes for ladies Championship Tee (teeId = 3)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(3, 1, 4, 11, 342), (3, 2, 5, 3, 395), (3, 3, 4, 7, 337), (3, 4, 5, 13, 411), (3, 5, 5, 1, 454),
(3, 6, 4, 9, 360), (3, 7, 4, 5, 349), (3, 8, 3, 15, 154), (3, 9, 4, 17, 289), (3, 10, 4, 18, 311),
(3, 11, 3, 16, 164), (3, 12, 4, 6, 304), (3, 13, 5, 2, 388), (3, 14, 5, 10, 500), (3, 15, 4, 8, 391),
(3, 16, 4, 4, 325), (3, 17, 5, 14, 426), (3, 18, 4, 12, 342);

-- Insert holes for ladies Green Tee (teeId = 4)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(4, 1, 4, 11, 346), (4, 2, 5, 3, 368), (4, 3, 4, 7, 322), (4, 4, 5, 13, 397), (4, 5, 5, 1, 462),
(4, 6, 4, 9, 324), (4, 7, 4, 5, 340), (4, 8, 3, 15, 143), (4, 9, 4, 17, 256), (4, 10, 4, 18, 296),
(4, 11, 3, 16, 154), (4, 12, 4, 6, 299), (4, 13, 5, 2, 379), (4, 14, 5, 10, 492), (4, 15, 4, 8, 369),
(4, 16, 4, 4, 327), (4, 17, 5, 14, 417), (4, 18, 4, 12, 346);

-- Insert holes for mens Championship Tee (teeId = 5)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(5, 1, 4, 11, 376), (5, 2, 4, 3, 411), (5, 3, 4, 7, 397), (5, 4, 4, 1, 480), (5, 5, 5, 13, 568),
(5, 6, 4, 9, 412), (5, 7, 4, 5, 371), (5, 8, 3, 15, 188), (5, 9, 4, 17, 352), (5, 10, 4, 18, 386),
(5, 11, 3, 6, 174), (5, 12, 4, 14, 348), (5, 13, 4, 2, 430), (5, 14, 5, 12, 618), (5, 15, 4, 8, 455),
(5, 16, 4, 10, 423), (5, 17, 4, 4, 455), (5, 18, 4, 16, 357);

-- Insert holes for mens Black Tee (teeId = 6)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(6, 1, 4, 11, 367), (6, 2, 4, 3, 400), (6, 3, 4, 7, 366), (6, 4, 4, 1, 413), (6, 5, 5, 13, 519),
(6, 6, 4, 9, 368), (6, 7, 4, 5, 359), (6, 8, 3, 15, 170), (6, 9, 4, 17, 349), (6, 10, 4, 18, 341),
(6, 11, 3, 6, 173), (6, 12, 4, 14, 309), (6, 13, 4, 2, 414), (6, 14, 5, 12, 527), (6, 15, 4, 8, 415),
(6, 16, 4, 10, 377), (6, 17, 4, 4, 449), (6, 18, 4, 16, 354);

-- Insert holes for mens Blue Tee (teeId = 7)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(7, 1, 4, 11, 355), (7, 2, 4, 3, 385), (7, 3, 4, 7, 344), (7, 4, 4, 1, 402), (7, 5, 5, 13, 509),
(7, 6, 4, 9, 358), (7, 7, 4, 5, 347), (7, 8, 3, 15, 157), (7, 9, 4, 17, 283), (7, 10, 4, 18, 310),
(7, 11, 3, 6, 164), (7, 12, 4, 14, 303), (7, 13, 4, 2, 391), (7, 14, 5, 12, 514), (7, 15, 4, 8, 391),
(7, 16, 4, 10, 346), (7, 17, 4, 4, 427), (7, 18, 4, 16, 366);

-- Insert holes for mens Green Tee (teeId = 8)
INSERT INTO hole ("teeId", "holeNumber", par, hcp, distance) VALUES
(8, 1, 4, 11, 346), (8, 2, 4, 3, 368), (8, 3, 4, 7, 322), (8, 4, 4, 1, 397), (8, 5, 5, 13, 462),
(8, 6, 4, 9, 324), (8, 7, 4, 5, 340), (8, 8, 3, 15, 143), (8, 9, 4, 17, 256), (8, 10, 4, 18, 296),
(8, 11, 3, 6, 154), (8, 12, 4, 14, 299), (8, 13, 4, 2, 379), (8, 14, 5, 12, 492), (8, 15, 4, 8, 369),
(8, 16, 4, 10, 327), (8, 17, 4, 4, 417), (8, 18, 4, 16, 346);

-- ============================================
-- Additional course data from scripts/sql/
-- Generated by scripts/build-seed.sh
-- ============================================

-- Source: scripts/sql/asker_golfklubb.sql
-- Course: Asker Golfklubb
-- Location: Asker, Norway
-- Type: 18-hole course
-- Tees: 51 (mens), 51 (ladies), 47 (mens), 47 (ladies), 43 (mens), 43 (ladies), 39 (mens), 39 (ladies), 33 (mens), 33 (ladies)
-- Generated by parse_scorecard_transposed.py

do $$
declare
    v_course_id integer;
    v_tee_id integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Asker Golfklubb', 'Asker', 'Norway', 'https://askergolf.no/', 'approved')
    returning id into v_course_id;

    -- Insert 51 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '51', 'mens',
        69.1, 130,
        34.5, 130,
        34.5, 130,
        35, 35, 70,
        2570, 2452, 5022,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 51 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 276, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 147, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 506, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 152, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 345, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 167, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 5, 481, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 260, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 236, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 158, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 479, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 3, 128, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 5, 434, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 312, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 153, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 402, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 265, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 3, 121, 18);

    -- Insert 51 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '51', 'ladies',
        74.1, 138,
        37.0, 138,
        37.0, 138,
        35, 35, 70,
        2570, 2452, 5022,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 51 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 276, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 147, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 506, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 152, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 345, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 167, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 5, 481, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 260, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 236, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 158, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 479, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 3, 128, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 5, 434, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 312, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 153, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 402, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 265, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 3, 121, 18);

    -- Insert 47 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '47', 'mens',
        67.5, 129,
        33.8, 129,
        33.8, 129,
        35, 35, 70,
        2415, 2329, 4744,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 47 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 259, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 136, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 481, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 142, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 314, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 156, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 5, 450, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 248, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 229, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 147, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 448, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 3, 119, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 5, 418, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 301, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 141, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 385, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 255, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 3, 115, 18);

    -- Insert 47 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '47', 'ladies',
        72.0, 135,
        36.0, 135,
        36.0, 135,
        35, 35, 70,
        2415, 2329, 4744,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 47 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 259, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 136, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 481, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 142, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 314, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 156, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 5, 450, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 248, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 229, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 147, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 448, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 3, 119, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 5, 418, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 301, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 141, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 385, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 255, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 3, 115, 18);

    -- Insert 43 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '43', 'mens',
        65.5, 123,
        32.8, 123,
        32.8, 123,
        35, 35, 70,
        2203, 2102, 4305,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 43 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 234, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 114, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 468, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 132, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 262, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 138, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 5, 418, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 236, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 201, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 122, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 373, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 3, 111, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 5, 387, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 271, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 123, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 368, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 246, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 3, 101, 18);

    -- Insert 43 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '43', 'ladies',
        69.6, 128,
        34.8, 128,
        34.8, 128,
        35, 35, 70,
        2203, 2102, 4305,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 43 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 234, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 114, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 468, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 132, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 262, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 138, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 5, 418, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 236, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 201, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 122, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 373, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 3, 111, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 5, 387, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 271, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 123, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 368, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 246, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 3, 101, 18);

    -- Insert 39 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '39', 'mens',
        64.7, 117,
        32.4, 117,
        32.4, 117,
        35, 35, 70,
        2069, 1944, 4013,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 39 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 227, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 108, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 418, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 122, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 252, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 129, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 5, 410, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 208, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 195, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 114, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 364, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 3, 111, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 5, 356, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 264, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 116, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 315, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 236, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 3, 68, 18);

    -- Insert 39 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '39', 'ladies',
        67.9, 120,
        34.0, 120,
        34.0, 120,
        35, 35, 70,
        2069, 1944, 4013,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 39 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 227, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 108, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 418, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 122, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 252, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 129, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 5, 410, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 208, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 195, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 114, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 364, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 3, 111, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 5, 356, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 264, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 116, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 315, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 236, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 3, 68, 18);

    -- Insert 33 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '33', 'mens',
        62.6, 113,
        31.3, 113,
        31.3, 113,
        35, 35, 70,
        1642, 1680, 3322,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 33 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 170, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 104, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 300, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 115, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 191, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 100, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 5, 300, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 160, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 202, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 90, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 300, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 3, 100, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 5, 270, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 200, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 110, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 285, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 227, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 3, 98, 18);

    -- Insert 33 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '33', 'ladies',
        63.6, 115,
        31.8, 115,
        31.8, 115,
        35, 35, 70,
        1642, 1680, 3322,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 33 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 170, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 104, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 300, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 115, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 191, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 100, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 5, 300, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 160, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 202, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 90, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 300, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 3, 100, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 5, 270, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 200, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 110, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 285, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 227, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 3, 98, 18);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/askim_golfbane.sql
-- Course: Askim golfbane
-- Location: Askim, Norway
-- Type: 18-hole course
-- Tees: 48 (Gul) (mens), 48 (Gul) (ladies), 39 (Rød) (mens), 39 (Rød) (ladies), 32 (Orange) (mens), 32 (Orange) (ladies)
-- Generated by parse_scorecard_transposed.py

do $$
declare
    v_course_id integer;
    v_tee_id integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Askim golfbane', 'Askim', 'Norway', 'https://askimgk.no/banen/scorekort', 'approved')
    returning id into v_course_id;

    -- Insert 48 (Gul) tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '48 (Gul)', 'mens',
        65.5, 124,
        32.8, 124,
        32.8, 124,
        34, 35, 69,
        2370, 2435, 4805,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 48 (Gul) (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 3, 134, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 4, 269, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 4, 261, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 136, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 5, 423, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 103, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 305, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 362, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 377, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 161, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 4, 251, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 261, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 225, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 339, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 103, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 291, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 349, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 5, 455, 8);

    -- Insert 48 (Gul) tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '48 (Gul)', 'ladies',
        69.4, 131,
        34.7, 131,
        34.7, 131,
        34, 35, 69,
        2370, 2435, 4805,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 48 (Gul) (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 3, 134, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 4, 269, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 4, 261, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 136, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 5, 423, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 103, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 305, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 362, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 377, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 161, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 4, 251, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 261, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 225, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 339, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 103, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 291, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 349, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 5, 455, 8);

    -- Insert 39 (Rød) tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '39 (Rød)', 'mens',
        61.8, 117,
        30.9, 117,
        30.9, 117,
        34, 35, 69,
        1887, 2059, 3946,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 39 (Rød) (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 3, 97, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 4, 242, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 4, 220, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 119, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 5, 339, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 88, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 215, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 290, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 277, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 134, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 4, 251, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 220, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 225, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 259, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 88, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 215, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 290, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 5, 377, 8);

    -- Insert 39 (Rød) tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '39 (Rød)', 'ladies',
        64.0, 120,
        32.0, 120,
        32.0, 120,
        34, 35, 69,
        1887, 2059, 3946,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 39 (Rød) (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 3, 97, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 4, 242, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 4, 220, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 119, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 5, 339, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 88, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 215, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 290, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 277, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 134, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 4, 251, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 220, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 225, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 259, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 88, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 215, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 290, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 5, 377, 8);

    -- Insert 32 (Orange) tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '32 (Orange)', 'mens',
        59.9, 109,
        29.9, 109,
        29.9, 109,
        34, 35, 69,
        1576, 1660, 3236,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 32 (Orange) (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 3, 85, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 4, 140, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 4, 220, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 119, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 5, 339, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 59, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 155, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 235, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 224, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 97, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 4, 140, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 220, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 161, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 245, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 88, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 155, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 277, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 5, 277, 8);

    -- Insert 32 (Orange) tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '32 (Orange)', 'ladies',
        59.5, 115,
        29.8, 115,
        29.8, 115,
        34, 35, 69,
        1576, 1660, 3236,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 32 (Orange) (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 3, 85, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 4, 140, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 4, 220, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 3, 119, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 5, 339, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 59, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 155, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 4, 235, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 224, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 3, 97, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 4, 140, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 220, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 161, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 245, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 88, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 155, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 277, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 5, 277, 8);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/atlungstad_golf.sql
-- Course: Atlungstad Golf
-- Location: Hamar, Norway
-- Type: 18-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Atlungstad Golf', 'Hamar', 'Norway', null, 'approved')
    returning id into v_course_id;

    -- Insert White tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'mens',
        74.5, 143,
        37.2, 143,
        37.2, 143,
        36, 36, 72,
        3252, 3154, 6406,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        72.6, 138,
        36.3, 138,
        36.3, 138,
        36, 36, 72,
        3058, 2962, 6020,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Blue tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Blue', 'mens',
        70.3, 134,
        35.1, 134,
        35.1, 134,
        36, 36, 72,
        2831, 2729, 5560,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Holes for White (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 5, 520, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 201, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 4, 394, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 4, 352, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 4, 349, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 3, 154, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 370, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 413, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 5, 499, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 411, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 381, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 327, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 178, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 4, 395, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 5, 448, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 3, 176, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 4, 316, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 5, 522, 5);

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 5, 487, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 3, 164, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 4, 368, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 4, 343, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 4, 339, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 3, 135, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 4, 349, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 4, 400, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 5, 473, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 4, 380, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 374, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 4, 310, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 3, 151, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 4, 384, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 5, 440, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 3, 150, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 4, 298, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 5, 475, 5);

    -- Holes for Blue (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 5, 436, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 3, 135, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 4, 368, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 4, 338, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 4, 333, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 3, 132, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 4, 317, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 4, 352, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 5, 420, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 4, 315, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 4, 334, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 4, 307, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 3, 148, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 4, 328, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 5, 386, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 3, 144, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 4, 298, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 5, 469, 5);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/ballerud_golf.sql
-- Course: Ballerud Golf
-- Location: Høvik, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Ballerud Golf', 'Høvik', 'Norway', 'https://ballerud.no/', 'approved')
    returning id into v_course_id;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        26.4, 89,
        13.2, 89,
        13.2, 89,
        27, 27, 54,
        884, 884, 1768,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 3, 135, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 123, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 3, 61, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 91, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 91, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 3, 89, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 3, 104, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 100, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 3, 90, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 3, 135, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 3, 123, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 3, 61, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 91, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 3, 91, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 3, 89, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 3, 104, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 100, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 3, 90, 12);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/bamble_golfklubb.sql
-- Course: Bamble Golfklubb
-- Location: Stathelle, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Bamble Golfklubb', 'Stathelle', 'Norway', 'https://bamblegolfklubb.no/banen/banekart-og-scorekort/', 'approved')
    returning id into v_course_id;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        30.4, 99,
        15.2, 99,
        15.2, 99,
        34, 34, 68,
        2189, 2189, 4378,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 4, 235, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 4, 275, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 3, 178, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 4, 385, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 130, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 5, 445, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 3, 78, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 222, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 4, 241, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 235, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 275, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 3, 178, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 4, 385, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 3, 130, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 5, 445, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 3, 78, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 4, 222, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 4, 241, 12);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/bergen_golfklubb.sql
-- Course: Bergen Golfklubb
-- Location: Bergen, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Bergen Golfklubb', 'Bergen', 'Norway', 'https://www.bgk.no/scorekort', 'approved')
    returning id into v_course_id;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        67.5, 105,
        33.8, 105,
        33.8, 105,
        34, 34, 68,
        2273, 2273, 4546,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 3, 122, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 155, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 4, 317, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 4, 273, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 5, 455, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 313, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 286, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 231, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 3, 121, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 3, 122, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 3, 155, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 317, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 4, 273, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 5, 455, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 4, 313, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 4, 286, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 4, 231, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 3, 121, 30);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/bjaavann_golfklubb.sql
-- Course: Bjaavann Golfklubb
-- Location: Kristiansand, Norway
-- Type: 18-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
    v_tee_id_5 integer;
    v_tee_id_6 integer;
    v_tee_id_7 integer;
    v_tee_id_8 integer;
    v_tee_id_9 integer;
    v_tee_id_10 integer;
    v_tee_id_11 integer;
    v_tee_id_12 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Bjaavann Golfklubb', 'Kristiansand', 'Norway', 'https://bjaavanngk.no/banen/scorekort', 'approved')
    returning id into v_course_id;

    -- Insert Tee 64 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 64', 'mens',
        74.9, 131,
        37.5, 131,
        37.5, 131,
        36, 36, 72,
        3236, 3174, 6410,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Tee 64 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 64', 'ladies',
        75.9, 133,
        38.0, 133,
        38.0, 133,
        36, 36, 72,
        3236, 3174, 6410,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Tee 61 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 61', 'mens',
        73.1, 123,
        36.5, 123,
        36.5, 123,
        36, 36, 72,
        3028, 3025, 6053,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Tee 61 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 61', 'ladies',
        74.1, 125,
        37.0, 125,
        37.0, 125,
        36, 36, 72,
        3028, 3025, 6053,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Insert Tee 56 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 56', 'mens',
        70.7, 121,
        35.4, 121,
        35.4, 121,
        36, 36, 72,
        2773, 2835, 5608,
        'meters', 'approved'
    )
    returning id into v_tee_id_5;

    -- Insert Tee 56 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 56', 'ladies',
        71.7, 123,
        35.9, 123,
        35.9, 123,
        36, 36, 72,
        2773, 2835, 5608,
        'meters', 'approved'
    )
    returning id into v_tee_id_6;

    -- Insert Tee 52 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 52', 'mens',
        69.2, 117,
        34.6, 117,
        34.6, 117,
        36, 36, 72,
        2598, 2632, 5230,
        'meters', 'approved'
    )
    returning id into v_tee_id_7;

    -- Insert Tee 52 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 52', 'ladies',
        70.2, 119,
        35.1, 119,
        35.1, 119,
        36, 36, 72,
        2598, 2632, 5230,
        'meters', 'approved'
    )
    returning id into v_tee_id_8;

    -- Insert Tee 44 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 44', 'mens',
        65.9, 107,
        33.0, 107,
        33.0, 107,
        36, 36, 72,
        2152, 2202, 4354,
        'meters', 'approved'
    )
    returning id into v_tee_id_9;

    -- Insert Tee 44 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 44', 'ladies',
        66.9, 109,
        33.5, 109,
        33.5, 109,
        36, 36, 72,
        2152, 2202, 4354,
        'meters', 'approved'
    )
    returning id into v_tee_id_10;

    -- Insert Tee 39 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 39', 'mens',
        65.1, 103,
        32.5, 103,
        32.5, 103,
        36, 36, 72,
        1955, 1908, 3863,
        'meters', 'approved'
    )
    returning id into v_tee_id_11;

    -- Insert Tee 39 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 39', 'ladies',
        66.1, 105,
        33.0, 105,
        33.0, 105,
        36, 36, 72,
        1955, 1908, 3863,
        'meters', 'approved'
    )
    returning id into v_tee_id_12;

    -- Holes for Tee 64 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 5, 581, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 211, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 5, 491, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 4, 328, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 4, 389, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 353, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 3, 128, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 163, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 5, 592, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 385, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 402, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 357, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 164, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 4, 342, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 4, 361, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 5, 495, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 132, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 5, 536, 4);

    -- Holes for Tee 64 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 5, 581, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 3, 211, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 5, 491, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 4, 328, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 4, 389, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 4, 353, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 3, 128, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 3, 163, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 5, 592, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 4, 385, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 402, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 4, 357, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 3, 164, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 4, 342, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 4, 361, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 5, 495, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 3, 132, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 5, 536, 4);

    -- Holes for Tee 61 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 5, 551, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 3, 183, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 5, 468, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 4, 328, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 4, 355, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 4, 323, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 3, 128, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 3, 140, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 5, 552, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 4, 362, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 4, 339, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 4, 357, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 3, 149, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 4, 337, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 4, 344, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 5, 495, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 3, 132, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 5, 510, 4);

    -- Holes for Tee 61 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 5, 551, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 3, 183, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 5, 468, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 4, 328, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 4, 355, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 4, 323, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 3, 128, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 3, 140, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 5, 552, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 4, 362, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 4, 339, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 4, 357, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 3, 149, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 4, 337, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 4, 344, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 5, 495, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 3, 132, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 5, 510, 4);

    -- Holes for Tee 56 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 1, 5, 520, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 2, 3, 151, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 3, 5, 443, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 4, 4, 256, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 5, 4, 343, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 6, 4, 301, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 7, 3, 117, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 8, 3, 132, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 9, 5, 510, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 10, 4, 348, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 11, 4, 311, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 12, 4, 332, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 13, 3, 137, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 14, 4, 329, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 15, 4, 336, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 16, 5, 462, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 17, 3, 110, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 18, 5, 470, 4);

    -- Holes for Tee 56 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 1, 5, 520, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 2, 3, 151, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 3, 5, 443, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 4, 4, 256, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 5, 4, 343, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 6, 4, 301, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 7, 3, 117, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 8, 3, 132, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 9, 5, 510, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 10, 4, 348, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 11, 4, 311, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 12, 4, 332, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 13, 3, 137, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 14, 4, 329, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 15, 4, 336, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 16, 5, 462, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 17, 3, 110, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 18, 5, 470, 4);

    -- Holes for Tee 52 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 1, 5, 475, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 2, 3, 115, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 3, 5, 443, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 4, 4, 245, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 5, 4, 300, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 6, 4, 286, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 7, 3, 117, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 8, 3, 119, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 9, 5, 498, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 10, 4, 322, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 11, 4, 299, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 12, 4, 332, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 13, 3, 128, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 14, 4, 319, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 15, 4, 292, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 16, 5, 375, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 17, 3, 95, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 18, 5, 470, 4);

    -- Holes for Tee 52 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 1, 5, 475, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 2, 3, 115, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 3, 5, 443, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 4, 4, 245, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 5, 4, 300, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 6, 4, 286, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 7, 3, 117, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 8, 3, 119, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 9, 5, 498, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 10, 4, 322, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 11, 4, 299, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 12, 4, 332, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 13, 3, 128, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 14, 4, 319, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 15, 4, 292, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 16, 5, 375, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 17, 3, 95, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 18, 5, 470, 4);

    -- Holes for Tee 44 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 1, 5, 436, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 2, 3, 115, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 3, 5, 362, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 4, 4, 179, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 5, 4, 213, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 6, 4, 211, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 7, 3, 105, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 8, 3, 99, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 9, 5, 432, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 10, 4, 281, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 11, 4, 262, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 12, 4, 258, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 13, 3, 114, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 14, 4, 233, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 15, 4, 280, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 16, 5, 368, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 17, 3, 76, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 18, 5, 330, 4);

    -- Holes for Tee 44 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 1, 5, 436, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 2, 3, 115, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 3, 5, 362, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 4, 4, 179, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 5, 4, 213, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 6, 4, 211, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 7, 3, 105, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 8, 3, 99, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 9, 5, 432, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 10, 4, 281, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 11, 4, 262, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 12, 4, 258, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 13, 3, 114, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 14, 4, 233, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 15, 4, 280, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 16, 5, 368, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 17, 3, 76, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 18, 5, 330, 4);

    -- Holes for Tee 39 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 1, 5, 412, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 2, 3, 76, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 3, 5, 335, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 4, 4, 179, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 5, 4, 213, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 6, 4, 211, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 7, 3, 50, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 8, 3, 99, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 9, 5, 380, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 10, 4, 241, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 11, 4, 219, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 12, 4, 242, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 13, 3, 89, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 14, 4, 233, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 15, 4, 229, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 16, 5, 337, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 17, 3, 76, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 18, 5, 242, 4);

    -- Holes for Tee 39 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 1, 5, 412, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 2, 3, 76, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 3, 5, 335, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 4, 4, 179, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 5, 4, 213, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 6, 4, 211, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 7, 3, 50, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 8, 3, 99, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 9, 5, 380, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 10, 4, 241, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 11, 4, 219, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 12, 4, 242, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 13, 3, 89, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 14, 4, 233, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 15, 4, 229, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 16, 5, 337, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 17, 3, 76, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_12, 18, 5, 242, 4);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/bjørnefjorden_golfklubb.sql
-- Course: Bjørnefjorden Golfklubb
-- Location: Os, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Bjørnefjorden Golfklubb', 'Os', 'Norway', 'https://www.bjgk.no/banen/scorekort-slopetabell', 'approved')
    returning id into v_course_id;

    -- Insert White tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'mens',
        61.9, 100,
        30.9, 100,
        30.9, 100,
        34, 34, 68,
        2168, 2168, 4336,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Holes for White (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 3, 144, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 5, 437, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 4, 215, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 109, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 4, 225, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 289, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 304, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 300, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 3, 145, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 3, 144, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 5, 437, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 215, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 109, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 4, 225, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 4, 289, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 4, 304, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 4, 300, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 3, 145, 30);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/borre_golfbane.sql
-- Course: Borre Golfbane
-- Location: Horten, Norway
-- Type: 18-hole course
-- Tees: 62 (mens), 58 (mens), 58 (ladies), 54 (mens), 54 (ladies), 49 (mens), 49 (ladies)
-- Generated by parse_scorecard_transposed.py

do $$
declare
    v_course_id integer;
    v_tee_id integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Borre Golfbane', 'Horten', 'Norway', 'https://borregb.no/', 'approved')
    returning id into v_course_id;

    -- Insert 62 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '62', 'mens',
        74.2, 150,
        37.1, 150,
        37.1, 150,
        36, 37, 73,
        2927, 3194, 6121,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 62 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 322, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 150, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 455, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 333, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 315, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 4, 316, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 3, 173, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 550, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 313, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 375, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 507, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 365, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 3, 153, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 342, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 4, 279, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 493, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 303, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 377, 7);

    -- Insert 58 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '58', 'mens',
        72.6, 146,
        36.3, 146,
        36.3, 146,
        36, 37, 73,
        2749, 3037, 5786,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 58 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 313, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 128, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 442, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 319, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 288, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 4, 301, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 3, 155, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 500, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 303, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 356, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 489, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 350, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 3, 142, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 329, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 4, 269, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 472, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 293, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 337, 7);

    -- Insert 58 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '58', 'ladies',
        78.1, 152,
        39.0, 152,
        39.0, 152,
        36, 37, 73,
        2749, 3037, 5786,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 58 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 313, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 128, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 442, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 319, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 288, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 4, 301, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 3, 155, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 500, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 303, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 356, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 489, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 350, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 3, 142, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 329, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 4, 269, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 472, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 293, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 337, 7);

    -- Insert 54 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '54', 'mens',
        70.3, 146,
        35.1, 146,
        35.1, 146,
        36, 37, 73,
        2609, 2795, 5404,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 54 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 304, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 111, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 422, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 309, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 276, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 4, 287, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 3, 127, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 490, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 283, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 329, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 423, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 325, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 3, 121, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 319, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 4, 243, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 424, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 286, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 325, 7);

    -- Insert 54 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '54', 'ladies',
        75.8, 146,
        37.9, 146,
        37.9, 146,
        36, 37, 73,
        2609, 2795, 5404,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 54 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 304, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 111, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 422, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 309, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 276, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 4, 287, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 3, 127, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 490, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 283, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 329, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 423, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 325, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 3, 121, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 319, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 4, 243, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 424, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 286, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 325, 7);

    -- Insert 49 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '49', 'mens',
        68.3, 138,
        34.1, 138,
        34.1, 138,
        36, 37, 73,
        2342, 2589, 4931,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 49 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 267, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 98, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 404, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 274, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 236, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 4, 256, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 3, 116, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 433, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 258, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 287, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 410, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 293, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 3, 111, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 301, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 4, 233, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 414, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 255, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 285, 7);

    -- Insert 49 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '49', 'ladies',
        73.0, 140,
        36.5, 140,
        36.5, 140,
        36, 37, 73,
        2342, 2589, 4931,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for 49 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 267, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 98, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 404, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 274, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 236, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 4, 256, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 3, 116, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 433, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 258, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 287, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 5, 410, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 4, 293, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 3, 111, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 4, 301, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 4, 233, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 5, 414, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 4, 255, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 285, 7);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/borregaard_golfklubb.sql
-- Course: Borregaard Golfklubb
-- Location: Sarpsborg, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Borregaard Golfklubb', 'Sarpsborg', 'Norway', 'https://borregaardgk.no/', 'approved')
    returning id into v_course_id;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        58.9, 97,
        29.4, 97,
        29.4, 97,
        32, 32, 64,
        2073, 2073, 4146,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 3, 176, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 118, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 4, 293, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 125, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 4, 235, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 3, 124, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 396, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 306, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 4, 300, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 3, 176, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 3, 118, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 293, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 125, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 4, 235, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 3, 124, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 4, 396, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 4, 306, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 4, 300, 18);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/byneset_golf_-_north_course.sql
-- Course: Byneset Golf - North Course
-- Location: Spongdal, Norway
-- Type: 18-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Byneset Golf - North Course', 'Spongdal', 'Norway', 'https://www.bynesetgolf.no/', 'approved')
    returning id into v_course_id;

    -- Insert White tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'mens',
        70.7, 121,
        35.4, 121,
        35.4, 121,
        36, 36, 72,
        2794, 2938, 5732,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        69.2, 117,
        34.6, 117,
        34.6, 117,
        36, 36, 72,
        2591, 2661, 5252,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Holes for White (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 5, 411, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 4, 394, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 4, 306, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 4, 293, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 155, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 334, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 5, 425, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 311, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 3, 165, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 325, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 389, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 333, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 128, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 5, 505, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 3, 174, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 4, 291, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 5, 422, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 4, 371, 1);

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 5, 401, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 4, 348, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 4, 261, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 4, 283, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 3, 146, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 4, 306, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 5, 398, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 4, 302, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 3, 146, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 4, 315, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 320, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 4, 302, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 3, 112, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 5, 443, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 3, 146, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 4, 283, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 5, 402, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 4, 338, 1);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/byneset_golf_-_south_course.sql
-- Course: Byneset Golf - South Course
-- Location: Spongdal, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Byneset Golf - South Course', 'Spongdal', 'Norway', 'https://www.bynesetgolf.no/', 'approved')
    returning id into v_course_id;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        31.5, 99,
        15.8, 99,
        15.8, 99,
        32, 32, 64,
        1725, 1725, 3450,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Yellow tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'ladies',
        30.3, 98,
        15.2, 98,
        15.2, 98,
        32, 32, 64,
        1725, 1725, 3450,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Red tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'mens',
        30.0, 97,
        15.0, 97,
        15.0, 97,
        32, 32, 64,
        1554, 1554, 3108,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Red tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'ladies',
        28.2, 96,
        14.1, 96,
        14.1, 96,
        32, 32, 64,
        1554, 1554, 3108,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 4, 274, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 4, 229, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 3, 123, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 4, 256, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 121, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 233, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 3, 128, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 119, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 4, 242, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 274, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 229, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 3, 123, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 4, 256, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 3, 121, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 4, 233, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 3, 128, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 119, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 4, 242, 8);

    -- Holes for Yellow (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 4, 274, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 4, 229, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 3, 123, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 4, 256, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 3, 121, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 4, 233, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 3, 128, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 3, 119, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 4, 242, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 4, 274, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 229, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 3, 123, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 4, 256, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 3, 121, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 4, 233, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 3, 128, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 3, 119, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 4, 242, 8);

    -- Holes for Red (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 4, 247, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 4, 210, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 3, 110, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 4, 229, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 3, 91, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 4, 219, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 3, 114, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 3, 105, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 4, 229, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 4, 247, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 4, 210, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 3, 110, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 4, 229, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 3, 91, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 4, 219, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 3, 114, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 3, 105, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 4, 229, 8);

    -- Holes for Red (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 4, 247, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 4, 210, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 3, 110, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 4, 229, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 3, 91, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 4, 219, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 3, 114, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 3, 105, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 4, 229, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 4, 247, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 4, 210, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 3, 110, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 4, 229, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 3, 91, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 4, 219, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 3, 114, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 3, 105, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 4, 229, 8);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/bærum_golfklubb.sql
-- Course: Bærum Golfklubb
-- Location: Bærum, Norway
-- Type: 18-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
    v_tee_id_5 integer;
    v_tee_id_6 integer;
    v_tee_id_7 integer;
    v_tee_id_8 integer;
    v_tee_id_9 integer;
    v_tee_id_10 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Bærum Golfklubb', 'Bærum', 'Norway', 'https://bmgk.no/banen/scorekort', 'approved')
    returning id into v_course_id;

    -- Insert White tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'mens',
        71.1, 134,
        35.5, 134,
        35.5, 134,
        37, 34, 71,
        2930, 2584, 5514,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert White tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'ladies',
        76.5, 143,
        38.2, 143,
        38.2, 143,
        37, 34, 71,
        2930, 2584, 5514,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        69.7, 132,
        34.9, 132,
        34.9, 132,
        37, 34, 71,
        2827, 2413, 5240,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Yellow tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'ladies',
        74.7, 140,
        37.4, 140,
        37.4, 140,
        37, 34, 71,
        2827, 2413, 5240,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Insert Blue tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Blue', 'mens',
        66.7, 126,
        33.4, 126,
        33.4, 126,
        37, 34, 71,
        2470, 2155, 4625,
        'meters', 'approved'
    )
    returning id into v_tee_id_5;

    -- Insert Blue tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Blue', 'ladies',
        71.1, 131,
        35.5, 131,
        35.5, 131,
        37, 34, 71,
        2470, 2155, 4625,
        'meters', 'approved'
    )
    returning id into v_tee_id_6;

    -- Insert Red tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'mens',
        65.8, 123,
        32.9, 123,
        32.9, 123,
        37, 34, 71,
        2351, 2054, 4405,
        'meters', 'approved'
    )
    returning id into v_tee_id_7;

    -- Insert Red tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'ladies',
        69.7, 129,
        34.9, 129,
        34.9, 129,
        37, 34, 71,
        2351, 2054, 4405,
        'meters', 'approved'
    )
    returning id into v_tee_id_8;

    -- Insert Green tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Green', 'mens',
        61.5, 113,
        30.8, 113,
        30.8, 113,
        37, 34, 71,
        1576, 1466, 3042,
        'meters', 'approved'
    )
    returning id into v_tee_id_9;

    -- Insert Green tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Green', 'ladies',
        61.9, 112,
        30.9, 112,
        30.9, 112,
        37, 34, 71,
        1576, 1466, 3042,
        'meters', 'approved'
    )
    returning id into v_tee_id_10;

    -- Holes for White (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 5, 424, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 4, 330, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 3, 130, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 5, 443, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 156, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 344, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 305, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 294, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 5, 504, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 3, 115, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 299, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 5, 475, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 134, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 4, 369, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 4, 386, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 3, 188, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 4, 349, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 4, 269, 10);

    -- Holes for White (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 5, 424, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 4, 330, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 3, 130, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 5, 443, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 3, 156, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 4, 344, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 4, 305, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 4, 294, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 5, 504, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 3, 115, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 299, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 5, 475, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 3, 134, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 4, 369, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 4, 386, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 3, 188, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 4, 349, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 4, 269, 10);

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 5, 408, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 4, 310, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 3, 130, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 5, 428, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 3, 146, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 4, 332, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 4, 295, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 4, 287, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 5, 491, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 3, 108, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 4, 288, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 5, 464, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 3, 123, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 4, 357, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 4, 370, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 3, 150, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 4, 295, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 4, 258, 10);

    -- Holes for Yellow (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 5, 408, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 4, 310, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 3, 130, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 5, 428, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 3, 146, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 4, 332, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 4, 295, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 4, 287, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 5, 491, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 3, 108, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 4, 288, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 5, 464, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 3, 123, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 4, 357, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 4, 370, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 3, 150, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 4, 295, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 4, 258, 10);

    -- Holes for Blue (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 1, 5, 401, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 2, 4, 288, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 3, 3, 107, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 4, 5, 380, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 5, 3, 141, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 6, 4, 281, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 7, 4, 235, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 8, 4, 215, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 9, 5, 422, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 10, 3, 108, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 11, 4, 288, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 12, 5, 368, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 13, 3, 109, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 14, 4, 335, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 15, 4, 271, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 16, 3, 133, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 17, 4, 285, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 18, 4, 258, 10);

    -- Holes for Blue (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 1, 5, 401, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 2, 4, 288, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 3, 3, 107, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 4, 5, 380, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 5, 3, 141, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 6, 4, 281, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 7, 4, 235, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 8, 4, 215, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 9, 5, 422, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 10, 3, 108, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 11, 4, 288, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 12, 5, 368, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 13, 3, 109, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 14, 4, 335, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 15, 4, 271, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 16, 3, 133, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 17, 4, 285, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 18, 4, 258, 10);

    -- Holes for Red (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 1, 5, 338, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 2, 4, 247, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 3, 3, 107, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 4, 5, 380, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 5, 3, 131, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 6, 4, 281, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 7, 4, 235, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 8, 4, 210, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 9, 5, 422, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 10, 3, 87, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 11, 4, 280, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 12, 5, 368, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 13, 3, 109, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 14, 4, 298, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 15, 4, 271, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 16, 3, 133, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 17, 4, 275, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 18, 4, 233, 10);

    -- Holes for Red (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 1, 5, 338, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 2, 4, 247, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 3, 3, 107, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 4, 5, 380, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 5, 3, 131, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 6, 4, 281, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 7, 4, 235, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 8, 4, 210, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 9, 5, 422, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 10, 3, 87, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 11, 4, 280, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 12, 5, 368, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 13, 3, 109, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 14, 4, 298, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 15, 4, 271, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 16, 3, 133, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 17, 4, 275, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 18, 4, 233, 10);

    -- Holes for Green (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 1, 5, 248, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 2, 4, 189, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 3, 3, 82, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 4, 5, 237, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 5, 3, 72, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 6, 4, 180, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 7, 4, 155, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 8, 4, 141, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 9, 5, 272, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 10, 3, 87, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 11, 4, 186, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 12, 5, 282, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 13, 3, 81, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 14, 4, 193, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 15, 4, 212, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 16, 3, 94, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 17, 4, 181, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 18, 4, 150, 10);

    -- Holes for Green (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 1, 5, 248, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 2, 4, 189, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 3, 3, 82, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 4, 5, 237, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 5, 3, 72, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 6, 4, 180, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 7, 4, 155, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 8, 4, 141, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 9, 5, 272, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 10, 3, 87, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 11, 4, 186, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 12, 5, 282, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 13, 3, 81, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 14, 4, 193, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 15, 4, 212, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 16, 3, 94, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 17, 4, 181, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 18, 4, 150, 10);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/dalane_golfklubb.sql
-- Course: Dalane Golfklubb
-- Location: Dalane, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Dalane Golfklubb', 'Dalane', 'Norway', null, 'approved')
    returning id into v_course_id;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        58.5, 104,
        29.2, 104,
        29.2, 104,
        30, 30, 60,
        1709, 1709, 3418,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 4, 268, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 153, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 3, 136, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 153, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 4, 274, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 3, 168, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 268, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 153, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 3, 136, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 268, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 3, 153, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 3, 136, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 153, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 4, 274, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 3, 168, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 4, 268, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 153, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 3, 136, 34);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/drammen_golfklubb.sql
-- Course: Drammen Golfklubb
-- Location: Drammen, Norway
-- Type: 18-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
    v_tee_id_5 integer;
    v_tee_id_6 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Drammen Golfklubb', 'Drammen', 'Norway', 'https://drammengk.no/banen/scorekort', 'approved')
    returning id into v_course_id;

    -- Insert Tee 58 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 58', 'mens',
        71.9, 140,
        36.0, 140,
        36.0, 140,
        34, 37, 71,
        2616, 3137, 5753,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Tee 58 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 58', 'ladies',
        77.5, 146,
        38.8, 146,
        38.8, 146,
        34, 37, 71,
        2616, 3137, 5753,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Tee 54 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 54', 'mens',
        70.0, 134,
        35.0, 134,
        35.0, 134,
        34, 37, 71,
        2414, 2937, 5351,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Tee 54 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 54', 'ladies',
        75.3, 138,
        37.6, 138,
        37.6, 138,
        34, 37, 71,
        2414, 2937, 5351,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Insert Tee 47 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 47', 'mens',
        66.9, 130,
        33.5, 130,
        33.5, 130,
        34, 37, 71,
        2180, 2567, 4747,
        'meters', 'approved'
    )
    returning id into v_tee_id_5;

    -- Insert Tee 47 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 47', 'ladies',
        71.7, 130,
        35.9, 130,
        35.9, 130,
        34, 37, 71,
        2180, 2567, 4747,
        'meters', 'approved'
    )
    returning id into v_tee_id_6;

    -- Holes for Tee 58 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 4, 303, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 127, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 5, 484, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 134, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 4, 361, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 3, 116, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 390, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 286, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 4, 415, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 5, 470, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 284, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 3, 160, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 4, 349, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 3, 196, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 5, 482, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 4, 369, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 4, 335, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 5, 492, 13);

    -- Holes for Tee 58 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 4, 303, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 3, 127, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 5, 484, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 3, 134, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 4, 361, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 3, 116, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 4, 390, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 4, 286, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 4, 415, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 5, 470, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 284, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 3, 160, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 4, 349, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 3, 196, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 5, 482, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 4, 369, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 4, 335, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 5, 492, 13);

    -- Holes for Tee 54 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 4, 294, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 3, 118, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 5, 453, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 3, 123, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 4, 356, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 3, 109, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 4, 337, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 4, 280, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 4, 344, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 5, 457, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 4, 274, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 3, 154, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 4, 341, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 3, 161, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 5, 394, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 4, 360, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 4, 319, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 5, 477, 13);

    -- Holes for Tee 54 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 4, 294, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 3, 118, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 5, 453, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 3, 123, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 4, 356, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 3, 109, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 4, 337, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 4, 280, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 4, 344, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 5, 457, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 4, 274, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 3, 154, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 4, 341, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 3, 161, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 5, 394, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 4, 360, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 4, 319, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 5, 477, 13);

    -- Holes for Tee 47 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 1, 4, 233, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 2, 3, 105, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 3, 5, 398, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 4, 3, 109, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 5, 4, 322, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 6, 3, 100, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 7, 4, 337, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 8, 4, 236, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 9, 4, 340, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 10, 5, 395, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 11, 4, 250, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 12, 3, 114, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 13, 4, 303, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 14, 3, 158, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 15, 5, 394, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 16, 4, 302, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 17, 4, 284, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 18, 5, 367, 13);

    -- Holes for Tee 47 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 1, 4, 233, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 2, 3, 105, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 3, 5, 398, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 4, 3, 109, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 5, 4, 322, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 6, 3, 100, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 7, 4, 337, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 8, 4, 236, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 9, 4, 340, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 10, 5, 395, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 11, 4, 250, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 12, 3, 114, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 13, 4, 303, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 14, 3, 158, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 15, 5, 394, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 16, 4, 302, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 17, 4, 284, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 18, 5, 367, 13);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/drøbak_golfbane.sql
-- Course: Drøbak golfbane
-- Location: Drøbak, Norway
-- Type: 18-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Drøbak golfbane', 'Drøbak', 'Norway', 'https://drobakgolf.no/banen/scorekort', 'approved')
    returning id into v_course_id;

    -- Insert Tee 51 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 51', 'mens',
        67.4, 123,
        33.7, 123,
        33.7, 123,
        36, 34, 70,
        2754, 2384, 5138,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Tee 51 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 51', 'ladies',
        72.9, 129,
        36.5, 129,
        36.5, 129,
        36, 34, 70,
        2754, 2384, 5138,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Tee 47 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 47', 'mens',
        65.1, 119,
        32.5, 119,
        32.5, 119,
        36, 34, 70,
        2546, 2160, 4706,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Tee 47 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 47', 'ladies',
        70.0, 124,
        35.0, 124,
        35.0, 124,
        36, 34, 70,
        2546, 2160, 4706,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Holes for Tee 51 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 4, 277, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 4, 352, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 5, 439, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 137, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 4, 251, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 3, 179, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 335, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 5, 443, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 4, 341, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 313, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 277, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 240, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 4, 354, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 4, 270, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 3, 142, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 4, 317, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 121, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 4, 350, 4);

    -- Holes for Tee 51 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 4, 277, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 4, 352, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 5, 439, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 3, 137, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 4, 251, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 3, 179, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 4, 335, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 5, 443, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 4, 341, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 4, 313, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 277, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 4, 240, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 4, 354, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 4, 270, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 3, 142, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 4, 317, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 3, 121, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 4, 350, 4);

    -- Holes for Tee 47 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 4, 263, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 4, 330, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 5, 411, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 3, 117, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 4, 238, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 3, 158, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 4, 314, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 5, 398, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 4, 317, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 4, 290, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 4, 258, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 4, 221, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 4, 334, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 4, 253, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 3, 122, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 4, 264, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 3, 102, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 4, 316, 4);

    -- Holes for Tee 47 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 4, 263, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 4, 330, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 5, 411, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 3, 117, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 4, 238, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 3, 158, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 4, 314, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 5, 398, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 4, 317, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 4, 290, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 4, 258, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 4, 221, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 4, 334, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 4, 253, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 3, 122, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 4, 264, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 3, 102, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 4, 316, 4);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/egersund_golfklubb.sql
-- Course: Egersund Golfklubb
-- Location: Egersund, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
    v_tee_id_5 integer;
    v_tee_id_6 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Egersund Golfklubb', 'Egersund', 'Norway', 'https://egersund-golfklubb.no/?page_id=2964', 'approved')
    returning id into v_course_id;

    -- Insert White tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'mens',
        69.4, 129,
        34.7, 129,
        34.7, 129,
        35, 35, 70,
        2622, 2622, 5244,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert White tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'ladies',
        74.1, 137,
        37.0, 137,
        37.0, 137,
        35, 35, 70,
        2622, 2622, 5244,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Gold tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Gold', 'mens',
        67.9, 125,
        34.0, 125,
        34.0, 125,
        35, 35, 70,
        2477, 2477, 4954,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Gold tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Gold', 'ladies',
        72.3, 133,
        36.1, 133,
        36.1, 133,
        35, 35, 70,
        2477, 2477, 4954,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Insert Red tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'mens',
        66.2, 122,
        33.1, 122,
        33.1, 122,
        35, 35, 70,
        2301, 2301, 4602,
        'meters', 'approved'
    )
    returning id into v_tee_id_5;

    -- Insert Red tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'ladies',
        70.2, 128,
        35.1, 128,
        35.1, 128,
        35, 35, 70,
        2301, 2301, 4602,
        'meters', 'approved'
    )
    returning id into v_tee_id_6;

    -- Holes for White (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 4, 275, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 5, 412, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 4, 297, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 117, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 4, 316, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 3, 142, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 5, 526, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 198, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 4, 339, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 275, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 5, 412, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 297, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 117, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 4, 316, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 3, 142, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 5, 526, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 198, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 4, 339, 22);

    -- Holes for White (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 4, 275, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 5, 412, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 4, 297, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 3, 117, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 4, 316, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 3, 142, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 5, 526, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 3, 198, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 4, 339, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 4, 275, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 5, 412, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 4, 297, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 3, 117, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 4, 316, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 3, 142, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 5, 526, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 3, 198, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 4, 339, 22);

    -- Holes for Gold (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 4, 260, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 5, 395, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 4, 275, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 3, 117, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 4, 310, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 3, 134, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 5, 498, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 3, 172, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 4, 316, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 4, 260, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 5, 395, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 4, 275, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 3, 117, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 4, 310, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 3, 134, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 5, 498, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 3, 172, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 4, 316, 22);

    -- Holes for Gold (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 4, 260, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 5, 395, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 4, 275, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 3, 117, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 4, 310, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 3, 134, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 5, 498, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 3, 172, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 4, 316, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 4, 260, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 5, 395, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 4, 275, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 3, 117, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 4, 310, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 3, 134, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 5, 498, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 3, 172, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 4, 316, 22);

    -- Holes for Red (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 1, 4, 250, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 2, 5, 346, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 3, 4, 261, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 4, 3, 112, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 5, 4, 275, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 6, 3, 123, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 7, 5, 479, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 8, 3, 153, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 9, 4, 302, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 10, 4, 250, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 11, 5, 346, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 12, 4, 261, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 13, 3, 112, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 14, 4, 275, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 15, 3, 123, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 16, 5, 479, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 17, 3, 153, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 18, 4, 302, 22);

    -- Holes for Red (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 1, 4, 250, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 2, 5, 346, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 3, 4, 261, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 4, 3, 112, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 5, 4, 275, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 6, 3, 123, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 7, 5, 479, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 8, 3, 153, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 9, 4, 302, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 10, 4, 250, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 11, 5, 346, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 12, 4, 261, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 13, 3, 112, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 14, 4, 275, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 15, 3, 123, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 16, 5, 479, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 17, 3, 153, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 18, 4, 302, 22);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/eiker_golfbane_-_portåsen_2018.sql
-- Course: Eiker Golfbane - Portåsen 2018
-- Location: Mjondalen, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Eiker Golfbane - Portåsen 2018', 'Mjondalen', 'Norway', 'https://www.eikergolf.no/', 'approved')
    returning id into v_course_id;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        71.2, 128,
        35.6, 128,
        35.6, 128,
        34, 34, 68,
        2413, 2413, 4826,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Yellow tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'ladies',
        66.4, 121,
        33.2, 121,
        33.2, 121,
        34, 34, 68,
        2413, 2413, 4826,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Red tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'mens',
        68.7, 120,
        34.4, 120,
        34.4, 120,
        34, 34, 68,
        2194, 2194, 4388,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Red tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'ladies',
        64.4, 116,
        32.2, 116,
        32.2, 116,
        34, 34, 68,
        2194, 2194, 4388,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 5, 413, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 161, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 4, 284, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 92, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 4, 371, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 261, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 340, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 334, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 3, 157, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 5, 413, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 3, 161, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 284, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 92, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 4, 371, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 4, 261, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 4, 340, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 4, 334, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 3, 157, 26);

    -- Holes for Yellow (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 5, 413, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 3, 161, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 4, 284, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 3, 92, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 4, 371, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 4, 261, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 4, 340, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 4, 334, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 3, 157, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 5, 413, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 3, 161, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 4, 284, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 3, 92, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 4, 371, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 4, 261, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 4, 340, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 4, 334, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 3, 157, 26);

    -- Holes for Red (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 5, 383, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 3, 137, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 4, 284, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 3, 79, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 4, 326, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 4, 237, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 4, 314, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 4, 299, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 3, 135, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 5, 383, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 3, 137, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 4, 284, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 3, 79, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 4, 326, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 4, 237, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 4, 314, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 4, 299, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 3, 135, 26);

    -- Holes for Red (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 5, 383, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 3, 137, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 4, 284, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 3, 79, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 4, 326, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 4, 237, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 4, 314, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 4, 299, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 3, 135, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 5, 383, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 3, 137, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 4, 284, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 3, 79, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 4, 326, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 4, 237, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 4, 314, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 4, 299, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 3, 135, 26);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/ekholt_golfklubb_-_ekholtbruket.sql
-- Course: Ekholt Golfklubb - Ekholtbruket
-- Location: Moss, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Ekholt Golfklubb - Ekholtbruket', 'Moss', 'Norway', 'https://www.ekholtgolf.no/', 'approved')
    returning id into v_course_id;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        29.4, 93,
        14.7, 93,
        14.7, 93,
        30, 30, 60,
        1608, 1608, 3216,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Yellow tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'ladies',
        30.1, 98,
        15.1, 98,
        15.1, 98,
        30, 30, 60,
        1608, 1608, 3216,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Red tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'mens',
        28.7, 91,
        14.3, 91,
        14.3, 91,
        30, 30, 60,
        1422, 1422, 2844,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Red tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'ladies',
        29.1, 93,
        14.6, 93,
        14.6, 93,
        30, 30, 60,
        1422, 1422, 2844,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 3, 123, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 4, 280, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 3, 105, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 188, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 174, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 254, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 3, 132, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 237, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 3, 115, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 3, 123, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 280, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 3, 105, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 188, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 3, 174, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 4, 254, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 3, 132, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 4, 237, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 3, 115, 12);

    -- Holes for Yellow (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 3, 123, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 4, 280, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 3, 105, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 3, 188, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 3, 174, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 4, 254, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 3, 132, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 4, 237, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 3, 115, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 3, 123, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 280, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 3, 105, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 3, 188, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 3, 174, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 4, 254, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 3, 132, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 4, 237, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 3, 115, 12);

    -- Holes for Red (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 3, 98, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 4, 237, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 3, 87, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 3, 152, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 3, 165, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 4, 235, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 3, 123, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 4, 220, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 3, 105, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 3, 98, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 4, 237, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 3, 87, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 3, 152, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 3, 165, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 4, 235, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 3, 123, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 4, 220, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 3, 105, 12);

    -- Holes for Red (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 3, 98, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 4, 237, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 3, 87, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 3, 152, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 3, 165, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 4, 235, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 3, 123, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 4, 220, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 3, 105, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 3, 98, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 4, 237, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 3, 87, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 3, 152, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 3, 165, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 4, 235, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 3, 123, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 4, 220, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 3, 105, 12);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/elverum_golfklubb.sql
-- Course: Elverum Golfklubb
-- Location: Elverum, Norway
-- Type: 18-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
    v_tee_id_5 integer;
    v_tee_id_6 integer;
    v_tee_id_7 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Elverum Golfklubb', 'Elverum', 'Norway', 'https://elverumgolf.no/banen-index-par-lengde/', 'approved')
    returning id into v_course_id;

    -- Insert White tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'mens',
        73.3, 140,
        36.6, 140,
        36.6, 140,
        36, 36, 72,
        3260, 3055, 6315,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        71.3, 137,
        35.6, 137,
        35.6, 137,
        36, 36, 72,
        2985, 2860, 5845,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Yellow tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'ladies',
        77.3, 144,
        38.6, 144,
        38.6, 144,
        36, 36, 72,
        2985, 2860, 5845,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Blue tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Blue', 'mens',
        70.1, 133,
        35.0, 133,
        35.0, 133,
        36, 36, 72,
        2880, 2730, 5610,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Insert Blue tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Blue', 'ladies',
        75.8, 141,
        37.9, 141,
        37.9, 141,
        36, 36, 72,
        2880, 2730, 5610,
        'meters', 'approved'
    )
    returning id into v_tee_id_5;

    -- Insert Red tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'mens',
        65.9, 125,
        33.0, 125,
        33.0, 125,
        36, 36, 72,
        2545, 2465, 5010,
        'meters', 'approved'
    )
    returning id into v_tee_id_6;

    -- Insert Red tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'ladies',
        70.7, 130,
        35.4, 130,
        35.4, 130,
        36, 36, 72,
        2545, 2465, 5010,
        'meters', 'approved'
    )
    returning id into v_tee_id_7;

    -- Holes for White (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 4, 405, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 4, 360, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 4, 390, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 5, 465, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 4, 425, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 3, 175, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 380, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 150, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 5, 510, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 350, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 355, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 320, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 4, 370, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 3, 160, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 5, 490, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 4, 340, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 160, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 5, 510, 1);

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 4, 380, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 4, 330, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 4, 360, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 5, 440, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 4, 380, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 3, 145, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 4, 360, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 3, 125, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 5, 465, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 4, 310, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 335, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 4, 300, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 4, 355, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 3, 140, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 5, 480, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 4, 315, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 3, 130, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 5, 495, 1);

    -- Holes for Yellow (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 4, 380, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 4, 330, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 4, 360, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 5, 440, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 4, 380, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 3, 145, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 4, 360, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 3, 125, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 5, 465, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 4, 310, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 4, 335, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 4, 300, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 4, 355, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 3, 140, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 5, 480, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 4, 315, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 3, 130, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 5, 495, 1);

    -- Holes for Blue (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 4, 335, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 4, 330, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 4, 355, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 5, 430, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 4, 370, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 3, 135, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 4, 350, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 3, 120, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 5, 455, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 4, 300, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 4, 330, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 4, 290, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 4, 345, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 3, 130, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 5, 440, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 4, 305, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 3, 120, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 5, 470, 1);

    -- Holes for Blue (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 1, 4, 335, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 2, 4, 330, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 3, 4, 355, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 4, 5, 430, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 5, 4, 370, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 6, 3, 135, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 7, 4, 350, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 8, 3, 120, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 9, 5, 455, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 10, 4, 300, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 11, 4, 330, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 12, 4, 290, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 13, 4, 345, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 14, 3, 130, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 15, 5, 440, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 16, 4, 305, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 17, 3, 120, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 18, 5, 470, 1);

    -- Holes for Red (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 1, 4, 335, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 2, 4, 250, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 3, 4, 315, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 4, 5, 380, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 5, 4, 320, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 6, 3, 130, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 7, 4, 305, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 8, 3, 110, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 9, 5, 400, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 10, 4, 295, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 11, 4, 305, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 12, 4, 250, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 13, 4, 305, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 14, 3, 110, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 15, 5, 395, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 16, 4, 280, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 17, 3, 115, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 18, 5, 410, 1);

    -- Holes for Red (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 1, 4, 335, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 2, 4, 250, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 3, 4, 315, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 4, 5, 380, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 5, 4, 320, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 6, 3, 130, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 7, 4, 305, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 8, 3, 110, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 9, 5, 400, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 10, 4, 295, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 11, 4, 305, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 12, 4, 250, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 13, 4, 305, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 14, 3, 110, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 15, 5, 395, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 16, 4, 280, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 17, 3, 115, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 18, 5, 410, 1);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/fana_golfklubb.sql
-- Course: Fana Golfklubb
-- Location: Bergen, Norway
-- Type: 18-hole course
-- Tees: I (mens), I (ladies), II (mens), II (mens), III (mens), III (mens), IV (mens), IV (ladies), V (mens), V (ladies)
-- Generated by parse_scorecard_transposed.py

do $$
declare
    v_course_id integer;
    v_tee_id integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Fana Golfklubb', 'Bergen', 'Norway', 'https://fanagolf.no/', 'approved')
    returning id into v_course_id;

    -- Insert I tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'I', 'mens',
        70.6, 140,
        35.3, 140,
        35.3, 140,
        36, 33, 69,
        2799, 2332, 5131,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for I (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 275, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 121, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 398, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 349, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 318, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 128, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 360, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 464, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 386, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 372, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 3, 125, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 5, 460, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 370, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 3, 143, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 158, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 255, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 3, 163, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 286, 18);

    -- Insert I tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'I', 'ladies',
        76.4, 142,
        38.2, 142,
        38.2, 142,
        36, 33, 69,
        2799, 2332, 5131,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for I (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 275, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 121, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 398, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 349, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 318, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 128, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 360, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 464, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 386, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 372, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 3, 125, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 5, 460, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 370, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 3, 143, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 158, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 255, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 3, 163, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 286, 18);

    -- Insert II tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'II', 'mens',
        69.1, 137,
        34.5, 137,
        34.5, 137,
        36, 33, 69,
        2671, 2176, 4847,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for II (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 262, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 112, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 386, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 325, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 304, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 123, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 352, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 451, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 356, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 323, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 3, 125, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 5, 445, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 330, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 3, 131, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 158, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 255, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 3, 154, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 255, 18);

    -- Insert II tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'II', 'ladies',
        74.5, 137,
        37.2, 137,
        37.2, 137,
        36, 33, 69,
        2671, 2176, 4847,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for II (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 262, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 112, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 386, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 325, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 304, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 123, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 352, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 451, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 356, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 323, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 3, 125, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 5, 445, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 330, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 3, 131, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 158, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 255, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 3, 154, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 255, 18);

    -- Insert III tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'III', 'mens',
        67.0, 133,
        33.5, 133,
        33.5, 133,
        36, 33, 69,
        2398, 2004, 4402,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for III (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 253, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 112, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 376, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 325, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 236, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 123, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 300, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 418, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 255, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 323, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 3, 118, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 5, 364, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 330, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 3, 131, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 158, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 255, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 3, 140, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 185, 18);

    -- Insert III tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'III', 'ladies',
        71.8, 132,
        35.9, 132,
        35.9, 132,
        36, 33, 69,
        2398, 2004, 4402,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for III (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 253, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 112, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 376, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 325, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 236, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 123, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 300, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 418, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 255, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 323, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 3, 118, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 5, 364, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 330, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 3, 131, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 158, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 255, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 3, 140, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 185, 18);

    -- Insert IV tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'IV', 'mens',
        65.4, 130,
        32.7, 130,
        32.7, 130,
        36, 33, 69,
        2060, 1707, 3767,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for IV (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 235, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 98, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 318, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 256, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 222, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 103, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 231, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 342, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 255, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 271, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 3, 104, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 5, 364, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 255, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 3, 83, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 125, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 217, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 3, 120, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 168, 18);

    -- Insert IV tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'IV', 'ladies',
        68.8, 126,
        34.4, 126,
        34.4, 126,
        36, 33, 69,
        2060, 1707, 3767,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for IV (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 235, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 98, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 318, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 256, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 222, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 103, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 231, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 342, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 255, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 271, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 3, 104, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 5, 364, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 255, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 3, 83, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 125, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 217, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 3, 120, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 168, 18);

    -- Insert V tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'V', 'mens',
        62.2, 124,
        31.1, 124,
        31.1, 124,
        36, 33, 69,
        1469, 1320, 2789,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for V (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 156, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 59, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 275, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 197, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 165, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 80, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 121, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 276, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 140, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 205, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 3, 104, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 5, 245, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 164, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 3, 80, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 84, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 203, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 3, 76, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 159, 18);

    -- Insert V tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'V', 'ladies',
        63.5, 114,
        31.8, 114,
        31.8, 114,
        36, 33, 69,
        1469, 1320, 2789,
        'meters', 'approved'
    )
    returning id into v_tee_id;

    -- Holes for V (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 1, 4, 156, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 2, 3, 59, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 3, 5, 275, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 4, 4, 197, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 5, 4, 165, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 6, 3, 80, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 7, 4, 121, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 8, 5, 276, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 9, 4, 140, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 10, 4, 205, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 11, 3, 104, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 12, 5, 245, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 13, 4, 164, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 14, 3, 80, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 15, 3, 84, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 16, 4, 203, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 17, 3, 76, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, 18, 4, 159, 18);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/fet_golfklubb_&_leikvin_golfpark.sql
-- Course: Fet Golfklubb & Leikvin Golfpark
-- Location: Fetsund, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Fet Golfklubb & Leikvin Golfpark', 'Fetsund', 'Norway', 'https://www.fetgk.no/', 'approved')
    returning id into v_course_id;

    -- Insert White tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'mens',
        56.9, 87,
        28.4, 87,
        28.4, 87,
        28, 28, 56,
        1405, 1405, 2810,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert White tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'ladies',
        57.6, 97,
        28.8, 97,
        28.8, 97,
        28, 28, 56,
        1405, 1405, 2810,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Red tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'mens',
        56.7, 87,
        28.4, 87,
        28.4, 87,
        28, 28, 56,
        1375, 1375, 2750,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Red tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'ladies',
        57.5, 94,
        28.8, 94,
        28.8, 94,
        28, 28, 56,
        1375, 1375, 2750,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Holes for White (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 4, 350, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 85, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 3, 124, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 125, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 178, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 3, 137, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 3, 122, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 136, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 3, 148, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 350, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 3, 85, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 3, 124, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 125, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 3, 178, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 3, 137, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 3, 122, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 136, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 3, 148, 14);

    -- Holes for White (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 4, 350, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 3, 85, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 3, 124, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 3, 125, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 3, 178, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 3, 137, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 3, 122, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 3, 136, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 3, 148, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 4, 350, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 3, 85, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 3, 124, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 3, 125, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 3, 178, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 3, 137, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 3, 122, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 3, 136, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 3, 148, 14);

    -- Holes for Red (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 4, 350, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 3, 85, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 3, 124, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 3, 125, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 3, 148, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 3, 137, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 3, 122, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 3, 136, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 3, 148, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 4, 350, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 3, 85, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 3, 124, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 3, 125, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 3, 148, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 3, 137, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 3, 122, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 3, 136, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 3, 148, 14);

    -- Holes for Red (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 4, 350, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 3, 85, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 3, 124, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 3, 125, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 3, 148, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 3, 137, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 3, 122, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 3, 136, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 3, 148, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 4, 350, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 3, 85, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 3, 124, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 3, 125, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 3, 148, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 3, 137, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 3, 122, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 3, 136, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 3, 148, 14);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/groruddalen_golfklubb.sql
-- Course: Groruddalen Golfklubb
-- Location: Oslo, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Groruddalen Golfklubb', 'Oslo', 'Norway', 'https://grorudgk.no/', 'approved')
    returning id into v_course_id;

    -- Insert Gul (Yellow) tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Gul (Yellow)', 'mens',
        29.5, 97,
        14.8, 97,
        14.8, 97,
        27, 27, 54,
        1302, 1302, 2604,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Gul (Yellow) tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Gul (Yellow)', 'ladies',
        29.88, 93,
        14.9, 93,
        14.9, 93,
        27, 27, 54,
        1302, 1302, 2604,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Rød (Red) tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Rød (Red)', 'mens',
        28.9, 94,
        14.4, 94,
        14.4, 94,
        27, 27, 54,
        1257, 1257, 2514,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Rød (Red) tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Rød (Red)', 'ladies',
        29.5, 92,
        14.8, 92,
        14.8, 92,
        27, 27, 54,
        1257, 1257, 2514,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Holes for Gul (Yellow) (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 3, 129, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 130, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 3, 158, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 154, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 135, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 3, 131, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 3, 164, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 210, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 3, 91, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 3, 129, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 3, 130, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 3, 158, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 154, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 3, 135, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 3, 131, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 3, 164, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 210, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 3, 91, 18);

    -- Holes for Gul (Yellow) (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 3, 129, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 3, 130, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 3, 158, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 3, 154, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 3, 135, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 3, 131, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 3, 164, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 3, 210, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 3, 91, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 3, 129, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 3, 130, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 3, 158, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 3, 154, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 3, 135, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 3, 131, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 3, 164, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 3, 210, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 3, 91, 18);

    -- Holes for Rød (Red) (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 3, 113, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 3, 122, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 3, 151, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 3, 155, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 3, 135, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 3, 131, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 3, 164, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 3, 195, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 3, 91, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 3, 113, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 3, 122, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 3, 151, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 3, 155, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 3, 135, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 3, 131, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 3, 164, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 3, 195, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 3, 91, 18);

    -- Holes for Rød (Red) (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 3, 113, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 3, 122, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 3, 151, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 3, 155, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 3, 135, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 3, 131, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 3, 164, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 3, 195, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 3, 91, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 3, 113, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 3, 122, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 3, 151, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 3, 155, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 3, 135, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 3, 131, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 3, 164, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 3, 195, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 3, 91, 18);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/grønmo_golfklubb.sql
-- Course: Grønmo Golfklubb
-- Location: Oslo, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Grønmo Golfklubb', 'Oslo', 'Norway', 'https://gronmogk.no/', 'approved')
    returning id into v_course_id;

    -- Insert White tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'mens',
        70.7, 121,
        35.4, 121,
        35.4, 121,
        36, 36, 72,
        2806, 2806, 5612,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        69.2, 117,
        34.6, 117,
        34.6, 117,
        36, 36, 72,
        2716, 2716, 5432,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Red tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'mens',
        66.1, 111,
        33.0, 111,
        33.0, 111,
        36, 36, 72,
        2350, 2350, 4700,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Red tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'ladies',
        67.1, 113,
        33.5, 113,
        33.5, 113,
        36, 36, 72,
        2350, 2350, 4700,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Holes for White (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 5, 485, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 4, 254, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 4, 357, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 4, 356, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 128, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 321, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 5, 411, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 147, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 4, 347, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 5, 485, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 254, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 357, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 4, 356, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 3, 128, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 4, 321, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 5, 411, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 147, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 4, 347, 14);

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 5, 452, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 4, 254, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 4, 333, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 4, 336, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 3, 122, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 4, 321, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 5, 411, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 3, 140, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 4, 347, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 5, 452, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 254, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 4, 333, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 4, 336, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 3, 122, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 4, 321, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 5, 411, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 3, 140, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 4, 347, 14);

    -- Holes for Red (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 5, 410, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 4, 218, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 4, 295, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 4, 289, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 3, 105, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 4, 279, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 5, 337, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 3, 99, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 4, 318, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 5, 410, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 4, 218, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 4, 295, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 4, 289, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 3, 105, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 4, 279, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 5, 337, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 3, 99, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 4, 318, 14);

    -- Holes for Red (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 5, 410, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 4, 218, 33);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 4, 295, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 4, 289, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 3, 105, 29);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 4, 279, 25);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 5, 337, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 3, 99, 21);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 4, 318, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 5, 410, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 4, 218, 34);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 4, 295, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 4, 289, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 3, 105, 30);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 4, 279, 26);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 5, 337, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 3, 99, 22);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 4, 318, 14);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/holtsmark_golfklubb_-_18_hole_course.sql
-- Course: Holtsmark Golfklubb - 18 Hole Course
-- Location: Sylling, Norway
-- Type: 18-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
    v_tee_id_5 integer;
    v_tee_id_6 integer;
    v_tee_id_7 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Holtsmark Golfklubb - 18 Hole Course', 'Sylling', 'Norway', 'https://holtsmarkgolf.no/?_gl=1*16bcz22*_up*MQ..*_ga*MTM5NjI1NDMwLjE3NjkwOTQyNTU.*_ga_BP6D4CKNFD*czE3NjkwOTQyNTIkbzEkZzEkdDE3NjkwOTQyODEkajMxJGwwJGgw', 'approved')
    returning id into v_course_id;

    -- Insert Tee 63 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 63', 'mens',
        73.9, 140,
        37.0, 140,
        37.0, 140,
        36, 36, 72,
        2878, 2880, 5758,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Tee 58 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 58', 'mens',
        71.3, 135,
        35.6, 135,
        35.6, 135,
        36, 36, 72,
        2592, 2639, 5231,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Tee 58 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 58', 'ladies',
        77.0, 145,
        38.5, 145,
        38.5, 145,
        36, 36, 72,
        2592, 2639, 5231,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Tee 52 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 52', 'mens',
        68.5, 127,
        34.2, 127,
        34.2, 127,
        36, 36, 72,
        2365, 2222, 4587,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Insert Tee 52 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 52', 'ladies',
        73.3, 137,
        36.6, 137,
        36.6, 137,
        36, 36, 72,
        2365, 2222, 4587,
        'meters', 'approved'
    )
    returning id into v_tee_id_5;

    -- Insert Tee 47 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 47', 'mens',
        66.3, 124,
        33.1, 124,
        33.1, 124,
        36, 36, 72,
        2161, 2079, 4240,
        'meters', 'approved'
    )
    returning id into v_tee_id_6;

    -- Insert Tee 47 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 47', 'ladies',
        70.5, 133,
        35.2, 133,
        35.2, 133,
        36, 36, 72,
        2161, 2079, 4240,
        'meters', 'approved'
    )
    returning id into v_tee_id_7;

    -- Holes for Tee 63 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 5, 427, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 4, 352, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 3, 170, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 4, 317, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 182, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 5, 395, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 5, 507, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 360, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 3, 168, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 332, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 314, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 3, 147, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 4, 324, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 4, 398, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 5, 411, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 4, 301, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 146, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 5, 507, 2);

    -- Holes for Tee 58 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 5, 399, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 4, 326, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 3, 131, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 4, 290, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 3, 131, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 5, 370, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 5, 462, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 4, 339, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 3, 144, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 4, 319, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 286, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 3, 128, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 4, 279, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 4, 360, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 5, 384, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 4, 291, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 3, 124, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 5, 468, 2);

    -- Holes for Tee 58 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 5, 399, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 4, 326, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 3, 131, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 4, 290, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 3, 131, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 5, 370, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 5, 462, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 4, 339, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 3, 144, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 4, 319, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 4, 286, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 3, 128, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 4, 279, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 4, 360, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 5, 384, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 4, 291, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 3, 124, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 5, 468, 2);

    -- Holes for Tee 52 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 5, 387, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 4, 305, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 3, 93, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 4, 283, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 3, 113, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 5, 325, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 5, 422, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 4, 331, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 3, 106, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 4, 247, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 4, 276, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 3, 118, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 4, 218, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 4, 263, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 5, 336, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 4, 270, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 3, 114, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 5, 380, 2);

    -- Holes for Tee 52 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 1, 5, 387, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 2, 4, 305, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 3, 3, 93, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 4, 4, 283, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 5, 3, 113, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 6, 5, 325, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 7, 5, 422, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 8, 4, 331, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 9, 3, 106, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 10, 4, 247, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 11, 4, 276, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 12, 3, 118, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 13, 4, 218, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 14, 4, 263, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 15, 5, 336, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 16, 4, 270, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 17, 3, 114, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 18, 5, 380, 2);

    -- Holes for Tee 47 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 1, 5, 350, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 2, 4, 305, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 3, 3, 90, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 4, 4, 218, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 5, 3, 80, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 6, 5, 325, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 7, 5, 422, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 8, 4, 299, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 9, 3, 72, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 10, 4, 247, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 11, 4, 244, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 12, 3, 80, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 13, 4, 218, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 14, 4, 263, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 15, 5, 336, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 16, 4, 224, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 17, 3, 87, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 18, 5, 380, 2);

    -- Holes for Tee 47 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 1, 5, 350, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 2, 4, 305, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 3, 3, 90, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 4, 4, 218, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 5, 3, 80, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 6, 5, 325, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 7, 5, 422, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 8, 4, 299, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 9, 3, 72, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 10, 4, 247, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 11, 4, 244, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 12, 3, 80, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 13, 4, 218, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 14, 4, 263, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 15, 5, 336, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 16, 4, 224, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 17, 3, 87, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 18, 5, 380, 2);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/holtsmark_golfklubb_-_9_hole_course.sql
-- Course: Holtsmark Golfklubb - 9 Hole Course
-- Location: Sylling, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Holtsmark Golfklubb - 9 Hole Course', 'Sylling', 'Norway', 'https://holtsmarkgolf.no/?_gl=1*16bcz22*_up*MQ..*_ga*MTM5NjI1NDMwLjE3NjkwOTQyNTU.*_ga_BP6D4CKNFD*czE3NjkwOTQyNTIkbzEkZzEkdDE3NjkwOTQyODEkajMxJGwwJGgw', 'approved')
    returning id into v_course_id;

    -- Insert Gul (Yellow) tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Gul (Yellow)', 'mens',
        31.5, 95,
        15.8, 95,
        15.8, 95,
        31, 31, 62,
        1504, 1504, 3008,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Gul (Yellow) tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Gul (Yellow)', 'ladies',
        31.8, 99,
        15.9, 99,
        15.9, 99,
        31, 31, 62,
        1504, 1504, 3008,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Holes for Gul (Yellow) (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 4, 279, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 133, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 3, 91, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 4, 224, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 110, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 265, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 3, 119, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 96, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 4, 187, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 279, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 3, 133, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 3, 91, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 4, 224, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 3, 110, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 4, 265, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 3, 119, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 96, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 4, 187, 6);

    -- Holes for Gul (Yellow) (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 4, 279, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 3, 133, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 3, 91, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 4, 224, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 3, 110, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 4, 265, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 3, 119, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 3, 96, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 4, 187, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 4, 279, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 3, 133, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 3, 91, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 4, 224, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 3, 110, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 4, 265, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 3, 119, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 3, 96, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 4, 187, 6);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/nordhaug_golfklubb.sql
-- Course: Nordhaug Golfklubb
-- Location: Bekkestua, Norway
-- Type: 9-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
    v_tee_id_5 integer;
    v_tee_id_6 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Nordhaug Golfklubb', 'Bekkestua', 'Norway', 'https://nordhauggk.no/', 'approved')
    returning id into v_course_id;

    -- Insert White tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'mens',
        57.2, 87,
        28.6, 87,
        28.6, 87,
        29, 29, 58,
        1444, 1444, 2888,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert White tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'ladies',
        58.8, 91,
        29.4, 91,
        29.4, 91,
        29, 29, 58,
        1444, 1444, 2888,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        54.8, 86,
        27.4, 86,
        27.4, 86,
        29, 29, 58,
        1176, 1176, 2352,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Yellow tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'ladies',
        56.0, 87,
        28.0, 87,
        28.0, 87,
        29, 29, 58,
        1176, 1176, 2352,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Insert Red tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'mens',
        50.0, 80,
        25.0, 80,
        25.0, 80,
        29, 29, 58,
        969, 969, 1938,
        'meters', 'approved'
    )
    returning id into v_tee_id_5;

    -- Insert Red tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'ladies',
        51.0, 83,
        25.5, 83,
        25.5, 83,
        29, 29, 58,
        969, 969, 1938,
        'meters', 'approved'
    )
    returning id into v_tee_id_6;

    -- Holes for White (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 3, 153, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 132, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 4, 274, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 3, 144, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 109, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 3, 173, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 220, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 93, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 3, 146, 7);

    -- Holes for White (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 3, 153, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 3, 132, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 4, 274, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 3, 144, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 3, 109, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 3, 173, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 4, 220, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 3, 93, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 3, 146, 5);

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 3, 91, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 3, 117, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 4, 252, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 3, 93, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 3, 101, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 3, 142, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 4, 180, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 3, 78, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 3, 122, 7);

    -- Holes for Yellow (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 3, 91, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 3, 117, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 4, 252, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 3, 93, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 3, 101, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 3, 142, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 4, 180, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 3, 78, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 3, 122, 5);

    -- Holes for Red (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 1, 3, 73, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 2, 3, 98, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 3, 4, 213, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 4, 3, 68, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 5, 3, 88, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 6, 3, 115, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 7, 4, 148, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 8, 3, 70, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 9, 3, 96, 7);

    -- Holes for Red (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 1, 3, 73, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 2, 3, 98, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 3, 4, 213, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 4, 3, 68, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 5, 3, 88, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 6, 3, 115, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 7, 4, 148, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 8, 3, 70, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 9, 3, 96, 5);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/oslo_golfklubb.sql
-- Course: Oslo Golfklubb
-- Location: Oslo, Norway
-- Type: 18-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
    v_tee_id_5 integer;
    v_tee_id_6 integer;
    v_tee_id_7 integer;
    v_tee_id_8 integer;
    v_tee_id_9 integer;
    v_tee_id_10 integer;
    v_tee_id_11 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('Oslo Golfklubb', 'Oslo', 'Norway', 'https://www.oslogk.no/', 'approved')
    returning id into v_course_id;

    -- Insert Tee 63 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 63', 'mens',
        74.6, 151,
        37.3, 151,
        37.3, 151,
        36, 36, 72,
        3154, 3122, 6276,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Tee 61 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 61', 'mens',
        73.5, 147,
        36.8, 147,
        36.8, 147,
        36, 36, 72,
        3085, 2974, 6059,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Tee 61 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 61', 'ladies',
        79.9, 151,
        40.0, 151,
        40.0, 151,
        36, 36, 72,
        3085, 2974, 6059,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Tee 58 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 58', 'mens',
        72.1, 145,
        36.0, 145,
        36.0, 145,
        36, 36, 72,
        2917, 2872, 5789,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Insert Tee 58 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 58', 'ladies',
        78.3, 148,
        39.1, 148,
        39.1, 148,
        36, 36, 72,
        2917, 2872, 5789,
        'meters', 'approved'
    )
    returning id into v_tee_id_5;

    -- Insert Tee 54 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 54', 'mens',
        69.7, 144,
        34.9, 144,
        34.9, 144,
        36, 36, 72,
        2687, 2715, 5402,
        'meters', 'approved'
    )
    returning id into v_tee_id_6;

    -- Insert Tee 54 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 54', 'ladies',
        75.9, 143,
        38.0, 143,
        38.0, 143,
        36, 36, 72,
        2687, 2715, 5402,
        'meters', 'approved'
    )
    returning id into v_tee_id_7;

    -- Insert Tee 49 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 49', 'mens',
        67.5, 137,
        33.8, 137,
        33.8, 137,
        36, 36, 72,
        2432, 2466, 4898,
        'meters', 'approved'
    )
    returning id into v_tee_id_8;

    -- Insert Tee 49 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 49', 'ladies',
        72.9, 136,
        36.5, 136,
        36.5, 136,
        36, 36, 72,
        2432, 2466, 4898,
        'meters', 'approved'
    )
    returning id into v_tee_id_9;

    -- Insert Tee 41 tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 41', 'mens',
        67.4, 126,
        33.7, 126,
        33.7, 126,
        36, 36, 72,
        2017, 2034, 4051,
        'meters', 'approved'
    )
    returning id into v_tee_id_10;

    -- Insert Tee 41 tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Tee 41', 'ladies',
        64.0, 129,
        32.0, 129,
        32.0, 129,
        36, 36, 72,
        2017, 2034, 4051,
        'meters', 'approved'
    )
    returning id into v_tee_id_11;

    -- Holes for Tee 63 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 4, 331, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 5, 449, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 3, 225, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 4, 392, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 4, 374, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 365, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 4, 301, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 3, 157, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 5, 560, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 5, 508, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 3, 170, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 353, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 4, 304, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 4, 323, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 5, 523, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 3, 206, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 4, 357, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 4, 378, 14);

    -- Holes for Tee 61 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 4, 329, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 5, 442, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 3, 215, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 4, 385, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 4, 362, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 4, 357, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 4, 291, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 3, 150, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 5, 554, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 5, 503, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 3, 165, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 4, 343, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 4, 294, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 4, 313, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 5, 513, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 3, 167, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 4, 347, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 4, 329, 14);

    -- Holes for Tee 61 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 4, 329, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 5, 442, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 3, 215, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 4, 385, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 4, 362, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 4, 357, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 4, 291, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 3, 150, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 5, 554, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 5, 503, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 3, 165, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 4, 343, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 4, 294, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 4, 313, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 5, 513, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 3, 167, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 4, 347, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 4, 329, 14);

    -- Holes for Tee 58 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 4, 325, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 5, 435, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 3, 178, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 4, 378, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 4, 355, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 4, 315, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 4, 281, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 3, 136, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 5, 514, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 5, 495, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 3, 157, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 4, 333, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 4, 284, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 4, 303, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 5, 498, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 3, 146, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 4, 337, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 4, 319, 14);

    -- Holes for Tee 58 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 1, 4, 325, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 2, 5, 435, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 3, 3, 178, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 4, 4, 378, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 5, 4, 355, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 6, 4, 315, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 7, 4, 281, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 8, 3, 136, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 9, 5, 514, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 10, 5, 495, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 11, 3, 157, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 12, 4, 333, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 13, 4, 284, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 14, 4, 303, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 15, 5, 498, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 16, 3, 146, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 17, 4, 337, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_5, 18, 4, 319, 14);

    -- Holes for Tee 54 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 1, 4, 321, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 2, 5, 360, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 3, 3, 165, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 4, 4, 342, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 5, 4, 323, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 6, 4, 305, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 7, 4, 261, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 8, 3, 127, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 9, 5, 483, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 10, 5, 455, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 11, 3, 148, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 12, 4, 325, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 13, 4, 278, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 14, 4, 293, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 15, 5, 473, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 16, 3, 138, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 17, 4, 312, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_6, 18, 4, 293, 14);

    -- Holes for Tee 54 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 1, 4, 321, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 2, 5, 360, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 3, 3, 165, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 4, 4, 342, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 5, 4, 323, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 6, 4, 305, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 7, 4, 261, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 8, 3, 127, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 9, 5, 483, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 10, 5, 455, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 11, 3, 148, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 12, 4, 325, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 13, 4, 278, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 14, 4, 293, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 15, 5, 473, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 16, 3, 138, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 17, 4, 312, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_7, 18, 4, 293, 14);

    -- Holes for Tee 49 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 1, 4, 290, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 2, 5, 355, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 3, 3, 157, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 4, 4, 282, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 5, 4, 318, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 6, 4, 223, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 7, 4, 251, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 8, 3, 122, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 9, 5, 434, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 10, 5, 451, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 11, 3, 139, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 12, 4, 267, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 13, 4, 271, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 14, 4, 278, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 15, 5, 430, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 16, 3, 109, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 17, 4, 293, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_8, 18, 4, 228, 14);

    -- Holes for Tee 49 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 1, 4, 290, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 2, 5, 355, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 3, 3, 157, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 4, 4, 282, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 5, 4, 318, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 6, 4, 223, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 7, 4, 251, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 8, 3, 122, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 9, 5, 434, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 10, 5, 451, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 11, 3, 139, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 12, 4, 267, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 13, 4, 271, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 14, 4, 278, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 15, 5, 430, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 16, 3, 109, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 17, 4, 293, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_9, 18, 4, 228, 14);

    -- Holes for Tee 41 (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 1, 4, 216, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 2, 5, 355, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 3, 3, 102, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 4, 4, 282, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 5, 4, 234, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 6, 4, 223, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 7, 4, 210, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 8, 3, 78, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 9, 5, 317, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 10, 5, 365, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 11, 3, 98, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 12, 4, 198, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 13, 4, 210, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 14, 4, 218, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 15, 5, 384, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 16, 3, 109, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 17, 4, 224, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_10, 18, 4, 228, 14);

    -- Holes for Tee 41 (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 1, 4, 216, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 2, 5, 355, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 3, 3, 102, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 4, 4, 282, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 5, 4, 234, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 6, 4, 223, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 7, 4, 210, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 8, 3, 78, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 9, 5, 317, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 10, 5, 365, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 11, 3, 98, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 12, 4, 198, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 13, 4, 210, 12);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 14, 4, 218, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 15, 5, 384, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 16, 3, 109, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 17, 4, 224, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_11, 18, 4, 228, 14);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;
-- Source: scripts/sql/the_gleneagles_hotel_-_queen's_course.sql
-- Course: The Gleneagles Hotel - Queen's Course
-- Location: Auchterarder, Scotland
-- Type: 18-hole course
-- Generated by parse_scorecard.py

do $$
declare
    v_course_id integer;
    v_tee_id_1 integer;
    v_tee_id_2 integer;
    v_tee_id_3 integer;
    v_tee_id_4 integer;
begin

    -- Insert course
    insert into public.course (name, city, country, website, "approvalStatus")
    values ('The Gleneagles Hotel - Queen''s Course', 'Auchterarder', 'Scotland', 'https://gleneagles.com/golf/the-queens/', 'approved')
    returning id into v_course_id;

    -- Insert White tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'White', 'mens',
        69.3, 121,
        34.6, 121,
        34.6, 121,
        35, 33, 68,
        2916, 2525, 5441,
        'meters', 'approved'
    )
    returning id into v_tee_id_1;

    -- Insert Yellow tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Yellow', 'mens',
        68.0, 118,
        34.0, 118,
        34.0, 118,
        35, 33, 68,
        2788, 2388, 5176,
        'meters', 'approved'
    )
    returning id into v_tee_id_2;

    -- Insert Red tee (mens)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'mens',
        67.1, 117,
        33.5, 117,
        33.5, 117,
        35, 33, 68,
        2731, 2294, 5025,
        'meters', 'approved'
    )
    returning id into v_tee_id_3;

    -- Insert Red tee (ladies)
    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, 'Red', 'ladies',
        72.1, 132,
        36.0, 132,
        36.0, 132,
        35, 33, 68,
        2731, 2294, 5025,
        'meters', 'approved'
    )
    returning id into v_tee_id_4;

    -- Holes for White (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 1, 4, 374, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 2, 3, 134, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 3, 4, 381, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 4, 4, 325, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 5, 3, 162, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 6, 4, 400, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 7, 5, 449, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 8, 4, 308, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 9, 4, 383, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 10, 4, 385, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 11, 4, 291, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 12, 4, 396, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 13, 3, 128, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 14, 3, 185, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 15, 4, 230, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 16, 4, 346, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 17, 3, 187, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_1, 18, 4, 377, 12);

    -- Holes for Yellow (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 1, 4, 354, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 2, 3, 119, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 3, 4, 376, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 4, 4, 321, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 5, 3, 149, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 6, 4, 372, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 7, 5, 435, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 8, 4, 283, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 9, 4, 379, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 10, 4, 369, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 11, 4, 283, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 12, 4, 372, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 13, 3, 121, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 14, 3, 162, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 15, 4, 230, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 16, 4, 337, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 17, 3, 167, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_2, 18, 4, 347, 12);

    -- Holes for Red (mens)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 1, 4, 345, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 2, 3, 107, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 3, 4, 376, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 4, 4, 316, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 5, 3, 134, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 6, 4, 369, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 7, 5, 429, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 8, 4, 276, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 9, 4, 379, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 10, 4, 361, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 11, 4, 275, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 12, 4, 370, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 13, 3, 118, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 14, 3, 156, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 15, 4, 201, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 16, 4, 333, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 17, 3, 160, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_3, 18, 4, 320, 12);

    -- Holes for Red (ladies)
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 1, 4, 345, 7);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 2, 3, 107, 17);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 3, 4, 376, 3);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 4, 4, 316, 11);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 5, 3, 134, 15);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 6, 4, 369, 9);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 7, 5, 429, 1);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 8, 4, 276, 13);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 9, 4, 379, 5);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 10, 4, 361, 4);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 11, 4, 275, 2);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 12, 4, 370, 6);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 13, 3, 118, 18);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 14, 3, 156, 8);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 15, 4, 201, 16);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 16, 4, 333, 10);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 17, 3, 160, 14);
    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_4, 18, 4, 320, 12);

    raise notice 'Successfully inserted course: %', v_course_id;
end $$;