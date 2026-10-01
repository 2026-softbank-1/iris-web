import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Mail } from 'lucide-react';
import { LogoMark, RepoIcon } from '../components/brand';
import { useAuth } from '../auth/AuthContext';
import '../styles/auth.css';

export function AuthPage({ signup = false }: { signup?: boolean }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const finish = () => { if (signup) { auth.signup(); navigate('/onboarding'); } else { auth.login(); navigate('/dashboard'); } };
  if (auth.status === 'onboarding') return <Navigate to="/onboarding" replace />;
  return <div className="auth-shell">
    <header className="auth-header"><Link to="/login" aria-label="Railway home"><LogoMark size={30} /></Link><span>Railway <small className="auth-header-demo">LOCAL DEMO</small></span><Link to={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Sign up'} <ArrowRight size={14}/></Link></header>
    <main className="auth-main"><div className="auth-card"><LogoMark size={44}/><h1>{signup ? 'Start building on Railway' : 'Log in to Railway'}</h1><p>{signup ? 'Deploy your first project in minutes.' : 'Welcome back. Let’s get you building.'}</p>
      <button className="auth-provider" onClick={finish}><RepoIcon size={20}/> {signup ? 'Sign up' : 'Log in'} with GitHub <ArrowRight size={16}/></button>
      <button className="auth-provider" onClick={() => setEmailOpen(true)}><Mail size={20}/> {signup ? 'Sign up' : 'Log in'} with Email <ArrowRight size={16}/></button>
      {emailOpen && <form className="auth-email" onSubmit={(e) => { e.preventDefault(); finish(); }}><label htmlFor="demo-email">Email address</label><input id="demo-email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="off"/><button className="auth-primary" type="submit">Continue in demo <ArrowRight size={16}/></button></form>}
      <div className="auth-switch">{signup ? 'Already have an account?' : 'New to Railway?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Create an account'}</Link></div>
      <div className="auth-demo"><span>LOCAL DEMO</span><p>No real authentication. Provider buttons only simulate {signup ? 'signup' : 'login'}. Email is not saved or sent.</p></div>
    </div></main><footer className="auth-footer">Demo reconstruction. Login was unavailable in the authenticated reference session. <br/>No connection to Railway authentication services.</footer>
  </div>;
}
export function OnboardingPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('Personal projects');
  if (auth.status !== 'onboarding') return <Navigate to={auth.status === 'logged-out' ? '/login' : '/dashboard'} replace/>;
  return <div className="auth-shell"><header className="auth-header"><LogoMark size={30}/><span>Railway</span><button onClick={() => { auth.logout(); navigate('/login'); }}>Log out</button></header><main className="auth-main"><div className="auth-card onboarding-card"><div className="auth-demo-tag">DEMO ONBOARDING · UNOBSERVED</div><div className="auth-steps">{[0,1].map(n => <span key={n} className={step >= n ? 'active' : ''}>{step > n ? <Check size={14}/> : n + 1}</span>)}</div><h1>{step === 0 ? 'Welcome aboard' : 'Your workspace is ready'}</h1><p>{step === 0 ? 'Tell us a little about what you’re building.' : 'Everything you need to bring your next idea online.'}</p>{step === 0 ? <form onSubmit={e => {e.preventDefault(); setStep(1);}}><label htmlFor="demo-name">What should we call you?</label><input id="demo-name" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required maxLength={60}/><label htmlFor="demo-purpose">How will you use Railway?</label><select id="demo-purpose" value={purpose} onChange={e => setPurpose(e.target.value)}><option>Personal projects</option><option>Work / team projects</option><option>Learning and experimenting</option></select><button className="auth-primary">Continue <ArrowRight size={16}/></button></form> : <><div className="auth-workspace"><LogoMark size={28}/><div><strong>{name.trim() || 'Your'}’s workspace</strong><p>Preview only · {purpose}</p></div><Check size={18}/></div><button className="auth-primary" onClick={() => {auth.complete(); navigate('/dashboard');}}>Go to dashboard <ArrowRight size={16}/></button><button className="auth-back" onClick={() => setStep(0)}>Back</button></>}<div className="auth-demo"><p>This is a simulated setup, not an observed Railway screen. No account, payment, or workspace is created. Your answers are preview-only; the dashboard uses the existing dause demo workspace.</p></div></div></main></div>;
}
