One-line: Text input — `box` (filled rounded form field) or `line` (underline, used for amounts).

```jsx
<TextField label="이름" value={v} onChange={e=>set(e.target.value)} />
<TextField variant="line" value={amt} suffix="원" onChange={...} />
<TextField label="계좌번호" error="올바른 번호를 입력해주세요" />
```
Focus turns the accent blue; pass `error` for the red state + message.
