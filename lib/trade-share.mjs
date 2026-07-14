const MAX_PAYLOAD_LENGTH = 100_000;

const bytesToBase64Url = (bytes) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export function encodeTradeState(state) {
  const json = JSON.stringify(state);
  const payload = bytesToBase64Url(new TextEncoder().encode(json));
  if (payload.length > MAX_PAYLOAD_LENGTH) {
    throw new RangeError("Trade link is too large");
  }
  return payload;
}

export function decodeTradeState(payload) {
  try {
    if (!payload || payload.length > MAX_PAYLOAD_LENGTH) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === "object" && parsed.v === 1
      ? parsed
      : null;
  } catch {
    return null;
  }
}
