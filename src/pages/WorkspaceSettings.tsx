import { Check, Copy, KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Avatar, useUI } from '../components/ui';
import { user, workspace } from '../data/mock';

const TITLES: Record<string, string> = {
  '': 'General',
  plans: 'Plans',
  billing: 'Billing',
  domains: 'Domains',
  'audit-logs': 'Audit Logs',
  developer: 'Developer',
  'ssh-keys': 'SSH Keys',
  earnings: 'Earnings',
  referrals: 'Referrals',
};

const PLANS = [
  { name: 'Trial', price: '$0', note: 'One-time $5 credit grant', features: ['1 GB RAM / 2 vCPU per service', '1 replica per service', 'Community support'], current: true },
  { name: 'Hobby', price: '$5 / month', note: 'Includes $5 of usage', features: ['Up to 48 GB RAM / 48 vCPU', 'Up to 6 replicas', '7-day log history', 'Global regions'] },
  { name: 'Pro', price: '$20 / seat', note: 'Usage billed on top', features: ['Up to 1 TB RAM / 1000 vCPU', 'Multi-region replicas', '30-day log history', 'Priority support'] },
];

function Empty({ title, desc, action }: { title: string; desc: string; action?: string }) {
  const { toast } = useUI();
  return (
    <div className="tpl-empty">
      <div className="tpl-empty-text">
        <p className="tpl-empty-title">{title}</p>
        <p className="tpl-empty-sub">{desc}</p>
      </div>
      {action && (
        <button type="button" className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => toast(`${action} is mocked in this clone`)}>
          <Plus size={16} /> {action}
        </button>
      )}
    </div>
  );
}

export function WorkspaceSettings() {
  const { section = '' } = useParams();
  const { toast } = useUI();
  const [name, setName] = useState(workspace.name);
  const title = TITLES[section] ?? 'Settings';

  return (
    <div className="page">
      <div className="page-inner">
        <div className="pg-head">
          <p className="page-title">{title}</p>
        </div>
        <div className="ws-set">
          {section === '' && (
            <>
              <div className="ws-set-card">
                <p className="ws-set-label">Workspace Name</p>
                <div className="ws-set-row">
                  <Avatar src={user.avatar} size={32} title={workspace.name} />
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                  <button type="button" className="btn btn-primary" disabled={name === workspace.name} onClick={() => toast('Workspace renamed (mock)')}>
                    Update
                  </button>
                </div>
              </div>
              <div className="ws-set-card">
                <p className="ws-set-label">Workspace ID</p>
                <div className="ws-set-row">
                  <code className="set-code mono" style={{ flex: 1 }}>
                    b2f0c3a1-7e4d-4c8e-9a51-3d2f6b1e8c07
                  </code>
                  <button type="button" className="btn btn-outline btn-icon-only" aria-label="Copy" onClick={() => toast('Copied')}>
                    <Copy size={16} />
                  </button>
                </div>
              </div>
              <div className="ws-set-card danger">
                <p className="ws-set-label">Danger zone</p>
                <p className="set-muted">Deleting a workspace removes all of its projects. This can't be undone.</p>
                <button type="button" className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => toast('Deleting is disabled in the clone')}>
                  Delete workspace
                </button>
              </div>
            </>
          )}
          {section === 'plans' && (
            <div className="plans">
              {PLANS.map((p) => (
                <div key={p.name} className={`plan${p.current ? ' current' : ''}`}>
                  <p className="plan-name">{p.name}</p>
                  <p className="plan-price">{p.price}</p>
                  <p className="set-muted">{p.note}</p>
                  <ul>
                    {p.features.map((f) => (
                      <li key={f}>
                        <Check size={14} /> {f}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={`btn ${p.current ? 'btn-outline' : 'btn-primary'}`} disabled={p.current} onClick={() => toast(`Checkout for ${p.name} is mocked`)}>
                    {p.current ? 'Current plan' : `Upgrade to ${p.name}`}
                  </button>
                </div>
              ))}
            </div>
          )}
          {section === 'billing' && <Empty title="No billing information" desc="Add a payment method when you pick a plan." action="Add payment method" />}
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
