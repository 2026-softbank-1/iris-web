import { ChevronDown, ChevronLeft, ChevronRight, CircleArrowUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { projects, workspace } from '../data/mock';

const LINES = [
  { name: 'Memory', usage: '44.08 minutely GB', price: '$0.000231 / GB / Minute', cost: '$0.0102' },
  { name: 'CPU', usage: '0.04 minutely vCPU', price: '$0.000463 / vCPU / Minute', cost: '$0.0000' },
  { name: 'Egress', usage: '0.00 GB', price: '$0.05 GB', cost: '$0.0000' },
];

function Stairs() {
  // decorative ascending steps (original artwork)
  const steps = Array.from({ length: 16 }, (_, i) => i);
  return (
    <svg className="usage-stairs" width="600" height="180" viewBox="0 0 600 180" aria-hidden>
      <defs>
        <linearGradient id="stairs-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#853bce" stopOpacity="0" />
          <stop offset="0.55" stopColor="#853bce" stopOpacity="0.22" />
          <stop offset="1" stopColor="#853bce" stopOpacity="0" />
        </linearGradient>
      </defs>
      {steps.map((i) => {
        const h = 6 + Math.pow(i / 15, 2.2) * 168;
        return <rect key={i} x={i * 20} y={180 - h} width={20} height={h} fill="url(#stairs-fade)" />;
      })}
    </svg>
  );
}

const PROJECT_COSTS: Record<string, string> = { 'believable-playfulness': '$0.0109' };

export function Usage() {
  const [open, setOpen] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState(false);
  return (
    <div className="page">
      <div className="page-inner">
        <div className="usage">
          <div className="pg-head">
            <p className="page-title">Usage</p>
            <div className="usage-range">
              <button type="button" title="Previous month" className="btn btn-icon-only usage-arrow" disabled>
                <div className="tool-icon">
                  <ChevronLeft size={16} />
                </div>
              </button>
              <span>Sep 30 - Oct 2</span>
              <button type="button" title="Next Month" className="btn btn-icon-only usage-arrow" disabled>
                <div className="tool-icon">
                  <ChevronRight size={16} />
                </div>
              </button>
            </div>
          </div>
          <hr className="usage-hr" />
          <div className="usage-body">
            <div className="usage-title-row">
              <h1 className="usage-h1">Sep 30 to Oct 02 Credit Usage</h1>
            </div>
            <div className="usage-stack">
              <div className="usage-card" onClick={() => setBreakdown((v) => !v)} title={breakdown ? 'Hide bill breakdown' : 'Show bill breakdown'}>
                <div className="usage-grid">
                  <div className="usage-rows">
                    <div className="usage-row">
                      <p>Current Usage</p>
                      <p>$0.01</p>
                    </div>
                    <div className="usage-row">
                      <p>Discounts</p>
                      <p>$0.00</p>
                    </div>
                    <div className="usage-row">
                      <p>Credits Used</p>
                      <p>$0.00</p>
                    </div>
                    <div className="usage-row">
                      <p>Estimated Month's Cost</p>
                      <p>$0.00</p>
                    </div>
                  </div>
                  <div className="usage-tiles">
                    <div className="usage-tile">
                      <p>Credits Available</p>
                      <p className="usage-big">{workspace.creditsGranted}</p>
                    </div>
                    <div className="usage-tile green">
                      <p>Est Credits Required</p>
                      <p className="usage-big">$ 0.00</p>
                    </div>
                  </div>
                </div>
                <div className={`usage-breakdown${breakdown ? ' open' : ''}`}>
                  <p className="usage-bd-title">Bill Breakdown</p>
                  <div className="usage-bd-lines">
                    {LINES.map((l) => (
                      <div key={l.name} className="usage-bd-line">
                        <p>{l.name}</p>
                        <p className="muted">{l.usage}</p>
                        <p className="muted">{l.price}</p>
                        <p className="right">{l.cost}</p>
                      </div>
                    ))}
                  </div>
                  <div className="usage-bd-sum">
                    <div className="usage-bd-sumrow">
                      <p>Subtotal</p>
                      <p>$0.01</p>
                    </div>
                    <div className="usage-bd-sumrow purple">
                      <p>Credits Available</p>
                      <p>-{workspace.creditsGranted}</p>
                    </div>
                    <div className="usage-bd-total">
                      <p>Current Bill</p>
                      <p>$0.00</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="usage-plan">
                <Stairs />
                <div className="usage-plan-left">
                  <p>Trial Plan</p>
                </div>
                <div className="usage-plan-right">
                  <p>Your trial includes a one-time $5.00 credit grant, with 1 GB of RAM, 2 vCPU and 1 GB of disk per service. Need more?</p>
                  <Link to="/workspace/plans" className="btn btn-primary usage-unlock">
                    <span>
                      <div className="usage-unlock-inner">
                        <CircleArrowUp size={20} />
                        <p>Unlock Hobby Plan</p>
                      </div>
                    </span>
                  </Link>
                </div>
              </div>

              <div className="usage-projects">
                <h2 className="usage-h1">Usage by Project</h2>
                <div className="usage-plist">
                  {projects.filter((p) => PROJECT_COSTS[p.name]).map((p, i) => (
                    <div key={p.id} className="usage-proj">
                      <button type="button" className="usage-proj-btn" onClick={() => setOpen(open === p.id ? null : p.id)}>
                        <Link to={`/project/${p.id}`} className="usage-proj-name" onClick={(e) => e.stopPropagation()}>
                          <span>{p.name}</span>
                          <span className="usage-ext">↗</span>
                        </Link>
                        <div className="usage-proj-right">
                          <div>
                            <p className="usage-cost-label">Current Cost</p>
                            <p className="usage-cost">{PROJECT_COSTS[p.name]}</p>
                          </div>
                          <div className="tool-icon">
                            <ChevronDown size={16} style={{ transform: open === p.id ? 'rotate(180deg)' : undefined }} />
                          </div>
                        </div>
                      </button>
                      {open === p.id && (
                        <div className="usage-proj-detail">
                          {p.services.map((s) => (
                            <div key={s.id} className="usage-bd-line">
                              <p>{s.name}</p>
                              <p className="muted">Memory · CPU · Egress</p>
                              <p className="muted">{s.state === 'online' ? 'running' : 'stopped'}</p>
                              <p className="right">{i === 0 ? PROJECT_COSTS[p.name] : '$0.0000'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
