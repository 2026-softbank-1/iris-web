One-line: Centered modal for confirmations; one primary action, optional secondary.

```jsx
<Dialog open={open} title="송금하시겠어요?"
  secondaryLabel="취소" primaryLabel="송금"
  onPrimary={confirm} onSecondary={close} onClose={close}>
  김토스님에게 50,000원을 보낼게요.
</Dialog>
```
Title asks a question ("…하시겠어요?"); body confirms the consequence.
