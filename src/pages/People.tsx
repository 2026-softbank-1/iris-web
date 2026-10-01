import { CircleAlert, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Avatar, Dialog, useUI } from '../components/ui';
import { user } from '../data/mock';

export function People() {
  const { toast } = useUI();
  const [tab, setTab] = useState<'people' | 'security'>('people');
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const match = !q || user.name.includes(q) || user.email.includes(q);

  return (
    <div className="page">
      <div className="page-inner">
        <div className="people">
          <div className="pg-head">
            <p className="page-title">People</p>
          </div>
          <div className="people-body">
            <div className="people-tabs-row">
              <div role="tablist" aria-label="Access" className="people-tabs">
                <button type="button" role="tab" data-state={tab === 'people' ? 'active' : 'inactive'} onClick={() => setTab('people')}>
                  People <span className="people-count">1</span>
                </button>
                <button type="button" role="tab" data-state={tab === 'security' ? 'active' : 'inactive'} onClick={() => setTab('security')}>
                  Security
                </button>
              </div>
              <div className="people-actions">
                {searching ? (
                  <div className="people-search">
                    <Search size={14} />
                    <input autoFocus placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
                    <button
                      type="button"
                      aria-label="Close search"
                      onClick={() => {
                        setSearching(false);
                        setQ('');
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button type="button" aria-label="Search people" className="btn btn-outline btn-icon-only" onClick={() => setSearching(true)}>
                    <div className="tool-icon">
                      <Search size={16} />
                    </div>
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => setInviteOpen(true)}>
                  <div className="side-icon">
                    <Plus size={16} />
                  </div>
                  <span>Invite</span>
                </button>
              </div>
            </div>
            {tab === 'people' ? (
              <div role="tabpanel" className="people-table-wrap">
                <table className="people-table">
                  <thead>
                    <tr>
                      <th style={{ width: 254 }}>Person</th>
                      <th style={{ width: 285 }}>Role</th>
                      <th style={{ width: 130 }}>2FA</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {match ? (
                      <tr>
                        <td>
                          <div className="people-person">
                            <Avatar src={user.avatar} size={32} title={user.name} />
                            <div>
                              <p className="people-name">{user.name}</p>
                              <p className="people-email">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="people-role">Admin</p>
                        </td>
                        <td>
                          <span className="people-2fa">
                            <CircleAlert size={16} />
                            <p>Off</p>
                          </span>
                        </td>
                        <td />
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={4} className="people-none">
                          Nobody matches “{q}”
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div role="tabpanel" className="people-security">
                <div className="sec-row">
                  <div>
                    <p className="sec-title">Require two-factor authentication</p>
                    <p className="sec-desc">Members without 2FA will be asked to set it up before they can access this workspace.</p>
                  </div>
                  <button type="button" role="switch" aria-checked={false} className="switch" onClick={() => toast('Available on the Pro plan')} />
                </div>
                <div className="sec-row">
                  <div>
                    <p className="sec-title">SAML single sign-on</p>
                    <p className="sec-desc">Let people sign in through your identity provider.</p>
                  </div>
                  <span className="set-tag">Enterprise</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} className="dialog invite-dialog" label="Invite people">
        <p className="invite-title">Invite to workspace</p>
        <p className="invite-desc">Teammates get access to every project in this workspace.</p>
        <input className="input" autoFocus placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="invite-actions">
          <button type="button" className="btn btn-outline" onClick={() => setInviteOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!/^\S+@\S+\.\S+$/.test(email)}
            onClick={() => {
              setInviteOpen(false);
              toast(`Invite sent to ${email}`);
              setEmail('');
            }}
          >
            Send invite
          </button>
        </div>
      </Dialog>
    </div>
  );
}
