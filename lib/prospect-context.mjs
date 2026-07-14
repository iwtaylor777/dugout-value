export function normalizeProspectRisk(value) {
  const label = String(value ?? "").trim().toLowerCase();
  if (label.startsWith("low")) return "Low";
  if (label.startsWith("high")) return "High";
  return "Med";
}

export function prospectRosterContext(row, baseYear) {
  const eta = Number(row.cETA || row.ETA_Current) || baseYear + 1;
  const optionYears = String(row.options ?? "").trim();
  if (optionYears && Number.isFinite(Number(optionYears))) {
    return eta > baseYear ? "on40" : "none";
  }

  const signedYear = Number(row.Signed_Yr);
  const currentAge = Number(row.Age);
  if (!signedYear || !Number.isFinite(currentAge)) return "none";
  const birthSerial = Number(row.BirthDate);
  let ageAtSigning = currentAge - (baseYear - signedYear);
  if (Number.isFinite(birthSerial) && birthSerial > 0) {
    const birthDate = new Date(
      Date.UTC(1899, 11, 30) + birthSerial * 24 * 60 * 60 * 1000,
    );
    const signingMonth = row.Signed_Mkt === "Intl15" ? 0 : 6;
    const signingDay = row.Signed_Mkt === "J2" ? 2 : 15;
    const signingDate = new Date(
      Date.UTC(signedYear, signingMonth, signingDay),
    );
    ageAtSigning = signedYear - birthDate.getUTCFullYear();
    if (
      signingDate.getUTCMonth() < birthDate.getUTCMonth() ||
      (signingDate.getUTCMonth() === birthDate.getUTCMonth() &&
        signingDate.getUTCDate() < birthDate.getUTCDate())
    )
      ageAtSigning -= 1;
  }
  const protectedSeasons = ageAtSigning <= 18 ? 5 : 4;
  const completedSeasons = baseYear - signedYear;
  if (completedSeasons >= protectedSeasons) return "crunch";
  if (completedSeasons === protectedSeasons - 1 && eta > baseYear)
    return "rule5";
  return "none";
}
