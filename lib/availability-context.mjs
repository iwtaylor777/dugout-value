const activeStatuses = new Set([
  "7-Day IL",
  "10-Day IL",
  "15-Day IL",
  "60-Day IL",
]);

export function availabilityRiskAdjustment(record) {
  const status = String(record?.status ?? "");
  const statusPoints = {
    "7-Day IL": 5,
    "10-Day IL": 4,
    "15-Day IL": 5,
    "60-Day IL": 8,
  }[status];
  if (!statusPoints) return 0;

  const context = `${record?.injurySurgery ?? ""} ${record?.latestUpdate ?? ""}`;
  const severe = /out for (?:the )?20\d{2} season|tommy john|torn (?:acl|ucl|labrum|rotator)|questionable for 20\d{2} season/i.test(
    context,
  );
  const uncertain = /surgery|no timetable|shut down/i.test(context);
  return Math.min(14, statusPoints + (severe ? 6 : uncertain ? 3 : 0));
}

export function activeAvailabilityByMlbId(rows, season) {
  const active = new Map();
  for (const row of rows ?? []) {
    const id = String(row?.xMLBAMID || row?.mlbamid || "");
    if (
      !id ||
      Number(row?.season) !== Number(season) ||
      !activeStatuses.has(String(row?.status))
    )
      continue;
    active.set(id, row);
  }
  return active;
}
