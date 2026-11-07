/** Public, deliberately broad guidance. Never uses a seed or a private asking price. */
export function expectedMarket(row) {
  const reference = row.marketForecast?.reference;
  const publicForecasts = (row.marketForecast?.forecasts ?? []).filter(f => Number.isFinite(f.aav) && f.aav > 0);
  if (reference?.aav > 0 && !publicForecasts.length) publicForecasts.push(reference);
  const publicMarket = publicForecasts.length > 0;
  const annual = reference?.aav ?? row.aav;
  const term = Math.max(1, Math.round(reference?.years ?? row.years ?? 1));
  if (!Number.isFinite(annual) || annual <= 0) return { lowYears: 1, highYears: 2, lowAav: null, highAav: null, basis: 'Limited market information' };
  if (annual < 1) return { lowYears: 1, highYears: 1, lowAav: .8, highAav: 2, basis: 'Minimum-salary / depth market' };
  const step = annual >= 25 ? 5 : annual >= 6 ? 2 : 1;
  const baseLow = publicMarket ? Math.min(...publicForecasts.map(f => f.aav), annual) : annual;
  const baseHigh = publicMarket ? Math.max(...publicForecasts.map(f => f.aav), annual) : annual;
  const lowAav = Math.max(1, Math.floor(baseLow * (publicMarket ? .8 : .65) / step) * step);
  const highAav = Math.max(lowAav + step, Math.ceil(baseHigh * (publicMarket ? 1.2 : 1.4) / step) * step);
  return { lowYears: Math.max(1, term - 1), highYears: Math.min(13, term + (publicMarket ? 1 : 2)), lowAav, highAav, basis: publicMarket ? 'Based on public contract forecasts' : 'Broad model-based guide; limited public forecasts' };
}

export function prospectBrief(player) {
  return [player.pos, Number.isFinite(player.age) ? `age ${player.age}` : null, player.fv != null ? `${player.fv} FV` : null, player.eta != null ? `ETA ${player.eta}` : null].filter(Boolean).join(' · ');
}
