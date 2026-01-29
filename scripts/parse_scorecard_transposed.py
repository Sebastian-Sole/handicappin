#!/usr/bin/env python3
"""
Parse golf scorecard data in transposed format (holes as rows, tees as columns).

Usage:
    python scripts/parse_scorecard_transposed.py

Format expected:
    Hull    51    47    43    39    33    Hcp    Par
    1       276   259   234   227   170   9      4
    2       147   136   114   108   104   17     3
    ...
    UT      2570  2415  2203  2069  1642         35
    10      158   147   122   114   90    14     3
    ...
    INN     2452  2329  2102  1944  1680         35
    SUM     5022  4744  4305  4013  3322         70

Then for each tee, provide:
    48 (Gul), m
    CR/Slope:
    69,1/130
"""

import re
import sys
import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class HoleData:
    hole_number: int
    distances: dict[str, int]  # tee_name -> distance
    hcp: int
    par: int


@dataclass
class TeeMetadata:
    name: str
    gender: str  # "mens" or "ladies"
    course_rating_18: float
    slope_rating_18: int


@dataclass
class CourseData:
    name: str
    city: str
    country: str
    website: Optional[str]
    distance_measurement: str
    holes: list[HoleData]
    tee_names: list[str]  # Column names from header


def escape_sql_string(value: str) -> str:
    """Escape single quotes for SQL by doubling them."""
    if value is None:
        return None
    return value.replace("'", "''")


