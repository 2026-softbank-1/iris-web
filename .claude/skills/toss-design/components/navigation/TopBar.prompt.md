One-line: Top navigation bar — back arrow, title, right action. `large` for iOS large-title screens.

```jsx
<TopBar title="송금" onBack={goBack} right={<IconButton><Icon name="search"/></IconButton>} />
<TopBar title="내 자산" large right={...} />
```
