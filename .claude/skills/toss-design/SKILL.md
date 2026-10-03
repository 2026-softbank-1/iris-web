---
name: toss-design
description: Use this skill to design UI in the Toss Design System (TDS) style, for production or throwaway prototypes/mocks/etc. Contains design guidelines, colors, type, fonts, icons, and UI components from TDS. No Toss brand assets are included.
user-invocable: true
---

Read the `readme.md` file within this skill first — it covers content fundamentals (Korean 해요체 voice), visual foundations, and iconography. Then explore the other available files:

- `styles.css` — link this one file to get every token and webfont.
- `tokens/` + `tokens-fig/fig-tokens.css` — color, type, spacing, radius, shadow tokens (light/dark, iOS/android).
- `guidelines/*.card.html` — visual specimens for colors, type, spacing.
- `components/` — 23 React UI primitives (Button, TextField, ListRow, TabBar, BottomSheet…). Each has a `.d.ts` (props) and `.prompt.md` (usage). They live on `window.TossDesignSystemTDS_d2de50` after loading `_ds_bundle.js`.
- `assets/icons/` — the `<Icon name="…" />` component + 42-icon core set (friendly aliases like `search`, `won`, `bank`).

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and create static HTML files for the user to view. For production code, copy assets and follow the rules here to design as a TDS expert.

If the user invokes this skill without other guidance, ask what they want to build, ask a few questions, and act as an expert designer who outputs HTML artifacts **or** production code, depending on the need.

**Non-negotiables when designing in TDS style:** Toss Blue `#3182F6` is the only action color; everything else is greyscale on a `#F2F4F6` page of white rounded cards. Numbers are big, tight, bold (red = gain, blue = loss). Copy is Korean 해요체, warm and plain. Soft radii (14–24), faint shadows, subtle press-shrink. No gradients on surfaces, no emoji in product UI, never hand-draw icons — use `<Icon>`.
