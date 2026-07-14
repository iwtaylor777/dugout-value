# Dugout Value interaction audit

This is the working checklist for the July 2026 interaction pass. Each action is evaluated on discoverability, feedback, correctness, keyboard/touch behavior, and whether the result matches the user’s likely intent.

| Area | User action | Before this pass | Target / acceptance check |
| --- | --- | --- | --- |
| Header | Click the wordmark | Works; returns to the top | Preserve native anchor behavior and visible focus |
| Header | Open Method | Reveals content below the fold but leaves the user in place | Reveal Method and scroll it into view |
| Header | Load example | Restores data but can leave the user on Rankings | Restore example, switch to Trade Builder, close stray menus, clear cash adjustments, and clear a stale shared-trade token |
| Header | Start a new trade | Clears the packages | Also reset searches, cash, selection, panels, shared-trade state, and return to Trade Builder |
| Navigation | Switch Trade Builder / Rankings | Works | Preserve each view’s useful filter/package state; support visible focus |
| Assumptions | Open or close model settings | Works, but terminology is finance-heavy | Use baseball language and make the active valuation lens obvious |
| Assumptions | Edit market inputs | Recalculates immediately | Keep immediate feedback; guard against misleading labels and invalid negative values |
| Assumptions | Choose neutral or win-now timing | Not available as an intuitive action | Add a clear lens; neutral timing is the default |
| Team package | Change a team | Clears that side, but also clears an unrelated selected player | Clear only the changed package and preserve the other side’s selection |
| Team package | Focus player search | Opens high-value suggestions | Keep suggestions ranked and scoped to the selected organization |
| Team package | Type a partial name / position / FV | Works | Keep partial matching and a useful no-results message |
| Team package | Search for a pitcher by SP/RP | Source data labels every pitcher as “P” | Derive role from projected starts/games; search and display the familiar role |
| Team package | Navigate search with keyboard | Enter works only for the first result | Add Up/Down highlighting, Enter selection, and Escape dismissal |
| Team package | Click a search result | Works | Add the player once, select them, close the menu, and clear the query |
| Team package | Add a custom MLB player | Works | Select the new player and expose editable assumptions |
| Team package | Add a custom prospect | Works | Select the new prospect and expose scouting/roster assumptions |
| Team package | Open a player card | Works | On narrow screens, bring the editor into view after selection |
| Team package | Remove a player | Leaves an empty editor if the selected player is removed | Select the next available player when possible |
| Team package | Add cash or retained salary | Missing | Add a bounded dollar-for-dollar package adjustment, preserve it through swaps and shared links, clear it with the package, and keep it separate from player projection uncertainty |
| Trade center | Swap teams | Swaps teams and packages | Swap cash adjustments with their packages and clear stale search menus/queries |
| Trade center | Copy a trade link / open a shared trade | Missing | Restore both teams, packages, cash adjustments, selected player, model settings, and any custom or edited player assumptions without requiring an account |
| Trade center | Read the verdict | Works | Keep range overlap as the primary signal; avoid false precision |
| Control years | Read yearly value | Always visible | Preserve; keep empty state useful |
| Player editor | Edit custom identity | Works | Preserve; official records remain non-editable |
| Player editor | Change rookie value basis | Works | Preserve projection/FV/blend choices |
| Player editor | Change risk | Works | Preserve immediate range update |
| Player editor | Add/edit a control year | Works | Keep salary-mode behavior and calculated surplus readable |
| Player editor | Read a contract with an opt-out | Later guaranteed years look like unconditional club control | Stop crediting upside after the first opt-out while retaining downside if the player stays |
| Player editor | Compare mutually exclusive contract paths | Complex club/player/mutual branches can be silently combined or reduced to one misleading estimate | Default to the conservative unilateral path; let the user switch one complete branch at a time and immediately update the table, chart, and value |
| Player editor | Review trade protection | Not represented | Surface full and partial no-trade protection in the package, rankings, and editor while keeping consent separate from economic surplus |
| Player editor | Read an injury-conditional option | A conditional club option looks available in every health state | Exclude it from the healthy-player default and expose a clearly labeled condition-met path |
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
- **Opt-outs:** an opt-out is a player decision, not club control. Later positive surplus is zeroed while negative value remains possible if the player stays. Club options before any player decision still count normally.
- **Contract incentives:** probability-weight playing-time escalators from RosterResource using projected PA/IP/G/GS. Do not sum mutually exclusive award or MVP tiers into salary as though every outcome could happen.
- **Conditional contract paths:** do not force a made-up probability onto mutually exclusive club, player, mutual, or injury-triggered options. Use the conservative unilateral fallback in rankings, then expose complete alternative paths in the editor for honest scenario comparison.
- **Long-range uncertainty:** future wins remain undiscounted in the central estimate. The value range widens with the surplus-weighted projection horizon because a 2034 aging estimate is less reliable than a 2027 ZiPS forecast.
- **Identity handling:** when a projected major leaguer is also still present on The Board for the same organization, keep the richer MLB record and its last-prospect blend rather than listing the player twice.
- **Roster pressure for prospects:** treat Rule 5/40-man pressure as context, not a scouting-grade downgrade. Provide explicit, editable scenarios rather than inventing eligibility for players whose source data does not establish it.
- **Prospect uncertainty:** use The Board's scouting-risk label to widen or narrow the value range without moving the FV-based central estimate. This avoids pretending that a high-risk 18-year-old and a low-risk upper-minors player have equally certain outcomes while also avoiding a second hidden discount to the FV grade.
- **Shared trade state:** links store current player IDs and model settings. Official, untouched players refresh against the latest public-data snapshot when the link is opened; custom players and manually edited official records carry their saved assumptions in the link.
- **Tradeability vs. value:** a no-trade clause changes whether a deal can happen, not the player’s projected wins or salary. Surface the consent constraint prominently, keep it editable, and do not bury an arbitrary penalty in the surplus number.
- **Cash and salary relief:** treat entered cash or retained salary as a certain dollar-for-dollar package adjustment. Do not pretend the single total models CBT effects or payment timing; show it separately from control-year player value.

