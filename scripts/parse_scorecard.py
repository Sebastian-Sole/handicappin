#!/usr/bin/env python3
"""
Parse golf scorecard data from GolfPass format and generate SQL insert statements.

Usage:
    python scripts/parse_scorecard.py

You'll be prompted to enter:
1. Course information (name, city, country, website)
2. The scorecard data (paste from GolfPass)
"""

import re
import sys
from dataclasses import dataclass
from typing import Optional


@dataclass
class TeeData:
    name: str
    gender: str
    course_rating_18: float
    slope_rating_18: int
    distances: list[int]  # Per-hole distances


@dataclass
class CourseData:
    name: str
    city: str
    country: str
    website: Optional[str]
    tees: list[TeeData]
    pars: list[int]  # Per-hole pars
    handicaps_m: list[int]  # Men's handicap strokes per hole
    handicaps_w: list[int]  # Women's handicap strokes per hole
    is_9_hole: bool
    out_par: int  # Front 9 par total
    in_par: int  # Back 9 par total
    distance_measurement: str  # "meters" or "yards"


def extract_hole_distances(all_numbers: list[int]) -> tuple[list[int], list[int], bool]:
    """
    Extract hole distances from a list of numbers, removing Out/In/Total columns.

    For 9-hole: [h1-h9, Out, Total] -> 11 numbers
    For 18-hole: [h1-h9, Out, h10-h18, In, Total] -> 21 numbers

    Returns: (front_9_distances, back_9_distances, is_18_hole)
    """
    if len(all_numbers) >= 21:
        # 18-hole course: positions 0-8 are front 9, position 9 is Out,
        # positions 10-18 are back 9, position 19 is In, position 20 is Total
        front_9 = all_numbers[0:9]
        back_9 = all_numbers[10:19]
        return front_9, back_9, True
    elif len(all_numbers) >= 11:
        # 9-hole course: positions 0-8 are holes, 9 is Out, 10 is Total
        front_9 = all_numbers[0:9]
        return front_9, [], False
    else:
        # Just hole distances
        return all_numbers[:9], [], False


def parse_tee_row(row: str) -> tuple[list[TeeData], bool]:
    """
    Parse a tee row like:
    9-hole: White M: 57.2/87 W: 58.8/91    153    132    274    ...    1444    2888
    18-hole: White M: 69.3/121    374    134    381    ...    Out    ...    In    Total
    Multi-word: Tee 63 M: 74.6/151    362    491    ...

    Returns tuple of (list of TeeData, is_18_hole)
    """
    tees = []
    is_18_hole = False

    # Extract tee name and ratings
    # Pattern: TeeName M: rating/slope W: rating/slope
    # Use .+? (non-greedy) to match multi-word tee names like "Tee 63"
    pattern = r'^(.+?)\s+M:\s*([\d.]+)/([\d]+)\s+W:\s*([\d.]+)/([\d]+)\s+(.+)$'
    match = re.match(pattern, row.strip())

    if not match:
        # Try pattern without W rating (men only tee)
        pattern_m_only = r'^(.+?)\s+M:\s*([\d.]+)/([\d]+)\s+(.+)$'
        match = re.match(pattern_m_only, row.strip())
        if match:
            tee_name = match.group(1)
            m_rating = float(match.group(2))
            m_slope = int(match.group(3))
            distances_str = match.group(4)

            # Parse all numbers from the distance string
            all_numbers = [int(d) for d in distances_str.split() if d.isdigit()]
            front_9, back_9, is_18_hole = extract_hole_distances(all_numbers)

            tees.append(TeeData(
                name=tee_name,
                gender="mens",
                course_rating_18=m_rating,
                slope_rating_18=m_slope,
                distances=front_9 + back_9 if is_18_hole else front_9
            ))
            return tees, is_18_hole
        return [], False

    tee_name = match.group(1)
    m_rating = float(match.group(2))
    m_slope = int(match.group(3))
    w_rating = float(match.group(4))
    w_slope = int(match.group(5))
    distances_str = match.group(6)

    # Parse all numbers from the distance string
    all_numbers = [int(d) for d in distances_str.split() if d.isdigit()]
    front_9, back_9, is_18_hole = extract_hole_distances(all_numbers)
    distances = front_9 + back_9 if is_18_hole else front_9

    # Create tee data for both genders
    tees.append(TeeData(
        name=tee_name,
        gender="mens",
        course_rating_18=m_rating,
        slope_rating_18=m_slope,
        distances=distances
    ))
    tees.append(TeeData(
        name=tee_name,
        gender="ladies",
        course_rating_18=w_rating,
        slope_rating_18=w_slope,
        distances=distances
    ))

    return tees, is_18_hole


