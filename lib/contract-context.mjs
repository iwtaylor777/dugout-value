const normalizeContractNote = (note) =>
  String(note ?? "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Verified primary-source exceptions when RosterResource's NoTradeNotes field
// is blank. Keep this list small; the feed remains the default source.
const verifiedTradeProtection = Object.freeze({
  "596019": "partial", // Francisco Lindor — MLB.com contract report
  "605141": "full", // Mookie Betts — current 10-and-5 rights
  "608070": "full", // José Ramírez — MLB.com 2026 extension report
  "663728": "full", // Cal Raleigh — MLB.com extension report
});

export function tradeProtectionFromNote(note) {
  const normalized = normalizeContractNote(note);
  if (!normalized) return "none";
  if (
    /\b(?:no|without) (?:a )?(?:no-trade clause|trade protection)\b/.test(
      normalized,
    )
  )
    return "none";
  if (
    /\bfull (?:no-trade|trade protection|ntc)\b/.test(normalized) ||
    /\bno-trade (?:clause )?(?:is )?full\b/.test(normalized) ||
    /\bcomplete no-trade\b/.test(normalized)
  )
    return "full";
  if (
    /\b(?:partial|limited) no-trade\b/.test(normalized) ||
    /\b\d{1,2}-team no-trade\b/.test(normalized) ||
    /\bno-trade list\b/.test(normalized) ||
    /\b(?:no-trade|ntc|trade protection)\b/.test(normalized)
  )
    return "partial";
  return "none";
}

export function tradeProtectionForPlayer(mlbamId, note) {
  return (
    verifiedTradeProtection[String(mlbamId)] ??
    tradeProtectionFromNote(note)
  );
}
