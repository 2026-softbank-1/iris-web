One-line: Bottom sheet with drag handle for selections and secondary flows.

```jsx
<BottomSheet open={open} title="계좌 선택" onClose={close}>
  …rows…
  <Button fullWidth onClick={close}>선택 완료</Button>
</BottomSheet>
```
Preferred over Dialog when there are choices or longer content.
