# Dugout Value interaction audit

This is the working checklist for the July 2026 interaction pass. Each action is evaluated on discoverability, feedback, correctness, keyboard/touch behavior, and whether the result matches the user’s likely intent.

| Area | User action | Before this pass | Target / acceptance check |
| --- | --- | --- | --- |
| Header | Click the wordmark | Works; returns to the top | Preserve native anchor behavior and visible focus |
| Header | Open Method | Reveals content below the fold but leaves the user in place | Reveal Method and scroll it into view |
| Header | Load example | Restores data but can leave the user on Rankings | Restore example, switch to Trade Builder, close stray menus |
| Header | Start a new trade | Clears the packages | Also reset searches, selection, panels, and return to Trade Builder |
| Navigation | Switch Trade Builder / Rankings | Works | Preserve each view’s useful filter/package state; support visible focus |
| Assumptions | Open or close model settings | Works, but terminology is finance-heavy | Use baseball language and make the active valuation lens obvious |
| Assumptions | Edit market inputs | Recalculates immediately | Keep immediate feedback; guard against misleading labels and invalid negative values |
| Assumptions | Choose neutral or win-now timing | Not available as an intuitive action | Add a clear lens; neutral timing is the default |
| Team package | Change a team | Clears that side, but also clears an unrelated selected player | Clear only the changed package and preserve the other side’s selection |
| Team package | Focus player search | Opens high-value suggestions | Keep suggestions ranked and scoped to the selected organization |
| Team package | Type a partial name / position / FV | Works | Keep partial matching and a useful no-results message |
| Team package | Navigate search with keyboard | Enter works only for the first result | Add Up/Down highlighting, Enter selection, and Escape dismissal |
| Team package | Click a search result | Works | Add the player once, select them, close the menu, and clear the query |
| Team package | Add a custom MLB player | Works | Select the new player and expose editable assumptions |
| Team package | Add a custom prospect | Works | Select the new prospect and expose scouting/roster assumptions |
| Team package | Open a player card | Works | On narrow screens, bring the editor into view after selection |
| Team package | Remove a player | Leaves an empty editor if the selected player is removed | Select the next available player when possible |
| Trade center | Swap teams | Swaps teams and packages | Also clear stale search menus/queries |
| Trade center | Read the verdict | Works | Keep range overlap as the primary signal; avoid false precision |
| Control years | Read yearly value | Always visible | Preserve; keep empty state useful |
| Player editor | Edit custom identity | Works | Preserve; official records remain non-editable |
| Player editor | Change rookie value basis | Works | Preserve projection/FV/blend choices |
| Player editor | Change risk | Works | Preserve immediate range update |
| Player editor | Add/edit a control year | Works | Keep salary-mode behavior and calculated surplus readable |
| Prospect editor | Change FV, type, ETA, or scout adjustment | Works | Preserve immediate feedback |
| Prospect editor | Account for Rule 5 / 40-man pressure | Missing | Add a transparent context adjustment without pretending it is intrinsic talent |
| Rankings | Search, filter team, filter player type | Works | Preserve filters and stable model ordering |
| Rankings | Open a ranked player | Switches views but can feel disconnected | Label clearly and bring the editor into view on narrow screens |
| Method | Close Method | Works | Preserve |
| Method | Open source links | Works in a new tab | Preserve source labeling and safe link behavior |
| Responsive | Use all primary actions on a phone | Layout adapts | Keep controls at least comfortably tappable and avoid clipped search results |

## Model decisions for this pass

- **Time preference:** future wins are not cash flows. Default to a neutral, zero-discount baseball valuation. Keep an optional win-now behavior lens because actual decision makers can heavily prefer present value.
- **Roster burden:** replace one universal free-WAR hurdle with a role-aware opportunity cost: 0.5 WAR for position players/starters and 0.2 WAR for relievers by default.
- **Nonlinear win pricing:** retain the user’s $12M base rate and add a restrained 30% premium only for WAR above the first two net WAR. This reflects the recent star premium without turning the model into a black box.
- **Relievers:** FanGraphs pitcher WAR already contains a leverage multiplier. Do not apply another large automatic adjustment. Expose an optional bullpen-market premium, defaulting to zero.
- **Roster pressure for prospects:** treat Rule 5/40-man pressure as context, not a scouting-grade downgrade. Provide explicit, editable scenarios rather than inventing eligibility for players whose source data does not establish it.

## Loop results

- **Pass 1 — intent and feedback:** found and corrected the Method navigation, example/reset state, cross-team editor clearing, selected-player removal, stale swap searches, narrow-screen editor handoff, and incomplete search keyboard behavior.
- **Pass 2 — model language and behavior:** replaced the finance-default discount with neutral timing plus an optional win-now lens; replaced universal free WAR with role-aware roster burden; added transparent star and reliever market controls; added prospect roster-pressure context.
- **Pass 3 — render and regression checks:** the complete server-rendered action surface, always-visible control-year view, rankings, search contract, model defaults, and navigation hooks pass the project checks in both hosting formats.
- **Deliberate boundary:** automatic Rule 5 labeling is not asserted when the source snapshot does not establish eligibility. The editor exposes the context now; the data refresh records a neutral default until a reliable roster-status field is available.
