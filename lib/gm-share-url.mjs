// Fragments stay in the browser. A full market ledger must not become a huge
// HTTP request URL; retain reading support for earlier query-string saves.
export function readGmSaveUrl(value) {
  const url = new URL(value);
  return new URLSearchParams(url.hash.slice(1)).get('s') ?? url.searchParams.get('s');
}

export function createGmShareUrl(value, save) {
  const url = new URL(value);
  url.search = '';
  url.hash = new URLSearchParams({ s: save }).toString();
  return url.toString();
}
