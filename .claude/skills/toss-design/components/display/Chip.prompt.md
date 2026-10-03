One-line: Pill filter/selection chip with a blue selected state.

```jsx
<Chip selected={tab==='전체'} onClick={()=>setTab('전체')}>전체</Chip>
<Chip leadingIcon={<Icon name="filter" size={15}/>}>필터</Chip>
```
Use rows of chips for category filters above a list. `size`: small | medium.