def convert_9_to_18_hole_handicaps(nine_hole_hcps: list[int]) -> list[int]:
    """
    Convert 9-hole handicaps to 18-hole handicaps.

    For 9-hole courses played twice as 18, the handicaps are interleaved:
    - The hole with 9-hcp 1 gets 18-hcp 1 (front) and 2 (back)
    - The hole with 9-hcp 2 gets 18-hcp 3 (front) and 4 (back)
    - etc.

    Formula:
    - Front 9: 18_hcp = (9_hcp * 2) - 1
    - Back 9: 18_hcp = 9_hcp * 2
    """
    front_9_hcps = []
    back_9_hcps = []

    for nine_hcp in nine_hole_hcps:
        front_9_hcps.append((nine_hcp * 2) - 1)
        back_9_hcps.append(nine_hcp * 2)

    return front_9_hcps + back_9_hcps


def parse_handicap_row(row: str, is_18_hole: bool) -> list[int]:
    """
    Parse handicap row.
    9-hole: Handicap    5    13    9    1    11    3    15    17    7
    18-hole: Handicap    5    17    1    3    15    7    9    11    13        4    2    6    18    8    16    10    14    12

    For 9-hole courses, returns 18 handicap values (converted from 9-hole).
    """
    # Remove the label and extract numbers
    numbers = re.findall(r'\d+', row)
    numbers = [int(n) for n in numbers]

    if is_18_hole:
        # For 18-hole, we need all 18 handicap values
        return numbers[:18]
    else:
        # For 9-hole, convert to 18-hole handicaps
        nine_hole_hcps = numbers[:9]
        return convert_9_to_18_hole_handicaps(nine_hole_hcps)


def parse_par_row(row: str, is_18_hole: bool) -> tuple[list[int], int, int, int]:
    """
    Parse par row.
    9-hole: Par    3    3    4    3    3    3    4    3    3    29    58
    18-hole: Par    4    3    4    4    3    4    5    4    4    35    4    4    4    3    3    4    4    3    4    33    68

    Returns: (per_hole_pars, out_par, in_par, total_par)
    """
    numbers = re.findall(r'\d+', row)
    numbers = [int(n) for n in numbers]

    if is_18_hole and len(numbers) >= 21:
        # 18-hole: [h1-h9 pars, Out, h10-h18 pars, In, Total]
        front_9_pars = numbers[0:9]
        out_par = numbers[9]
        back_9_pars = numbers[10:19]
        in_par = numbers[19]
        total_par = numbers[20]
        return front_9_pars + back_9_pars, out_par, in_par, total_par
    elif len(numbers) >= 11:
        # 9-hole: [h1-h9 pars, Out, Total]
        return numbers[:9], numbers[9], numbers[9], numbers[10]
    elif len(numbers) >= 9:
        out_par = sum(numbers[:9])
        return numbers[:9], out_par, out_par, out_par * 2
    else:
        raise ValueError(f"Could not parse par row: {row}")


