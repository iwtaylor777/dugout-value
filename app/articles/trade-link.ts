import { initialSettings } from "../../lib/value-model.mjs";
import { encodeTradeState } from "../../lib/trade-share.mjs";

/**
 * A link that opens the trade builder with two packages already loaded, using the site's
 * default settings. Built from the live defaults so an article link and the tool agree.
 * `snapshot` is left out on purpose: the tool only shows a "different snapshot" warning
 * when a saved link carries one.
 */
export function tradeLink(leftTeam: string, leftIds: string[], rightTeam: string, rightIds: string[]) {
  const payload = encodeTradeState({
    v: 1,
    leftTeam,
    rightTeam,
    leftIds,
    rightIds,
    leftCash: 0,
    rightCash: 0,
    settings: { ...initialSettings },
    overrides: [],
  });
  return `/tools/trade?trade=${payload}`;
}
