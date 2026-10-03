One-line: The backbone list row — left accessory, title/description, right accessory + chevron.

```jsx
<ListRow
  left={<IconTile name="bank" />}
  title="토스뱅크 입출금"
  description="1234-56-789012"
  right={<b>1,250,000원</b>}
  arrow onClick={open} />
```
Stack rows inside a `Card`. `right` takes amount text, a `Badge`, a `Switch`, etc. Pressable rows get a grey press background automatically.