def parse_scorecard(scorecard_text: str) -> tuple[list[TeeData], list[int], list[int], list[int], bool, int, int]:
    """
    Parse the full scorecard text.
    Returns: (tees, pars, handicaps_m, handicaps_w, is_9_hole, out_par, in_par)
    """
    lines = [line.strip() for line in scorecard_text.strip().split('\n') if line.strip()]

    tees = []
    pars = []
    handicaps_m = []
    handicaps_w = []
    is_18_hole = False
    out_par = 0
    in_par = 0

    # First pass: detect if 18-hole by checking tee rows
    for line in lines:
        if 'M:' in line:
            _, detected_18 = parse_tee_row(line)
            if detected_18:
                is_18_hole = True
                break

    # Second pass: parse everything with correct hole count
    for line in lines:
        # Skip header row
        if line.startswith('Hole'):
            continue

        # Check if it's a tee row (contains "M:" or ratings pattern)
        if 'M:' in line:
            parsed_tees, _ = parse_tee_row(line)
            tees.extend(parsed_tees)
        elif line.startswith('Handicap (W)') or line.startswith('Handicap(W)'):
            handicaps_w = parse_handicap_row(line, is_18_hole)
        elif line.startswith('Handicap'):
            handicaps_m = parse_handicap_row(line, is_18_hole)
        elif line.startswith('Par'):
            pars, out_par, in_par, _ = parse_par_row(line, is_18_hole)

    # If no women's handicap row, use men's
    if not handicaps_w:
        handicaps_w = handicaps_m

    is_9_hole = not is_18_hole
    return tees, pars, handicaps_m, handicaps_w, is_9_hole, out_par, in_par


def generate_sql(course: CourseData) -> str:
    """Generate SQL INSERT statements for the course data."""
    sql_parts = []

    # Header comment
    sql_parts.append(f"-- Course: {course.name}")
    sql_parts.append(f"-- Location: {course.city}, {course.country}")
    sql_parts.append(f"-- Type: {'9-hole' if course.is_9_hole else '18-hole'} course")
    sql_parts.append("")

    # Insert course
    website_value = f"'{course.website}'" if course.website else "null"
    sql_parts.append("-- Insert course")
    sql_parts.append(f"""insert into public.course (name, city, country, website, approval_status)
values ('{course.name}', '{course.city}', '{course.country}', {website_value}, 'approved')
returning id;""")
    sql_parts.append("")
    sql_parts.append("-- NOTE: Replace @course_id with the returned id from above")
    sql_parts.append("")

    # Calculate totals for teeInfo
    out_par = sum(course.pars)
    in_par = out_par  # Same for 9-hole course played twice
    total_par = out_par * 2 if course.is_9_hole else out_par + in_par

    # Insert teeInfo for each tee/gender combination
    sql_parts.append("-- Insert tee info")
    for tee in course.tees:
        out_distance = sum(tee.distances)
        in_distance = out_distance  # Same for 9-hole
        total_distance = out_distance * 2 if course.is_9_hole else out_distance + in_distance

        # For 9-hole courses, front9 and back9 ratings are typically the same
        # The 18-hole rating is what's displayed, we'll use half for 9-hole calculation
        # Actually, for 9-hole courses played twice, front9 = back9 = the same 9 holes
        course_rating_9 = tee.course_rating_18 / 2
        slope_rating_9 = tee.slope_rating_18  # Slope doesn't change

        sql_parts.append(f"""insert into public."teeInfo" (
    "courseId", name, gender,
    "courseRating18", "slopeRating18",
    "courseRatingFront9", "slopeRatingFront9",
    "courseRatingBack9", "slopeRatingBack9",
    "outPar", "inPar", "totalPar",
    "outDistance", "inDistance", "totalDistance",
    "distanceMeasurement", "approvalStatus"
)
values (
    @course_id, '{tee.name}', '{tee.gender}',
    {tee.course_rating_18}, {tee.slope_rating_18},
    {course_rating_9:.1f}, {slope_rating_9},
    {course_rating_9:.1f}, {slope_rating_9},
    {out_par}, {in_par}, {total_par},
    {out_distance}, {in_distance}, {total_distance},
    'yards', 'approved'
)
returning id;""")
        sql_parts.append("")

    # Insert holes for each tee
    sql_parts.append("-- Insert holes")
    sql_parts.append("-- NOTE: Replace @tee_id_X with the returned ids from teeInfo inserts")
    sql_parts.append("")

    tee_counter = 1
    for tee in course.tees:
        handicaps = course.handicaps_m if tee.gender == 'M' else course.handicaps_w

        sql_parts.append(f"-- Holes for {tee.name} ({tee.gender})")
        for hole_num in range(1, len(tee.distances) + 1):
            idx = hole_num - 1
            sql_parts.append(f"""insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
values (@tee_id_{tee_counter}, {hole_num}, {course.pars[idx]}, {tee.distances[idx]}, {handicaps[idx]});""")

        sql_parts.append("")
        tee_counter += 1

    return '\n'.join(sql_parts)


