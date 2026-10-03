# Toss App — UI Kit

Interactive, click-through recreation of the Toss mobile super-app, composed entirely from TDS component primitives (`window.TossDesignSystemTDS_d2de50`) and the TDS icon set.

## Run
Open `index.html`. It renders inside a phone frame and is fully interactive.

## Flows
- **Home (홈)** — asset overview: total assets, quick actions, account/card/invest rows. Tap **송금** or an account → Send flow.
- **Send (송금)** — recipient + custom numeric keypad with quick-add chips; full-width CTA; success toast on completion.
- **Invest (투자)** — portfolio summary, range segmented control, holdings list with sparklines (red = gain, blue = loss, per Korean market convention).
- **Pay (결제)** — dark QR payment screen.
- **Bottom TabBar** switches between 홈 · 혜택 · 결제 · 투자 · 전체.

## Files
- `index.html` — app shell: phone frame, status bar, tab navigation, screen routing.
- `HomeScreen.jsx` · `SendScreen.jsx` · `StockScreen.jsx` — screens (export to `window`).

## Notes
- Screens are cosmetic recreations: data is hard-coded, navigation is faked with local state.
- Numbers are emphasised (tight, bold, `원` suffix) — a Toss signature. Gains render **red**, losses **blue** (Korean finance convention, opposite of the US).
