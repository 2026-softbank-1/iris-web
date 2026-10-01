import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LogoMark, RepoIcon } from '../components/brand';
import { useAuth } from '../auth/AuthContext';
import '../styles/auth.css';

export function AuthPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const start = () => { auth.login(); navigate('/dashboard'); };
  return <div className="auth-shell">
    <header className="auth-header"><Link to="/login" aria-label="LikeLion home"><LogoMark size={30} /></Link><span>LikeLion</span></header>
    <main className="auth-main"><div className="auth-card"><LogoMark size={44}/><h1>Start building on LikeLion</h1><p>Deploy your first project in minutes.</p>
      <button className="auth-provider" onClick={start}><RepoIcon size={20}/> Start with GitHub <ArrowRight size={16}/></button>
    </div></main>
  </div>;
}