def escape_sql_string(value: str) -> str:
    """Escape single quotes for SQL by doubling them."""
    if value is None:
        return None
    return value.replace("'", "''")


def generate_sql_with_variables(course: CourseData) -> str:
    """Generate SQL with DO block for automatic ID handling."""
    sql_parts = []

    # Escape all string values for SQL
    name_escaped = escape_sql_string(course.name)
    city_escaped = escape_sql_string(course.city)
    country_escaped = escape_sql_string(course.country)
    website_escaped = escape_sql_string(course.website) if course.website else None

    # Header
    sql_parts.append(f"-- Course: {course.name}")
    sql_parts.append(f"-- Location: {course.city}, {course.country}")
    sql_parts.append(f"-- Type: {'9-hole' if course.is_9_hole else '18-hole'} course")
    sql_parts.append("-- Generated by parse_scorecard.py")
    sql_parts.append("")

    website_value = f"'{website_escaped}'" if website_escaped else "null"

    # Use the parsed out_par and in_par from the course data
    out_par = course.out_par
    in_par = course.in_par
    total_par = out_par + in_par

    sql_parts.append("do $$")
    sql_parts.append("declare")
    sql_parts.append("    v_course_id integer;")

    # Declare tee ID variables
    for i, tee in enumerate(course.tees, 1):
        sql_parts.append(f"    v_tee_id_{i} integer;")

    sql_parts.append("begin")
    sql_parts.append("")

    # Insert course
    sql_parts.append("    -- Insert course")
    sql_parts.append(f"""    insert into public.course (name, city, country, website, "approvalStatus")
    values ('{name_escaped}', '{city_escaped}', '{country_escaped}', {website_value}, 'approved')
    returning id into v_course_id;""")
    sql_parts.append("")

    # Insert tees
    for i, tee in enumerate(course.tees, 1):
        if course.is_9_hole:
            # 9-hole: front and back are the same
            out_distance = sum(tee.distances)
            in_distance = out_distance
            total_distance = out_distance * 2
            # For 9-hole, we estimate 9-hole rating as half of 18-hole
            course_rating_9 = tee.course_rating_18 / 2
            slope_rating_9 = tee.slope_rating_18
        else:
            # 18-hole: calculate front 9 and back 9 separately
            out_distance = sum(tee.distances[:9])
            in_distance = sum(tee.distances[9:18])
            total_distance = out_distance + in_distance
            # For 18-hole, we estimate 9-hole ratings as half of 18-hole
            # (GolfPass doesn't provide separate 9-hole ratings)
            course_rating_9 = tee.course_rating_18 / 2
            slope_rating_9 = tee.slope_rating_18

        tee_name_escaped = escape_sql_string(tee.name)
        sql_parts.append(f"    -- Insert {tee.name} tee ({tee.gender})")
        sql_parts.append(f"""    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus"
    )
    values (
        v_course_id, '{tee_name_escaped}', '{tee.gender}',
        {tee.course_rating_18}, {tee.slope_rating_18},
        {course_rating_9:.1f}, {slope_rating_9},
        {course_rating_9:.1f}, {slope_rating_9},
        {out_par}, {in_par}, {total_par},
        {out_distance}, {in_distance}, {total_distance},
        '{course.distance_measurement}', 'approved'
    )
    returning id into v_tee_id_{i};""")
        sql_parts.append("")

    # Insert holes
    tee_counter = 1
    for tee in course.tees:
        handicaps = course.handicaps_m if tee.gender == 'mens' else course.handicaps_w

        sql_parts.append(f"    -- Holes for {tee.name} ({tee.gender})")

        if course.is_9_hole:
            # For 9-hole courses, create 18 holes by duplicating front 9 to back 9
            # Handicaps are already converted to 18-hole format
            for hole_num in range(1, 19):
                idx = (hole_num - 1) % 9  # 0-8 for both front and back 9
                hcp = handicaps[hole_num - 1] if hole_num - 1 < len(handicaps) else 1
                sql_parts.append(f"""    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_{tee_counter}, {hole_num}, {course.pars[idx]}, {tee.distances[idx]}, {hcp});""")
        else:
            # For 18-hole courses, use the data as-is
            for hole_num in range(1, 19):
                idx = hole_num - 1
                hcp = handicaps[idx] if idx < len(handicaps) else 1
                sql_parts.append(f"""    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id_{tee_counter}, {hole_num}, {course.pars[idx]}, {tee.distances[idx]}, {hcp});""")

        sql_parts.append("")
        tee_counter += 1

    sql_parts.append("    raise notice 'Successfully inserted course: %', v_course_id;")
    sql_parts.append("end $$;")

    return '\n'.join(sql_parts)


