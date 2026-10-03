import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LogoMark, RepoIcon } from '../components/brand';
import { useAuth } from '../auth/AuthContext';
import '../styles/auth.css';

export function AuthPage() {
  const auth = useAuth();
  const [params] = useSearchParams();
  if (auth.status === 'authenticated') return <Navigate to="/dashboard" replace />;
  // 콜백이 실패하면 was 가 /login?error=<사유> 로 돌려보낸다.
  const callbackError = params.get('error');
  const notice = callbackError ? (callbackError === 'access_denied' ? 'GitHub sign-in was cancelled.' : 'GitHub sign-in failed. Please try again.') : auth.error;
  return <div className="auth-shell">
    <header className="auth-header"><Link to="/" aria-label="LikeLion home"><LogoMark size={30} /></Link><span>LikeLion</span></header>
    <main className="auth-main"><div className="auth-card"><LogoMark size={44}/><h1>LikeLion에서 시작해 보세요</h1><p>첫 프로젝트를 몇 분 만에 배포할 수 있어요.</p>
      {notice && <p className="auth-error" role="alert">{notice}</p>}
      <button className="auth-provider" onClick={auth.login} disabled={auth.status === 'loading'}><RepoIcon size={20}/> GitHub로 시작하기 <ArrowRight size={16}/></button>
    </div></main>
  </div>;
}
