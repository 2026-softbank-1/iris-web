import { Activity, ArrowRight, GitBranch, ScrollText } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LogoMark, RepoIcon } from '../components/brand';
import { LanguageButton } from '../components/LanguageButton';
import { useI18n, type MessageKey } from '../i18n';
import '../styles/landing.css';

const FEATURES = [
  { icon: GitBranch, title: 'landing.feature1.title', body: 'landing.feature1.body' },
  { icon: ScrollText, title: 'landing.feature2.title', body: 'landing.feature2.body' },
  { icon: Activity, title: 'landing.feature3.title', body: 'landing.feature3.body' },
] satisfies { icon: unknown; title: MessageKey; body: MessageKey }[];

const STEPS = [
  { title: 'landing.step1.title', body: 'landing.step1.body' },
  { title: 'landing.step2.title', body: 'landing.step2.body' },
  { title: 'landing.step3.title', body: 'landing.step3.body' },
] satisfies { title: MessageKey; body: MessageKey }[];

export function Landing() {
  const auth = useAuth();
  const { t } = useI18n();
  const [titlePre, titlePost] = t('landing.title2').split('{brand}');
  const logLines = ['$ npm ci', '$ npm run build', t('landing.logBuilt'), t('landing.logDeployed')];
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
      {t('landing.goDashboard')} <ArrowRight size={18} />
    </Link>
  ) : (
    <button type="button" className="landing-cta" onClick={auth.login} disabled={auth.status === 'loading'}>
      <RepoIcon size={18} /> {t('landing.start')}
    </button>
  );

  return (
    <div className="landing" ref={rootRef}>
      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label="LikeLion home">
          <LogoMark size={28} />
          <span>LikeLion</span>
        </Link>
        <div className="landing-header-right">
          <LanguageButton />
          <Link to={authed ? '/dashboard' : '/login'} className="landing-header-link">
            {authed ? t('landing.dashboard') : t('landing.login')}
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-logo-float" aria-hidden>
              <LogoMark size={56} />
            </div>
            <h1 className="reveal" style={{ animationDelay: '80ms' }}>
              {t('landing.title1')}
              <br />
              {titlePre}
              <em>LikeLion</em>
              {titlePost}
            </h1>
            <p className="reveal" style={{ animationDelay: '160ms' }}>
              {t('landing.subtitle')}
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
            <p className="deploy-meta">{t('landing.deployMeta')}</p>
            <div className="deploy-progress">
              <span />
            </div>
            <ul className="deploy-log">
              {logLines.map((line, i) => (
                <li key={line} style={{ animationDelay: `${900 + i * 550}ms` }} className={line.startsWith('✓') ? 'ok' : undefined}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-steps">
          <h2 className="landing-section-title scroll-reveal">{t('landing.stepsTitle')}</h2>
          <ol>
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="step scroll-reveal" style={{ animationDelay: `${i * 120}ms` }}>
                <span className="step-num">{i + 1}</span>
                <h3>{t(title)}</h3>
                <p>{t(body)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-features">
          <h2 className="landing-section-title scroll-reveal">{t('landing.featuresTitle')}</h2>
          <div className="features-grid">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <article key={title} className="feature scroll-reveal" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="feature-icon">
                <Icon size={20} />
              </div>
              <h2>{t(title)}</h2>
              <p>{t(body)}</p>
            </article>
          ))}
          </div>
        </section>

        <section className="landing-bottom scroll-reveal">
          <h2>{t('landing.bottomTitle')}</h2>
          <p>{t('landing.bottomBody')}</p>
          {cta}
        </section>
      </main>

      <footer className="landing-footer">© LikeLion</footer>
    </div>
  );
}
