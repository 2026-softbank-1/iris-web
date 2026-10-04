import {
  Activity,
  ArrowRight,
  Check,
  Cloud,
  GitBranch,
  KeyRound,
  RotateCcw,
  ScrollText,
  Server,
  Sparkles,
  Terminal,
  Wand2,
} from 'lucide-react';
import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LogoMark, RepoIcon } from '../components/brand';
import { LanguageButton } from '../components/LanguageButton';
import { useI18n, type MessageKey } from '../i18n';
import '../styles/landing.css';

// 버전을 적지 않고 항상 최신 릴리스로 보낸다. CLI 는 npm 에 올리지 않고 Releases 의 .tgz 로만 설치한다.
const CLI_RELEASES_URL = 'https://github.com/2026-softbank-1/iris-cli/releases/latest';

const NAV = [
  { id: 'ai', label: 'landing.nav.ai' },
  { id: 'cli', label: 'landing.nav.cli' },
  { id: 'ops', label: 'landing.nav.ops' },
] satisfies { id: string; label: MessageKey }[];

const STEPS = [
  { title: 'landing.step1.title', body: 'landing.step1.body' },
  { title: 'landing.step2.title', body: 'landing.step2.body' },
  { title: 'landing.step3.title', body: 'landing.step3.body' },
] satisfies { title: MessageKey; body: MessageKey }[];

const BASICS = [
  { icon: GitBranch, title: 'landing.feature1.title', body: 'landing.feature1.body' },
  { icon: ScrollText, title: 'landing.feature2.title', body: 'landing.feature2.body' },
  { icon: Activity, title: 'landing.feature3.title', body: 'landing.feature3.body' },
] satisfies { icon: unknown; title: MessageKey; body: MessageKey }[];

const AI_POINTS = ['landing.ai.point1', 'landing.ai.point2', 'landing.ai.point3'] satisfies MessageKey[];
const AI_FLOW = ['landing.ai.flow1', 'landing.ai.flow2', 'landing.ai.flow3', 'landing.ai.flow4'] satisfies MessageKey[];

const CLI_COMMANDS = [
  { cmd: 'likelion up', desc: 'landing.cli.cmdUp' },
  { cmd: 'likelion logs -f', desc: 'landing.cli.cmdLogs' },
  { cmd: 'likelion rollback', desc: 'landing.cli.cmdRollback' },
  { cmd: 'likelion env push', desc: 'landing.cli.cmdEnv' },
  { cmd: 'likelion diagnose', desc: 'landing.cli.cmdDiagnose' },
  { cmd: 'likelion fix', desc: 'landing.cli.cmdFix' },
] satisfies { cmd: string; desc: MessageKey }[];

const STRATEGIES = ['landing.ops.rolling', 'landing.ops.canary', 'landing.ops.blueGreen'] satisfies MessageKey[];

/** 문구 속 `백틱` 구간을 <code> 로 그린다. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) =>
        i % 2 ? (
          <code key={i} className="landing-code">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** 해시 이동 대신 landing 스크롤 영역 안에서 부드럽게 이동한다(히스토리를 더럽히지 않는다). */
