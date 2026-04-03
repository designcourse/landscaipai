// USDA Hardiness Zones in sort order (3a through 10b)
export const ZONE_ORDER = [
  "3a", "3b",
  "4a", "4b",
  "5a", "5b",
  "6a", "6b",
  "7a", "7b",
  "8a", "8b",
  "9a", "9b",
  "10a", "10b",
] as const;

export type HardinessZone = (typeof ZONE_ORDER)[number];

const zoneIndex = new Map<string, number>(ZONE_ORDER.map((z, i) => [z, i]));

/** Returns true if `zone` falls within the range [min, max] inclusive. */
export function isZoneInRange(
  zone: string,
  min: string | null,
  max: string | null
): boolean {
  if (!min || !max) return true; // No zone data = always show (hardscape)
  const zi = zoneIndex.get(zone);
  const lo = zoneIndex.get(min);
  const hi = zoneIndex.get(max);
  if (zi === undefined || lo === undefined || hi === undefined) return true;
  return zi >= lo && zi <= hi;
}

/** Format a zone range for display, e.g. "4a–8b" */
export function formatZoneRange(min: string | null, max: string | null): string {
  if (!min || !max) return "All zones";
  if (min === max) return min.toUpperCase();
  return `${min.toUpperCase()}–${max.toUpperCase()}`;
}
