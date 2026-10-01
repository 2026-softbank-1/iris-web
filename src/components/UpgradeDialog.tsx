import { ExternalLink, FileText, Globe, Inbox, Server, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, useUI } from './ui';

const BENEFITS = [
  { icon: Server, text: 'Up to 48 vCPU / 48 GB RAM per service' },
  { icon: Server, text: 'Up to 6 replicas per service' },
  { icon: Server, text: '50 services per project' },
  { icon: FileText, text: '7-day log history' },
  { icon: Globe, text: 'Global regions' },
  { icon: Inbox, text: 'Community support' },
];

/** Original illustration: a vertical track with a glowing marker. */
function TrackArt() {
  return (
    <div className="up-art" aria-hidden>
      <div className="up-art-dots" />
      <div className="up-art-track" />
      <div className="up-art-glow" />
      <div className="up-art-marker">
        <span />
      </div>
      <div className="up-art-capsule">
        <span />
        <span />
        <span />
      </div>
      <p className="up-art-top">LIMIT REACHED</p>
      <div className="up-art-bottom">
        <p>NEXT STOP</p>
        <p>HOBBY PLAN</p>
      </div>
    </div>
  );
}

export function UpgradeDialog() {
  const { upgradeOpen, setUpgradeOpen } = useUI();
  const navigate = useNavigate();
  const close = () => setUpgradeOpen(false);
  return (
    <Dialog open={upgradeOpen} onClose={close} className="dialog up-dialog" label="Upgrade to create a new project">
      <button type="button" className="up-close" aria-label="Close" onClick={close}>
        <X size={16} />
      </button>
      <TrackArt />
      <div className="up-body">
        <h2 className="up-title">Upgrade to create a new project</h2>
        <p className="up-desc">You've hit the resource limit of the free trial. Upgrade your plan to provision more resources.</p>
        <p className="up-label">Hobby plan benefits</p>
        <ul className="up-list">
          {BENEFITS.map((b) => (
            <li key={b.text}>
              <b.icon size={16} />
              {b.text}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-primary up-cta"
          onClick={() => {
            close();
            navigate('/workspace/plans');
          }}
        >
          Upgrade to Hobby <ExternalLink size={16} />
        </button>
        <button
          type="button"
          className="up-sub"
          onClick={() => {
            close();
            navigate('/workspace/plans');
          }}
        >
          View Plans &amp; Pricing ↗
        </button>
      </div>
    </Dialog>
  );
}
