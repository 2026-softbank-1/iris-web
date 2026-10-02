import { Copy, KeyRound, Plus } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useUI } from '../components/ui';

const TITLES: Record<string, string> = {
  domains: 'Domains',
  'audit-logs': 'Audit Logs',
  developer: 'Developer',
  'ssh-keys': 'SSH Keys',
  earnings: 'Earnings',
  referrals: 'Referrals',
};

function Empty({ title, desc, action }: { title: string; desc: string; action?: string }) {
  const { toast } = useUI();
  return (
    <div className="tpl-empty">
      <div className="tpl-empty-text">
        <p className="tpl-empty-title">{title}</p>
        <p className="tpl-empty-sub">{desc}</p>
      </div>
      {action && (
        <button type="button" className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => toast(`${action} is not available yet`)}>
          <Plus size={16} /> {action}
        </button>
      )}
    </div>
  );
}

export function WorkspaceSettings() {
  const { section = '' } = useParams();
  const { toast } = useUI();
  const title = TITLES[section] ?? 'Settings';

  return (
    <div className="page">
      <div className="page-inner">
        <div className="pg-head">
          <p className="page-title">{title}</p>
        </div>
        <div className="ws-set">
          {section === 'domains' && <Empty title="No domains yet" desc="Domains you buy or bring to this workspace show up here." action="Add domain" />}
          {section === 'audit-logs' && <Empty title="No audit events" desc="Changes made by people in this workspace will be listed here." />}
          {section === 'developer' && (
            <div className="ws-set-card">
              <p className="ws-set-label">Tokens</p>
              <p className="set-muted">Create tokens to use the public API from your own tools.</p>
              <div className="ws-set-row">
                <input className="input" placeholder="Token name" />
                <button type="button" className="btn btn-primary" onClick={() => toast('Token created (mock)')}>
                  <KeyRound size={16} /> Create
                </button>
              </div>
            </div>
          )}
          {section === 'ssh-keys' && <Empty title="No SSH keys" desc="Add a public key to open shells into your services." action="Add SSH key" />}
          {section === 'earnings' && <Empty title="No earnings yet" desc="Publish a template to start earning from its usage." />}
          {section === 'referrals' && (
            <div className="ws-set-card">
              <p className="ws-set-label">Your referral link</p>
              <div className="ws-set-row">
                <code className="set-code mono" style={{ flex: 1 }}>
                  https://likelion.uk?referralCode=dause
                </code>
                <button type="button" className="btn btn-outline btn-icon-only" aria-label="Copy" onClick={() => toast('Referral link copied')}>
                  <Copy size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
