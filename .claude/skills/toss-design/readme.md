# Toss Design System (TDS)

A code-first recreation of the **Toss Design System (TDS)** design language — tokens, type, components and icons. Use it as a design reference for UI work; it carries no Toss brand assets.

> **Source of truth:** the attached Figma file **"toss-design.fig"** ("Toss Design System · For Apps in Toss", v2026.03-1). All tokens, components and icons here were extracted from that file. The published Toss brand was used only to confirm what was read, never as a substitute.

## The system at a glance
- **One brand color does the work:** Toss Blue `#3182F6`. Everything actionable is blue; everything else is greyscale. Sparing status colors (green gains, red losses, yellow warnings).
- **Greyscale is the canvas:** a precise 10-step grey scale carries all text hierarchy, surfaces and borders. Screens are white cards floating on a `#F2F4F6` page.
- **Numbers are heroes:** balances and percentages are set large, tight and bold. Korean finance convention — **red = up/gain, blue = down/loss** (opposite of the US).
- **Soft, rounded, calm:** generous corner radii (14–24px), soft low-spread shadows, quick spring-y motion, a signature subtle press-shrink.

## Sources
- **Figma:** `toss-design.fig` — "Toss Design System / For Apps in Toss" (mounted read-only; 355 component sets, 713 design variables, a ~7,200-glyph icon library, light/dark + iOS/android theme modes).
- No GitHub repo or codebase was provided. If you have the Toss component source, link it here.

---

## CONTENT FUNDAMENTALS

Copy is written in **Korean**, in a warm, plain-spoken, reassuring voice.

- **Tone:** friendly, calm, encouraging — like a competent friend explaining money. Never stiff, never jargon-heavy, never shouty.
- **Politeness register:** the **해요체** — informal-polite. Sentences end in **`~요 / ~에요 / ~해요 / ~할까요?`**, not the formal `~습니다`. Examples from the file: *"화면에서 가장 중요한 행동을 강조하는 기본 버튼이에요."* · *"사용자가 다음 단계로 이동할 때 사용해요."*
- **Verbs over nouns:** actions are short verb phrases — **송금하기, 보내기, 결제, 더 알아보기, 선택 완료**. CTAs describe the outcome, often with the amount baked in: *"50,000원 보내기"*.
- **Confirmations ask, then reassure:** dialogs pose a question (*"송금하시겠어요?"*) and the body states the consequence (*"홍길동님에게 50,000원을 보낼게요."*). Toasts are short and past-tense: *"송금이 완료됐어요."*
- **Casing:** Korean has no case; embedded Latin/labels are sentence case or lowercase.
- **Numbers & money:** always grouped with commas and the **원** suffix (`1,250,000원`); percentages signed (`+5.12%`). Dates `2026.06.19`.
- **Emoji:** **not used in product UI.** (The Figma uses emoji only as internal layer-name decoration — never treat that as product content.)
- **Vibe:** *"쉽고, 빠르고, 안전하게"* — easy, fast, safe. Remove friction; explain only what matters; celebrate small wins.

---

## VISUAL FOUNDATIONS

**Color**
- Primary is **Toss Blue `#3182F6`** (Blue 500). It is the only "look here" color — buttons, links, selected states, active icons, brand fills.
- A full **10-step blue** ramp (50→900) and **10-step grey** ramp (50→900) cover nearly everything. Grey-900 `#191F28` is near-black text; grey-100 `#F2F4F6` is the page canvas.
- **Status:** success/gain green `#03B26C`, danger/loss red `#F04452`, warning yellow `#FFB331`, info blue. Teal `#2BC4C4` for occasional accents.
- Semantic aliases drive real usage: `--text-primary/secondary/tertiary/quaternary`, `--fill-brand`, `--bg-page`, `--border-default`, etc. Full light **and** dark values plus iOS/Android modes ship in `tokens-fig/fig-tokens.css`.

**Type**
- Face: proprietary **Toss Product Sans / Toss Display Sans** + **SF Pro** for iOS. We substitute **Pretendard** (closest KR+Latin match, CDN). See the font caveat below.
- Tight scale, generous line-height (~1.5) for hangul. Weights 400/500/600/700. Tracking is tight (−0.01 to −0.03em), tightest on big numbers.
- Hierarchy: Display (28–36) for hero numbers/headlines · Title (18–24) for screen & section headers · Body (15–17) for reading · Label (13–15) for dense UI · Caption (11–13) for helpers. 17px is the iOS-default body size.

**Spacing & layout**
- 4px base grid. **24px default mobile side padding** (`--space-side`), 20px on compact. Cards pad 16–20.
- Layout is a **single scrolling column of white cards** on the grey page. Fixed chrome: top nav (56px), bottom tab bar, bottom CTA docked above the safe-area inset.

