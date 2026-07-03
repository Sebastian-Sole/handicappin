import csv
import re
from typing import Dict, List, Tuple

import requests

OUTPUT_FILE = "scotland_golf_courses.csv"

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

QUERIES = [
    """
    [out:json][timeout:300];
    area["ISO3166-2"="GB-SCT"]->.searchArea;
    (
      node["leisure"="golf_course"](area.searchArea);
      way["leisure"="golf_course"](area.searchArea);
      relation["leisure"="golf_course"](area.searchArea);
    );
    out tags center;
    """,
    """
    [out:json][timeout:300];
    area
      ["name"="Scotland"]
      ["boundary"="administrative"]
      ["admin_level"="4"]->.searchArea;
    (
      node["leisure"="golf_course"](area.searchArea);
      way["leisure"="golf_course"](area.searchArea);
      relation["leisure"="golf_course"](area.searchArea);
    );
    out tags center;
    """,
    """
    [out:json][timeout:300];
    (
      node["leisure"="golf_course"](54.55,-8.80,60.95,-0.40);
      way["leisure"="golf_course"](54.55,-8.80,60.95,-0.40);
      relation["leisure"="golf_course"](54.55,-8.80,60.95,-0.40);
    );
    out tags center;
    """,
]


def normalize_website(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""

    if not re.match(r"^https?://", url, flags=re.IGNORECASE):
        url = f"https://{url}"

    return url.rstrip("/")


def pick_website(tags: Dict[str, str]) -> str:
    for key in ("website", "contact:website", "url"):
        value = tags.get(key)
        if value:
            return normalize_website(value)
    return ""


def pick_name(tags: Dict[str, str], *keys: str) -> str:
    for key in keys:
        value = tags.get(key)
        if value:
            return value.strip()
    return ""


def fetch_osm_data() -> List[Dict]:
    last_error = None

    for endpoint in ENDPOINTS:
        for i, query in enumerate(QUERIES, start=1):
            try:
                response = requests.post(
                    endpoint,
                    data={"data": query},
                    headers={
                        "Accept": "application/json",
                        "User-Agent": "scotland-golf-courses/1.0",
                    },
                    timeout=300,
                )
                response.raise_for_status()
                payload = response.json()
                elements = payload.get("elements", [])

                print(
                    f"Endpoint: {endpoint} | Query {i} | "
                    f"Elements: {len(elements)}"
                )

                if elements:
                    return elements
            except Exception as exc:
                last_error = exc
                print(f"Failed: {endpoint} | Query {i} | {exc}")

    raise RuntimeError(f"All Overpass queries failed or returned 0 rows: {last_error}")


def build_rows(elements: List[Dict]) -> List[Tuple[str, str, str]]:
    rows = []

    for element in elements:
        tags = element.get("tags", {})
        if not tags:
            continue

        club_name = pick_name(
            tags,
            "operator",
            "club",
            "brand",
            "name",
            "official_name",
        )
        course_name = pick_name(
            tags,
            "golf:course:name",
            "name",
            "official_name",
            "short_name",
        )
        website = pick_website(tags)

        if not club_name and not course_name:
            continue

        if not club_name:
            club_name = course_name

        if not course_name:
            course_name = club_name

        rows.append((club_name, course_name, website))

    deduped = {}
    for club_name, course_name, website in rows:
        key = (
            club_name.casefold(),
            course_name.casefold(),
            website.casefold(),
        )
        deduped[key] = (club_name, course_name, website)

    clean_rows = list(deduped.values())
    clean_rows.sort(key=lambda row: (row[0].casefold(), row[1].casefold()))
    return clean_rows


def write_csv(rows: List[Tuple[str, str, str]], filename: str) -> None:
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Club Name", "Course Name", "Website"])
        writer.writerows(rows)


def main() -> None:
    elements = fetch_osm_data()
    rows = build_rows(elements)
    write_csv(rows, OUTPUT_FILE)
    print(f"Wrote {len(rows)} rows to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
