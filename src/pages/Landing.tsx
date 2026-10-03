import { Activity, ArrowRight, GitBranch, ScrollText } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LogoMark, RepoIcon } from '../components/brand';
import '../styles/landing.css';

const FEATURES = [
  { icon: GitBranch, title: 'GitHub 연동 배포', body: '저장소를 연결하고 push하면 빌드부터 배포까지 자동으로 진행해요.' },
  { icon: ScrollText, title: '실시간 로그', body: '빌드 로그와 서비스 로그를 화면에서 바로 확인할 수 있어요.' },
  { icon: Activity, title: '지표 한눈에', body: 'CPU, 메모리, 네트워크 사용량을 그래프로 볼 수 있어요.' },
];

const STEPS = [
  { title: '저장소 연결', body: 'GitHub로 로그인하고 배포할 저장소를 골라요.' },
  { title: 'push하기', body: '평소처럼 코드를 push하면 빌드가 시작돼요.' },
  { title: '배포 완료', body: '서비스 주소가 발급되고 바로 접속할 수 있어요.' },
];

const LOG_LINES = ['$ npm ci', '$ npm run build', '✓ 빌드 완료 (32초)', '✓ 배포 완료 · my-app.likelion.uk'];

export function Landing() {
  const auth = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);

  // 화면에 들어온 블록에만 등장 애니메이션을 건다.
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll('.scroll-reveal') ?? [];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { threshold: 0.2 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const authed = auth.status === 'authenticated';
  const cta = authed ? (
    <Link to="/dashboard" className="landing-cta">
      대시보드로 가기 <ArrowRight size={18} />
    </Link>
  ) : (
    <button type="button" className="landing-cta" onClick={auth.login} disabled={auth.status === 'loading'}>
      <RepoIcon size={18} /> GitHub로 시작하기
    </button>
  );

  return (
    <div className="landing" ref={rootRef}>
      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label="LikeLion home">
          <LogoMark size={28} />
          <span>LikeLion</span>
        </Link>
        <Link to={authed ? '/dashboard' : '/login'} className="landing-header-link">
          {authed ? '대시보드' : '로그인'}
        </Link>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-logo-float" aria-hidden>
              <LogoMark size={56} />
            </div>
            <h1 className="reveal" style={{ animationDelay: '80ms' }}>
              코드를 올리면,
              <br />
              배포는 <em>LikeLion</em>이 해요
            </h1>
            <p className="reveal" style={{ animationDelay: '160ms' }}>
              GitHub 저장소만 연결하면 빌드, 배포, 로그, 지표까지 한곳에서 관리할 수 있어요.
            </p>
            <div className="landing-actions reveal" style={{ animationDelay: '240ms' }}>
              {cta}
            </div>
          </div>

          <div className="deploy-card reveal" style={{ animationDelay: '320ms' }} aria-hidden>
            <div className="deploy-card-head">
              <span className="deploy-name">my-app</span>
              <span className="deploy-status">
                <span className="pill pill-building">Building</span>
                <span className="pill pill-active">Active</span>
              </span>
            </div>
            <p className="deploy-meta">main · a1b2c3d · 로그인 화면 수정</p>
            <div className="deploy-progress">
              <span />
            </div>
            <ul className="deploy-log">
              {LOG_LINES.map((line, i) => (
                <li key={line} style={{ animationDelay: `${900 + i * 550}ms` }} className={line.startsWith('✓') ? 'ok' : undefined}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-steps">
          <h2 className="landing-section-title scroll-reveal">이렇게 시작해요</h2>
          <ol>
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="step scroll-reveal" style={{ animationDelay: `${i * 120}ms` }}>
                <span className="step-num">{i + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-features">
          <h2 className="landing-section-title scroll-reveal">이런 걸 할 수 있어요</h2>
          <div className="features-grid">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <article key={title} className="feature scroll-reveal" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="feature-icon">
                <Icon size={20} />
              </div>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
          </div>
        </section>

        <section className="landing-bottom scroll-reveal">
          <h2>지금 바로 배포해 보세요</h2>
          <p>저장소 하나면 충분해요.</p>
          {cta}
        </section>
      </main>

      <footer className="landing-footer">© LikeLion</footer>
    </div>
  );
}