**Shape & elevation**
- Corner radii are soft and generous: 14 (xxs) · 16 (xs) · 18 (s) · 20 (m, cards) · 24 (l, sheets) · full (pills/chips). Icon tiles use ~12–14.
- **Cards:** white, radius 20, either a hairline `--border-default` or a soft low-spread shadow (`--shadow-card`). Toss avoids hard, dark drop shadows — shadows are faint and diffuse.
- Bottom sheets: radius 24 top corners, a 40×4 grey grab handle, slide up.

**Motion**
- Quick and soft. Durations 150–220ms, eased (`cubic-bezier(0.16,1,0.3,1)` for entrances).
- **Signature press feedback:** interactive elements **scale down to ~0.96** on press; text buttons dim opacity. Switches/segmented selectors slide. No infinite/decorative loops in product UI; the loader is a thin blue ring.

**Hover / press / disabled**
- Touch-first: there is no hover language. Press = scale-shrink and/or a subtle grey state-layer (`--fill-pressed`, ~5% navy). Disabled = 40% opacity. Selected = blue fill/border/text.

**Imagery & backgrounds**
- Backgrounds are flat solid color (white cards on grey) — **no gradients on surfaces**, no textures, no full-bleed photography in core flows.
- Illustration style is clean, rounded, friendly 3D/flat. Bank/brand logos appear as small rounded-square tiles in lists.

**Transparency & blur**
- Used deliberately: scrims behind modals (`rgba(0,0,0,0.2)`), frosted toasts, and `--background-blur-*` tokens for overlay materials. Otherwise surfaces are opaque.

---

## ICONOGRAPHY

- Toss ships its **own custom monoline icon library** — a single coherent family of **~7,200 glyphs** (the file's biggest asset). Icons are **24×24, single-color, drawn with `currentColor`** (so they inherit text color), with a consistent medium stroke and rounded joints. Variants exist as **mono** (line, the default), **fill**, **color**, and **emoji/face** sets at 24 and 40px.
- Naming is systematic: `icon-{name}-mono` (e.g. `icon-search-mono`, `icon-arrow-right-mono`, `icon-won-mono`). Korean fintech-specific glyphs are first-class (won ₩, bank, card, account/bankbook, QR, scan, credit-grade…).
- **In this project:** a curated **core set of 42** common UI icons is materialized to `assets/icons/icon-data.js` and exposed as `<Icon name="…" />` (`assets/icons/Icon.jsx`), with friendly aliases (`search`, `x`, `won`, `arrow-right`, `bank`, `card`, `chart`, `qr`…). The full 7,200-glyph set lives in the Figma file and can be materialized on demand.
- **No emoji and no unicode characters are used as icons** in product UI — always the icon font/SVG set. Don't hand-draw icons; use `<Icon>` or pull more from Figma.

---

## INDEX — what's in this folder

**Foundations**
- `styles.css` — root entry point (`@import` manifest only). Consumers link this one file.
- `tokens/fonts.css` — Pretendard webfont + family vars · `tokens/brand.css` — clean px semantic aliases · `tokens/typography.css` — type scale · `tokens-fig/fig-tokens.css` — full materialized Figma variable set (all themes/modes).
- `guidelines/*.card.html` — foundation specimen cards (Colors, Type, Spacing, Elevation).

**Components** (`window.TossDesignSystemTDS_d2de50`) — 23 primitives
- `components/button/` — **Button**, **TextButton**, **IconButton**
- `components/forms/` — **TextField**, **SearchField**, **Switch**, **Checkbox**, **SegmentedControl**, **Stepper**
- `components/display/` — **Badge**, **Chip**, **Card**, **ListRow**
- `components/feedback/` — **Loader**, **ProgressBar**, **Toast**, **Tooltip**, **Dialog**, **BottomSheet**
- `components/navigation/` — **TopBar**, **Tabs**, **TabBar**
- `assets/icons/` — **Icon** + `ICON_ALIASES` (42-icon core set)

**Assets**
- `assets/icons/icon-data.js` — icon SVG data.

**Meta**
- `SKILL.md` — Agent-Skill manifest for use in Claude Code.

---

## CAVEATS
- **Fonts substituted.** The real Toss faces (Toss Product Sans / Toss Display Sans / SF Pro) are proprietary and not redistributable; we use **Pretendard** (CDN), the closest KR+Latin match. Swap in the licensed faces for production.
- **Icon set is a curated subset (42 of ~7,200).** Materialize more from the Figma file as needed.
- Components are **clean hand-authored recreations** referencing the real extracted tokens — not the raw Figma component implementations.
