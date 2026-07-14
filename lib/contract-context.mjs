const normalizeContractNote = (note) =>
  String(note ?? "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

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