function scrollToSection(e: MouseEvent, id: string) {
  e.preventDefault();
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

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
        <nav className="landing-nav">
          {NAV.map(({ id, label }) => (
            <a key={id} href={`#${id}`} onClick={(e) => scrollToSection(e, id)}>
              {t(label)}
            </a>
          ))}
        </nav>
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
              <a href="#cli" className="landing-cta-ghost" onClick={(e) => scrollToSection(e, 'cli')}>
                <Terminal size={18} /> {t('landing.cliCta')}
              </a>
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

        <section className="landing-band is-grey landing-steps">
          <div className="landing-inner">
            <h2 className="landing-section-title scroll-reveal">{t('landing.stepsTitle')}</h2>
            <ol>
              {STEPS.map(({ title, body }, i) => (
                <li key={title} className="step scroll-reveal" style={{ animationDelay: `${i * 120}ms` }}>
                  <span className="step-num">{i + 1}</span>
                  <h3>{t(title)}</h3>
                  <p>
                    <Rich text={t(body)} />
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-band">
          <div className="landing-inner">
            <h2 className="landing-section-title scroll-reveal">{t('landing.featuresTitle')}</h2>
            <div className="features-grid">
              {BASICS.map(({ icon: Icon, title, body }, i) => (
                <article key={title} className="feature scroll-reveal" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="feature-icon">
                    <Icon size={20} />
                  </div>
                  <h3>{t(title)}</h3>
                  <p>{t(body)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="ai" className="landing-band is-grey" aria-labelledby="landing-ai-title">
          <div className="landing-inner landing-split">
            <div className="scroll-reveal">
              <p className="landing-eyebrow">
                <Sparkles size={14} /> {t('landing.ai.eyebrow')}
              </p>
              <h2 id="landing-ai-title" className="landing-h2">
                {t('landing.ai.title')}
              </h2>
              <p className="landing-lede">{t('landing.ai.body')}</p>
              <ul className="landing-points">
                {AI_POINTS.map((key) => (
                  <li key={key}>
                    <span className="landing-check">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lai-card scroll-reveal" style={{ animationDelay: '120ms' }} aria-hidden>
              <div className="lai-head">
                <span className="lai-title">
                  <Sparkles size={15} /> {t('landing.ai.mockTitle')}
                </span>
                <span className="pill pill-failed">Failed</span>
              </div>
              <p className="lai-deploy">
                <span className="mono">#14</span> feat: 차트 추가
              </p>
              <p className="lai-summary">
                <Rich text={t('landing.ai.mockSummary')} />
              </p>
              <div className="lai-block">
                <div className="lai-block-head">
                  <span className="lai-label">{t('landing.ai.causeLabel')}</span>
                  <span className="lai-tag">{t('landing.ai.mockConfidence')}</span>
                </div>
                <p>{t('landing.ai.mockCause')}</p>
                <code className="lai-evidence">Error: Cannot find module &apos;chart.js&apos;</code>
              </div>
              <div className="lai-block">
                <div className="lai-block-head">
                  <span className="lai-label">{t('landing.ai.fixLabel')}</span>
                </div>
                <p>{t('landing.ai.mockFix')}</p>
              </div>
              <ol className="lai-flow">
                {AI_FLOW.map((key, i) => (
                  <li key={key} style={{ '--d': `${900 + i * 600}ms` } as CSSProperties}>
                    <span className="lai-dot">
                      <Check size={11} strokeWidth={3.5} />
                    </span>
                    <span className="lai-flow-label">{t(key)}</span>
                  </li>
                ))}
              </ol>
              <span className="lai-btn">
                <Wand2 size={16} /> {t('landing.ai.mockButton')}
              </span>
            </div>
          </div>
        </section>

        <section id="cli" className="landing-band" aria-labelledby="landing-cli-title">
          <div className="landing-inner">
            <div className="landing-split is-reverse">
              <div className="scroll-reveal">
                <p className="landing-eyebrow">
                  <Terminal size={14} /> {t('landing.cli.eyebrow')}
                </p>
                <h2 id="landing-cli-title" className="landing-h2">
                  {t('landing.cli.title')}
                </h2>
                <p className="landing-lede">
                  <Rich text={t('landing.cli.body')} />
                </p>
                <div className="landing-links">
                  <a href={CLI_RELEASES_URL} target="_blank" rel="noreferrer" className="landing-link">
                    {t('landing.cli.install')} <ArrowRight size={16} />
                  </a>
                  <span className="landing-note">{t('landing.cli.needs')}</span>
                </div>
              </div>

              <div className="term scroll-reveal" style={{ animationDelay: '120ms' }} aria-hidden>
                <div className="term-bar">
                  <span className="term-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="term-title">~/my-app</span>
                </div>
                <ul className="term-body">
                  {[
                    { kind: 'cmd', text: 'likelion login' },
                    { kind: 'ok', text: t('landing.cli.outLogin') },
                    { kind: 'cmd', text: 'likelion link' },
                    { kind: 'ok', text: t('landing.cli.outLink') },
                    { kind: 'cmd', text: 'likelion up' },
                    { kind: 'dim', text: t('landing.cli.outUpload') },
                    { kind: 'info', text: '● Building' },
                    { kind: 'ok', text: t('landing.logDeployed') },
                  ].map((line, i) => (
                    <li key={i} className={line.kind} style={{ '--d': `${500 + i * 380}ms` } as CSSProperties}>
                      {line.kind === 'cmd' && <span className="prompt">$</span>}
                      {line.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <ul className="cmd-grid">
              {CLI_COMMANDS.map(({ cmd, desc }, i) => (
                <li key={cmd} className="cmd-tile scroll-reveal" style={{ animationDelay: `${(i % 3) * 80}ms` }}>
                  <code>{cmd}</code>
                  <span>{t(desc)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="ops" className="landing-band is-grey" aria-labelledby="landing-ops-title">
          <div className="landing-inner">
            <div className="landing-head scroll-reveal">
              <p className="landing-eyebrow">
                <RotateCcw size={14} /> {t('landing.ops.eyebrow')}
              </p>
              <h2 id="landing-ops-title" className="landing-h2">
                {t('landing.ops.title')}
              </h2>
              <p className="landing-lede">{t('landing.ops.body')}</p>
            </div>

            <div className="bento">
              <article className="bento-card span-4 scroll-reveal">
                <h3>{t('landing.ops.rollback.title')}</h3>
                <p>
                  <Rich text={t('landing.ops.rollback.body')} />
                </p>
                <ul className="mini-list" aria-hidden>
                  <li>
                    <span className="mono mini-id">#13</span>
                    <span className="mini-msg">fix: 결제 오류</span>
                    <span className="pill pill-failed">Failed</span>
                  </li>
                  <li>
                    <span className="mono mini-id">#12</span>
                    <span className="mini-msg">feat: 로그인 개선</span>
                    <span className="pill pill-active">Active</span>
                  </li>
                  <li className="is-target">
                    <span className="mono mini-id">#11</span>
                    <span className="mini-msg">chore: 의존성 정리</span>
                    <span className="mini-btn">
                      <RotateCcw size={13} /> {t('landing.ops.rollbackBtn')}
                    </span>
                  </li>
                </ul>
              </article>

              <article className="bento-card span-2 scroll-reveal" style={{ animationDelay: '80ms' }}>
                <h3>{t('landing.ops.strategy.title')}</h3>
                <p>{t('landing.ops.strategy.body')}</p>
                <ul className="opt-list" aria-hidden>
                  {STRATEGIES.map((key, i) => (
                    <li key={key} className={i === 1 ? 'on' : undefined}>
                      <span className="opt-radio" />
                      {t(key)}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="bento-card span-2 scroll-reveal">
                <h3>{t('landing.ops.target.title')}</h3>
                <p>{t('landing.ops.target.body')}</p>
                <div className="target-grid" aria-hidden>
                  <div className="target-tile on">
                    <Cloud size={20} />
                    <b>AWS</b>
                  </div>
                  <div className="target-tile">
                    <Server size={20} />
                    <b>{t('landing.ops.onprem')}</b>
                  </div>
                </div>
              </article>

              <article className="bento-card span-4 scroll-reveal" style={{ animationDelay: '80ms' }}>
                <h3>{t('landing.ops.env.title')}</h3>
                <p>
                  <Rich text={t('landing.ops.env.body')} />
                </p>
                <div className="env-box" aria-hidden>
                  <div className="env-tags">
                    <span className="env-tag">
                      <KeyRound size={12} /> Raw Editor
                    </span>
                    <span className="env-tag mono">likelion env push</span>
                  </div>
                  <pre className="env-code">
                    <span className="k">DATABASE_URL</span>
                    <span className="eq">=</span>
                    <span className="v">&quot;postgres://••••••••&quot;</span>
                    {'\n'}
                    <span className="k">API_KEY</span>
                    <span className="eq">=</span>
                    <span className="v">&quot;••••••••&quot;</span>
                    {'\n'}
                    <span className="k">NODE_ENV</span>
                    <span className="eq">=</span>
                    <span className="v">&quot;production&quot;</span>
                  </pre>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-bottom scroll-reveal">
          <h2>{t('landing.bottomTitle')}</h2>
          <p>{t('landing.bottomBody')}</p>
          <div className="landing-actions is-center">
            {cta}
            <a href={CLI_RELEASES_URL} target="_blank" rel="noreferrer" className="landing-cta-ghost">
              <Terminal size={18} /> {t('landing.cli.install')}
            </a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">© LikeLion</footer>
    </div>
  );
}
