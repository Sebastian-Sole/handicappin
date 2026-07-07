/**
 * GPS seam for live rounds — types only, deliberately no expo-location
 * dependency and no DB columns (geo capture was rejected for ingestion on
 * 2026-07-03; this seam is where it plugs in if that ever changes).
 *
 * Future GPS work = implement a real DistanceProvider (expo-location) and
 * pass it where nullDistanceProvider is used today; SCORE_SET events start
 * carrying a GeoStamp. Nothing else moves.
 */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/** A point observed at a moment in time (e.g. where a score was entered). */
export interface GeoStamp extends GeoPoint {
  accuracyM?: number;
  at: string;
}

/** Known geometry for a hole — green positions, once course data exists. */
export interface HoleGeo {
  green?: {
    front?: GeoPoint;
    center: GeoPoint;
    back?: GeoPoint;
  };
}

export interface DistanceInfo {
  meters: number;
  target: "front" | "center" | "back";
}

export interface DistanceProvider {
  getDistanceToHole(holeNumber: number): Promise<DistanceInfo | null>;
}

/** The only provider that exists today: no course geo data, no distance. */
export const nullDistanceProvider: DistanceProvider = {
  getDistanceToHole: async () => null,
};
