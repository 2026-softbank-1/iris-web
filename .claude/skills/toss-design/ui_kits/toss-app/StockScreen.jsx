// Toss app — Stock / 투자 screen. Portfolio summary + holdings.
const { Icon, Badge, Tabs, SegmentedControl } = window.TossDesignSystemTDS_d2de50;

function Sparkline({ up }) {
  const pts = up
    ? '0,40 20,36 40,38 60,28 80,30 100,18 120,22 140,8 160,12 180,2'
    : '0,8 20,14 40,10 60,22 80,18 100,30 120,26 140,38 160,34 180,42';
  const color = up ? 'var(--red-500)' : 'var(--blue-500)';
  return (
    <svg viewBox="0 0 180 48" width="84" height="40" fill="none" preserveAspectRatio="none">
      <polyline points={pts} stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StockScreen() {
  const [range, setRange] = React.useState('1일');
  const won = window.tossWon;
  const holdings = [
    { name: '삼성전자', sub: '12주', amt: 948000, chg: '+2.4%', up: true },
    { name: '엔비디아', sub: '4주 · 해외', amt: 3120400, chg: '+5.8%', up: true },
    { name: 'TIGER 미국S&P500', sub: '38주', amt: 2074200, chg: '-0.6%', up: false },
    { name: '카카오', sub: '20주', amt: 812000, chg: '-1.2%', up: false },
  ];
  return (
    <div style={{ background: '#fff', minHeight: '100%', paddingBottom: 16 }}>
      <div style={{ padding: '20px 24px 8px' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-strong)' }}>투자</h1>
      </div>
      <Tabs items={['주식', '채권', '펀드']} value="주식" onChange={() => {}} fluid style={{ margin: '0 16px' }} />

      {/* summary */}
      <div style={{ padding: '20px 24px 8px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>총 평가금액</div>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-strong)', marginTop: 4 }}>{won(11238600)}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <Badge color="red" variant="weak">+548,200원</Badge>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red-500)' }}>+5.12%</span>
        </div>
      </div>

      {/* range control */}
      <div style={{ padding: '12px 20px' }}>
        <SegmentedControl options={['1일', '1주', '1달', '1년', '전체']} value={range} onChange={setRange} />
      </div>

      {/* holdings */}
      <div style={{ padding: '4px 8px' }}>
        <div style={{ padding: '8px 16px', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>내 보유 종목</div>
        {holdings.map((h) => (
          <div key={h.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--grey-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--grey-600)', flexShrink: 0 }}>{h.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{h.name}</div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-quaternary)', marginTop: 1 }}>{h.sub}</div>
            </div>
            <Sparkline up={h.up} />
            <div style={{ textAlign: 'right', minWidth: 84 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>{won(h.amt)}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: h.up ? 'var(--red-500)' : 'var(--blue-500)', marginTop: 1 }}>{h.chg}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
window.StockScreen = StockScreen;
