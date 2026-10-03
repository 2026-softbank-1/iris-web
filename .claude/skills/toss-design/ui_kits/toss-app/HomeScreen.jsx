// Toss app — Home screen. Asset overview, the default landing view.
const TDS = window.TossDesignSystemTDS_d2de50;
const { Icon, Badge, Card } = TDS;

function AssetIcon({ name, bg }) {
  return (
    <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grey-700)', flexShrink: 0 }}>
      <Icon name={name} size={24} />
    </div>
  );
}

function won(n) { return n.toLocaleString('ko-KR') + '원'; }

function HomeScreen({ onOpenSend, onOpenAccount }) {
  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100%', paddingBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px 8px', background: 'var(--bg-page)' }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue-500)', letterSpacing: '-0.04em' }}>toss</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, color: 'var(--grey-700)' }}>
          <Icon name="scan" size={26} />
          <Icon name="bell" size={26} />
        </div>
      </div>

      {/* Total assets card */}
      <div style={{ padding: '8px 20px 0' }}>
        <Card padding={20} radius={20} style={{ background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>내 자산</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 600, color: 'var(--text-quaternary)' }}>
              자세히 <Icon name="chevron-right" size={14} color="var(--icon-tertiary)" />
            </span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.03em', marginTop: 6 }}>{won(13428600)}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Badge color="green">이번 달 +218,400원</Badge>
            <Badge color="grey">전일 대비 +1.2%</Badge>
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', padding: '16px 20px 8px', gap: 8 }}>
        {[{ l: '송금', i: 'won', a: onOpenSend }, { l: '결제', i: 'qr' }, { l: '내 계좌', i: 'bank' }, { l: '더보기', i: 'dots' }].map((q) => (
          <button key={q.l} onClick={q.a} style={{ flex: 1, border: 'none', background: '#fff', borderRadius: 16, padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
            <Icon name={q.i} size={26} color="var(--blue-500)" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{q.l}</span>
          </button>
        ))}
      </div>

      {/* Accounts */}
      <div style={{ padding: '8px 20px' }}>
        <Card padding={6} radius={20}>
          <div style={{ padding: '12px 14px 6px', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>토스뱅크</div>
          {[
            { name: '토스뱅크 입출금', sub: '1234-56-789012', amt: 1250000, icon: 'bank', bg: '#E8F3FF' },
            { name: '토스뱅크 모으기', sub: '매주 +50,000원', amt: 940000, icon: 'coin', bg: '#EAF7F0' },
          ].map((a) => (
            <div key={a.name} onClick={onOpenAccount} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', cursor: 'pointer', borderRadius: 14 }}>
              <AssetIcon name={a.icon} bg={a.bg} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{a.name}</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-quaternary)', marginTop: 1 }}>{a.sub}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)' }}>{won(a.amt)}</div>
            </div>
          ))}
          <div style={{ padding: '6px 14px 12px' }}>
            <button style={{ width: '100%', border: 'none', background: 'var(--grey-100)', borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>토스뱅크 +1.8% 이자 받기</button>
          </div>
        </Card>
      </div>

      {/* Card + invest */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card padding={6} radius={20}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px' }}>
            <AssetIcon name="card" bg="#F2F4F6" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>토스카드</div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-quaternary)', marginTop: 1 }}>이번 달 412,000원 사용</div>
            </div>
            <Badge color="blue">캐시백 4,120원</Badge>
          </div>
        </Card>
        <Card padding={6} radius={20}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px' }}>
            <AssetIcon name="chart" bg="#E8F3FF" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>토스증권 투자</div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-quaternary)', marginTop: 1 }}>평가금액 11,238,600원</div>
            </div>
            <Badge color="red">+5.12%</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
window.HomeScreen = HomeScreen;
window.tossWon = won;