def convert_9_to_18_hole_handicaps(nine_hole_hcps: list[int]) -> list[int]:
    """
    Convert 9-hole handicaps to 18-hole handicaps.
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


def parse_transposed_scorecard(scorecard_text: str) -> tuple[list[HoleData], list[str], bool]:
    """
    Parse the transposed scorecard format.
    Returns: (holes, tee_names, is_9_hole)
    """
    lines = [line.strip() for line in scorecard_text.strip().split('\n') if line.strip()]

    if not lines:
        raise ValueError("No scorecard data provided")

    # Parse header to get tee names
    header = lines[0]

    # Check if tab-delimited (supports tee names with spaces)
    use_tabs = '\t' in header
    if use_tabs:
        header_parts = [p.strip() for p in header.split('\t') if p.strip()]
    else:
        header_parts = header.split()

    # First column is "Hull" or "Hole", last two are "Hcp" and "Par"
    # Everything in between are tee names
    tee_names = []
    for i, part in enumerate(header_parts):
        if i == 0:  # Skip "Hull" / "Hole"
            continue
        if part.lower() in ['hcp', 'handicap', 'par']:
            break
        tee_names.append(part)

    holes = []
    is_9_hole = True

    for line in lines[1:]:
        if use_tabs:
            parts = [p.strip() for p in line.split('\t') if p.strip()]
        else:
            parts = line.split()
        if not parts:
            continue

        first_col = parts[0].upper()

        # Skip summary rows
        if first_col in ['UT', 'OUT', 'INN', 'IN', 'SUM', 'TOTAL']:
            continue

        # Try to parse as hole number
        try:
            hole_number = int(first_col)
        except ValueError:
            continue

        if hole_number > 9:
            is_9_hole = False

        # Extract distances for each tee
        distances = {}
        for i, tee_name in enumerate(tee_names):
            if i + 1 < len(parts):
                try:
                    distances[tee_name] = int(parts[i + 1])
                except ValueError:
                    distances[tee_name] = 0

        # Hcp is after all tee distances
        hcp_idx = len(tee_names) + 1
        par_idx = len(tee_names) + 2

        try:
            hcp = int(parts[hcp_idx]) if hcp_idx < len(parts) else 1
        except ValueError:
            hcp = 1

        try:
            par = int(parts[par_idx]) if par_idx < len(parts) else 4
        except ValueError:
            par = 4

        holes.append(HoleData(
            hole_number=hole_number,
            distances=distances,
            hcp=hcp,
            par=par
        ))

    # Sort holes by number
    holes.sort(key=lambda h: h.hole_number)

    return holes, tee_names, is_9_hole


def parse_tee_metadata(tee_input: str, cr_slope_input: str) -> TeeMetadata:
    """
    Parse tee metadata from user input.
    Format: "<tee_name>, <m/w>" e.g. "48 (Gul), m" or "Red, w"
    CR/Slope: "69,1/130" or "69.1/130"
    """
    # Parse tee line - split on last comma to get tee name and gender
    parts = tee_input.rsplit(',', 1)

    if len(parts) == 2:
        tee_name = parts[0].strip()
        gender_raw = parts[1].strip().lower()
    else:
        # No comma - assume it's just the tee name, default to mens
        tee_name = tee_input.strip()
        gender_raw = 'm'

    if not tee_name:
        raise ValueError("Could not parse tee name from input")

    gender = "ladies" if gender_raw in ['w', 'f', 'l', 'ladies', 'women', 'female'] else "mens"

    # Parse CR/Slope - handle both comma and dot as decimal separator
    cr_slope_clean = cr_slope_input.strip().replace(',', '.')
    cr_slope_match = re.match(r'([\d.]+)\s*/\s*(\d+)', cr_slope_clean)

    if not cr_slope_match:
        raise ValueError(f"Could not parse CR/Slope from: {cr_slope_input}")

    course_rating = float(cr_slope_match.group(1))
    slope_rating = int(cr_slope_match.group(2))

    return TeeMetadata(
        name=tee_name,
        gender=gender,
        course_rating_18=course_rating,
        slope_rating_18=slope_rating
    )


def generate_sql_for_tee(
    course: CourseData,
    tee: TeeMetadata,
    holes: list[HoleData],
    is_9_hole: bool
) -> str:
    """Generate SQL for a single tee."""
    sql_parts = []

    # Escape strings
    tee_name_escaped = escape_sql_string(tee.name)

    # Calculate distances
    if is_9_hole:
        out_distance = sum(h.distances.get(tee.name, 0) for h in holes[:9])
        in_distance = out_distance
        total_distance = out_distance * 2
    else:
        out_distance = sum(h.distances.get(tee.name, 0) for h in holes[:9])
        in_distance = sum(h.distances.get(tee.name, 0) for h in holes[9:18])
        total_distance = out_distance + in_distance

    # Calculate pars
    if is_9_hole:
        out_par = sum(h.par for h in holes[:9])
        in_par = out_par
        total_par = out_par * 2
    else:
        out_par = sum(h.par for h in holes[:9])
        in_par = sum(h.par for h in holes[9:18])
        total_par = out_par + in_par

    # 9-hole ratings (estimate as half of 18-hole)
    course_rating_9 = tee.course_rating_18 / 2

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
        {course_rating_9:.1f}, {tee.slope_rating_18},
        {course_rating_9:.1f}, {tee.slope_rating_18},
        {out_par}, {in_par}, {total_par},
        {out_distance}, {in_distance}, {total_distance},
        '{course.distance_measurement}', 'approved'
    )
    returning id into v_tee_id;""")
    sql_parts.append("")

    # Get handicaps and convert if 9-hole
    if is_9_hole:
        nine_hole_hcps = [h.hcp for h in holes[:9]]
        handicaps = convert_9_to_18_hole_handicaps(nine_hole_hcps)
    else:
        handicaps = [h.hcp for h in holes[:18]]

    # Insert holes
    sql_parts.append(f"    -- Holes for {tee.name} ({tee.gender})")

    if is_9_hole:
        # Duplicate 9 holes to 18
        for hole_num in range(1, 19):
            idx = (hole_num - 1) % 9
            hole = holes[idx]
            distance = hole.distances.get(tee.name, 0)
            par = hole.par
            hcp = handicaps[hole_num - 1]
            sql_parts.append(f"""    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, {hole_num}, {par}, {distance}, {hcp});""")
    else:
        for hole_num in range(1, 19):
            idx = hole_num - 1
            if idx < len(holes):
                hole = holes[idx]
                distance = hole.distances.get(tee.name, 0)
                par = hole.par
                hcp = handicaps[idx] if idx < len(handicaps) else 1
            else:
                distance = 0
                par = 4
                hcp = hole_num
            sql_parts.append(f"""    insert into public.hole ("teeId", "holeNumber", par, distance, hcp)
    values (v_tee_id, {hole_num}, {par}, {distance}, {hcp});""")

    sql_parts.append("")

    return '\n'.join(sql_parts)


