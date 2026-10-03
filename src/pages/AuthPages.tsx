import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LogoMark, RepoIcon } from '../components/brand';
import { useAuth } from '../auth/AuthContext';
import { LanguageButton } from '../components/LanguageButton';
import { useI18n } from '../i18n';
import '../styles/auth.css';

export function AuthPage() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const { t } = useI18n();
  if (auth.status === 'authenticated') return <Navigate to="/dashboard" replace />;
  // 콜백이 실패하면 was 가 /login?error=<사유> 로 돌려보낸다.
  const callbackError = params.get('error');
  // AuthContext 의 오류는 서버 연결 실패 하나뿐이라 문구는 여기서 고른다.
  const notice = callbackError ? t(callbackError === 'access_denied' ? 'auth.cancelled' : 'auth.failed') : auth.error && t('auth.unreachable');
  return <div className="auth-shell">
    <header className="auth-header"><Link to="/" aria-label="LikeLion home"><LogoMark size={30} /></Link><span>LikeLion</span><span className="auth-lang"><LanguageButton /></span></header>
    <main className="auth-main"><div className="auth-card"><LogoMark size={44}/><h1>{t('auth.title')}</h1><p>{t('auth.subtitle')}</p>
      {notice && <p className="auth-error" role="alert">{notice}</p>}
      <button className="auth-provider" onClick={auth.login} disabled={auth.status === 'loading'}><RepoIcon size={20}/> {t('landing.start')} <ArrowRight size={16}/></button>
    </div></main>
  </div>;
}