## Loop results

- **Pass 1 — intent and feedback:** found and corrected the Method navigation, example/reset state, cross-team editor clearing, selected-player removal, stale swap searches, narrow-screen editor handoff, and incomplete search keyboard behavior.
- **Pass 2 — model language and behavior:** replaced the finance-default discount with neutral timing plus an optional win-now lens; replaced universal free WAR with role-aware roster burden; added transparent star and reliever market controls; added prospect roster-pressure context.
- **Pass 3 — render and regression checks:** the complete server-rendered action surface, always-visible control-year view, rankings, search contract, model defaults, and navigation hooks pass the project checks in both hosting formats.
- **Pass 4 — leaguewide calibration:** extracted all 2,000+ player values through the production model; corrected MLB/prospect duplicates, pitcher role detection, opt-out ownership, and misleading “control years” labels. Added repeatable checks for the roster baselines, option asymmetry, Bobby Witt Jr.’s opt-out, Mason Miller’s role, and a bounded Jarren Duran arbitration estimate.
- **Pass 5 — long-contract calibration:** inspected live incentive structures, added expected playing-time escalators without double-counting award tiers, and made uncertainty ranges expand with the value-weighted forecast horizon. Jackson Merrill’s modeled remaining salary moved from $163.7M to $186.3M, close to the $189.4M public-market comparison, while his central projection remained undiscounted.
- **Pass 6 — conditional-contract decisions:** inventoried the leaguewide source snapshot for decision-tree contracts, prevented injury-only options from appearing universally available, and added one-path-at-a-time comparison for club/player/mutual branches. The default rankings remain conservative rather than assuming a favorable long-term option will be exercised.
- **Pass 7 — midseason extension integrity:** found that RosterResource can publish a new extension as a second contract record while retaining the current deal. The refresh now merges records by effective season, so a 2027 extension cannot erase the player’s 2026 rest-of-season WAR and salary. Every MLB record in the current snapshot now includes a 2026 RoS row.
- **Pass 8 — prospect context:** The Board now supplies the missing inputs: scouting risk, signing year, age, ETA, and remaining option years. Those fields drive editable risk ranges and source-backed 40-man/Rule 5 context; the model still keeps roster leverage separate from the scouting grade.
- **Pass 9 — trade handoff:** added compact, versioned trade links with input validation, Unicode-safe encoding, clipboard fallback, and visible load/copy feedback. A shared decision can now move between people without accounts or a backend.
- **Pass 10 — tradeability context:** separated contract value from permission to trade. RosterResource’s dedicated no-trade field feeds full/partial protection labels, with a small tested fallback for four primary-source omissions and 10-and-5 rights. Protected players are flagged in packages and rankings, missing source data is labeled as unconfirmed, and central surplus remains unchanged.
- **Pass 11 — cash and salary relief:** added a compact package adjustment for cash considerations or retained salary. It flows through totals, ranges, swaps, resets, yearly comparison, and shared links while remaining visibly separate from player WAR and contract assumptions.