def generate_full_sql(
    course: CourseData,
    tees: list[TeeMetadata],
    holes: list[HoleData],
    is_9_hole: bool
) -> str:
    """Generate complete SQL with all tees."""
    sql_parts = []

    # Escape strings
    name_escaped = escape_sql_string(course.name)
    city_escaped = escape_sql_string(course.city)
    country_escaped = escape_sql_string(course.country)
    website_escaped = escape_sql_string(course.website) if course.website else None
    website_value = f"'{website_escaped}'" if website_escaped else "null"

    # Header
    sql_parts.append(f"-- Course: {course.name}")
    sql_parts.append(f"-- Location: {course.city}, {course.country}")
    sql_parts.append(f"-- Type: {'9-hole' if is_9_hole else '18-hole'} course")
    sql_parts.append(f"-- Tees: {', '.join(t.name + ' (' + t.gender + ')' for t in tees)}")
    sql_parts.append("-- Generated by parse_scorecard_transposed.py")
    sql_parts.append("")

    sql_parts.append("do $$")
    sql_parts.append("declare")
    sql_parts.append("    v_course_id integer;")
    sql_parts.append("    v_tee_id integer;")
    sql_parts.append("begin")
    sql_parts.append("")

    # Insert course
    sql_parts.append("    -- Insert course")
    sql_parts.append(f"""    insert into public.course (name, city, country, website, "approvalStatus")
    values ('{name_escaped}', '{city_escaped}', '{country_escaped}', {website_value}, 'approved')
    returning id into v_course_id;""")
    sql_parts.append("")

    # Insert each tee
    for tee in tees:
        tee_sql = generate_sql_for_tee(course, tee, holes, is_9_hole)
        sql_parts.append(tee_sql)

    sql_parts.append("    raise notice 'Successfully inserted course: %', v_course_id;")
    sql_parts.append("end $$;")

    return '\n'.join(sql_parts)


def main():
    print("=" * 60)
    print("Golf Scorecard to SQL Converter (Transposed Format)")
    print("=" * 60)
    print()

    # Get course info
    print("Enter course information:")
    course_name = input("  Course name: ").strip()
    city = input("  City: ").strip()
    country = input("  Country (default: Norway): ").strip() or "Norway"
    website = input("  Website (optional): ").strip() or None

    # Get distance measurement
    distance_input = input("  Distance unit (m/y, default: m): ").strip().lower() or "m"
    distance_measurement = "meters" if distance_input == "m" else "yards"

    print()
    print("Paste the scorecard data below.")
    print("Format: Hull/Hole column, tee columns, Hcp column, Par column")
    print("Press Enter twice when done:")
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
        holes, tee_names, is_9_hole = parse_transposed_scorecard(scorecard_text)
    except Exception as e:
        print(f"Error parsing scorecard: {e}")
        sys.exit(1)

    if not holes:
        print("Error: Could not parse any hole information")
        sys.exit(1)

    print()
    print(f"Parsed {len(holes)} holes with tee columns: {', '.join(tee_names)}")
    print(f"Course type: {'9-hole' if is_9_hole else '18-hole'}")
    print()

    # Create course data
    course = CourseData(
        name=course_name,
        city=city,
        country=country,
        website=website,
        distance_measurement=distance_measurement,
        holes=holes,
        tee_names=tee_names
    )

    # Collect tee metadata
    tees = []
    print("=" * 60)
    print("Now enter tee information for each tee you want to add.")
    print("Format: <tee name>, <m/w>  (e.g. '48 (Gul), m' or 'Red, w')")
    print("Then CR/Slope on next line: 69,1/130")
    print("Enter 'done' when finished adding tees.")
    print("=" * 60)
    print()

    while True:
        print(f"Available tee columns: {', '.join(tee_names)}")
        tee_line = input("Tee (or 'done'): ").strip()

        if tee_line.lower() == 'done':
            break

        if not tee_line:
            continue

        cr_slope_line = input("CR/Slope: ").strip()

        try:
            tee = parse_tee_metadata(tee_line, cr_slope_line)

            # Verify tee name exists in scorecard
            if tee.name not in tee_names:
                print(f"Warning: Tee '{tee.name}' not found in scorecard columns: {tee_names}")
                confirm = input("Continue anyway? (y/n): ").strip().lower()
                if confirm != 'y':
                    continue

            tees.append(tee)
            print(f"Added: {tee.name} ({tee.gender}) - CR: {tee.course_rating_18}, Slope: {tee.slope_rating_18}")
            print()
        except Exception as e:
            print(f"Error parsing tee info: {e}")
            print("Please try again.")
            print()

    if not tees:
        print("Error: No tees added")
        sys.exit(1)

    # Generate SQL
    sql = generate_full_sql(course, tees, holes, is_9_hole)

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
        os.makedirs("scripts/sql", exist_ok=True)
        with open(filename, 'w') as f:
            f.write(sql)
        print(f"Saved to {filename}")

    print()
    print("Summary:")
    print(f"  - Course: {course_name}")
    print(f"  - Type: {'9-hole' if is_9_hole else '18-hole'}")
    print(f"  - Tees added: {len(tees)}")
    for t in tees:
        print(f"    - {t.name} ({t.gender}): CR {t.course_rating_18}, Slope {t.slope_rating_18}")
    print(f"  - Holes: {len(holes)} (stored as 18)")


if __name__ == "__main__":
    main()
