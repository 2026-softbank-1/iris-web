One-line: Primary action buttons — fill, weak, outline across brand/neutral/danger and four sizes.

```jsx
<Button color="brand" size="large" fullWidth>송금하기</Button>
<Button variant="weak" color="brand">더 알아보기</Button>
<Button color="danger" variant="weak">삭제</Button>
<Button loading>처리 중</Button>
```

- `variant`: `fill` (solid, one per screen), `weak` (tinted), `outline` (bordered secondary).
- `color`: `brand` (Toss blue, default) · `neutral` · `danger` · `dark`.
- `size`: `large` (56px, the full-width bottom CTA) · `medium` (48) · `small` (40) · `tiny` (32).
- Press feedback is a subtle scale-down (0.96) — a Toss signature. Use `fullWidth` for bottom CTAs.
