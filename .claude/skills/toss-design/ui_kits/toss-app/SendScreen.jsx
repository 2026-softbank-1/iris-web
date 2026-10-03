// Toss app — Send money flow. Recipient + amount with a custom numeric keypad.
const { Icon, Button } = window.TossDesignSystemTDS_d2de50;

function SendScreen({ onBack, onComplete }) {
  const [amount, setAmount] = React.useState(0);
  const won = window.tossWon;
  const balance = 1250000;

  const press = (k) => {
    setAmount((a) => {
      if (k === 'del') return Math.floor(a / 10);
      if (k === '00') return Math.min(a * 100, 999999999);
      return Math.min(a * 10 + k, 999999999);
    });
  };
  const quick = (v) => setAmount((a) => Math.min(a + v, 999999999));

  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, '00', 0, 'del'];

  return (
    <div style={{ background: '#fff', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* nav */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
        <button onClick={onBack} aria-label="back" style={{ width: 44, height: 44, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--grey-800)' }}>
          <Icon name="arrow-left" size={26} />
        </button>
      </div>

      {/* recipient */}
      <div style={{ padding: '4px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--blue-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue-600)' }}>
            <Icon name="user" size={20} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-quaternary)' }}>받는 분</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>이수민 · 토스뱅크</div>
          </div>
        </div>
      </div>

      {/* amount */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', color: amount ? 'var(--text-strong)' : 'var(--grey-300)' }}>
          {amount ? won(amount) : '얼마를 보낼까요?'}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-quaternary)', marginTop: 8 }}>출금 가능 {won(balance)}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[{ l: '+1만', v: 10000 }, { l: '+5만', v: 50000 }, { l: '+10만', v: 100000 }, { l: '전액', v: balance - amount }].map((q) => (
            <button key={q.l} onClick={() => quick(q.v)} style={{ border: 'none', background: 'var(--grey-100)', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>{q.l}</button>
          ))}
        </div>
      </div>

      {/* keypad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '0 8px' }}>
        {keys.map((k) => (
          <button key={String(k)} onClick={() => press(k)} style={{ border: 'none', background: 'none', padding: '16px 0', fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
            {k === 'del' ? <Icon name="arrow-left" size={24} /> : k}
          </button>
        ))}
      </div>

      {/* CTA */}
      <div style={{ padding: '8px 20px max(20px, env(safe-area-inset-bottom))' }}>
        <Button fullWidth disabled={!amount} onClick={onComplete}>{amount ? `${won(amount)} 보내기` : '보내기'}</Button>
      </div>
    </div>
  );
}
window.SendScreen = SendScreen;
