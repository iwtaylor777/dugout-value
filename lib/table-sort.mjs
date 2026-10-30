// Missing values stay last in either direction; numeric values are never sorted
// by their formatted labels (e.g. "$9M" or "Minimum").
export function compareTableValues(a, b, direction = "descending") {
  const missing = (value) => value == null || (typeof value === "number" && !Number.isFinite(value));
  if (missing(a)) return missing(b) ? 0 : 1;
  if (missing(b)) return -1;
  const result = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "en", { sensitivity: "base" });
  return result === 0 ? 0 : direction === "ascending" ? result : -result;
}