def main():
    print("=" * 60)
    print("Golf Scorecard to SQL Converter")
    print("=" * 60)
    print()

    # Get course info
    print("Enter course information:")
    course_name = input("  Course name: ").strip()
    city = input("  City: ").strip()
    country = input("  Country (default: USA): ").strip() or "USA"
    website = input("  Website (optional): ").strip() or None

    # Get distance measurement
    distance_input = input("  Distance unit (m/y, default: m): ").strip().lower() or "m"
    distance_measurement = "meters" if distance_input == "m" else "yards"

    print()
    print("Paste the scorecard data below (press Enter twice when done):")
    print("-" * 40)

    lines = []
    empty_count = 0
    while True:
        try:
            line = input()
            if line == "":
                empty_count += 1
                if empty_count >= 2:
                    break
            else:
                empty_count = 0
                lines.append(line)
        except EOFError:
            break

    scorecard_text = '\n'.join(lines)

    if not scorecard_text.strip():
        print("Error: No scorecard data provided")
        sys.exit(1)

    # Parse the scorecard
    try:
        tees, pars, handicaps_m, handicaps_w, is_9_hole, out_par, in_par = parse_scorecard(scorecard_text)
    except Exception as e:
        print(f"Error parsing scorecard: {e}")
        sys.exit(1)

    if not tees:
        print("Error: Could not parse any tee information")
        sys.exit(1)

    if not pars:
        print("Error: Could not parse par information")
        sys.exit(1)

    # Create course data
    course = CourseData(
        name=course_name,
        city=city,
        country=country,
        website=website,
        tees=tees,
        pars=pars,
        handicaps_m=handicaps_m,
        handicaps_w=handicaps_w,
        is_9_hole=is_9_hole,
        out_par=out_par,
        in_par=in_par,
        distance_measurement=distance_measurement
    )

    # Generate SQL
    sql = generate_sql_with_variables(course)

    print()
    print("=" * 60)
    print("Generated SQL:")
    print("=" * 60)
    print()
    print(sql)
    print()

    # Optionally save to file
    save = input("Save to file? (y/n): ").strip().lower()
    if save == 'y':
        filename = f"scripts/sql/{course_name.lower().replace(' ', '_')}.sql"
        import os
        os.makedirs("scripts/sql", exist_ok=True)
        with open(filename, 'w') as f:
            f.write(sql)
        print(f"Saved to {filename}")

    print()
    print("Summary:")
    print(f"  - Course: {course_name}")
    print(f"  - Type: {'9-hole' if is_9_hole else '18-hole'}")
    print(f"  - Tees: {len(tees)} (including gender variants)")
    if is_9_hole:
        print(f"  - Par: {out_par} per 9 holes ({out_par * 2} for 18)")
    else:
        print(f"  - Par: {out_par} out / {in_par} in = {out_par + in_par} total")
    print(f"  - Holes per tee: {len(pars)}")


if __name__ == "__main__":
    main()
