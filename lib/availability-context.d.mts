export type AvailabilityRow = {
  xMLBAMID?: string | number;
  mlbamid?: string | number;
  season?: string | number;
  status?: string | null;
  injurySurgery?: string | null;
  latestUpdate?: string | null;
  eligibledate?: string | null;
  returndate?: string | null;
};

export function availabilityRiskAdjustment(record: AvailabilityRow): number;
export function activeAvailabilityByMlbId(
  rows: AvailabilityRow[],
  season: number,
): Map<string, AvailabilityRow>;
