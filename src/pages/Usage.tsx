import { ChevronDown, ChevronLeft, ChevronRight, CircleArrowUp } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { projects, workspace, subscribeDemoProjects, getDemoRevision, type Project } from '../data/mock';
import '../styles/usage.css';

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

// Deterministic local fixtures approximate accumulated usage, not live billing data.
const RESOURCES = [
  { name: 'CPU', amount: .04, unit: 'vCPU', cost: '$0.0000', rate: '$0.000463 / vCPU / Minute' },
  { name: 'RAM', amount: 48.17, unit: 'GB', cost: '$0.0111', rate: '$0.000231 / GB / Minute' },
  { name: 'Network Egress', amount: 0, unit: 'GB', cost: '$0.0000', rate: '$0.05 / GB' },
  { name: 'Volume', amount: 0, unit: 'GB', cost: '$0.0000', rate: '$0.000003472 / GB / Minute' },
];
const TIMES = ['Sep 30 20:34', 'Sep 30 20:35', 'Sep 30 20:36', 'Sep 30 20:37', 'Sep 30 20:38', 'Sep 30 20:39', 'Oct 01 12:00', 'Oct 02 00:00'];
function UsageChart({ title, total, unit }: { title: string; total: number; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = [0, .025, .05, .08, .11, .15, .64, 1].map(f => f * total);
  const format = (value: number) => unit === '$' ? '$' + value.toFixed(4) : value.toFixed(2) + ' ' + unit;
  return <div className="usage-chart"><h3>{title}</h3><p className="usage-chart-caption">Minutely accumulated {unit === '$' ? 'cost' : 'usage'}</p>
    <svg viewBox="0 0 560 180" role="img" aria-label={title + ' accumulated chart'}>
      {[30, 87, 145].map(y => <line key={y} x1="30" x2="530" y1={y} y2={y} className="usage-chart-grid" />)}
      <polyline points={values.map((v, i) => `${30 + i * 500 / 7},${145 - (total ? v / total : 0) * 115}`).join(' ')} fill="none" stroke="#a777e8" strokeWidth="2" />
      {values.map((v, i) => <circle key={i} cx={30 + i * 500 / 7} cy={145 - (total ? v / total : 0) * 115} r={hover === i ? 5 : 3} fill="#a777e8" />)}
      <text x="30" y="173">Sep 30</text><text x="260" y="173">Oct 01</text><text x="487" y="173">Oct 02</text>
    </svg>
    <div className="usage-chart-targets">{values.map((v, i) => <button key={i} type="button" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => setHover(i)} aria-label={TIMES[i] + ': ' + format(v)} />)}</div>
    {hover !== null && <div className="usage-chart-tooltip" role="status"><span>{TIMES[hover]}</span><strong>{format(values[hover])}</strong></div>}
  </div>;
}
function ProjectUsage({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false);
  const [byService, setByService] = useState(false);
  const [servicesOpen, setServicesOpen] = useState<string[]>([]);
  const original = project.name === 'believable-playfulness';
  const cost = original ? '$0.0112' : '$0.0000';
  return <div className="usage-proj"><div className="usage-project-header">
    <Link to={`/project/${project.id}`} className="usage-proj-name">{project.name}<span className="usage-ext">↗</span></Link>
    {project.id.startsWith('demo-') && <span className="usage-simulated">Zero simulated usage</span>}
    <button className="usage-proj-btn usage-expand" type="button" aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} usage for ${project.name}`} onClick={() => setExpanded(!expanded)}><span><span className="usage-cost-label">Current Cost</span><span className="usage-cost">{cost}</span></span><ChevronDown size={16} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} /></button>
  </div>{expanded && <div className="usage-proj-detail">
    <div className="usage-detail-heading"><h3>{byService ? 'Cost by Service' : 'Project Cost'}</h3><button type="button" className="btn" onClick={() => setByService(!byService)}>{byService ? 'View Project Cost' : 'View Cost by Service'}</button></div>
    <p className="usage-chart-caption">Local mock data for Sep 30 to Oct 02. Not live account usage.</p>
    {byService ? <><div className="usage-resource-charts">{RESOURCES.map(r => <UsageChart key={r.name} title={r.name} total={original ? r.amount : 0} unit={r.unit} />)}</div>
      {project.services.map(service => {
        const recorded = original && !service.id.startsWith('demo-');
        const isOpen = servicesOpen.includes(service.id);
        return <div className="usage-service" key={service.id}>
          <div className="usage-service-heading"><Link to={`/project/${project.id}/service/${service.id}`}>{service.name} ↗</Link><span>{recorded ? cost : '$0.0000'}</span><button type="button" className="btn btn-icon-only" aria-label={`${isOpen ? 'Hide' : 'Show'} resource breakdown for ${service.name}`} aria-expanded={isOpen} onClick={() => setServicesOpen(isOpen ? servicesOpen.filter(id => id !== service.id) : [...servicesOpen, service.id])}><ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : undefined }} /></button></div>
          <div className="usage-service-summary">{RESOURCES.map(r => <span key={r.name}>{r.name} <strong>{recorded ? r.amount : 0} {r.unit}</strong> {recorded ? r.cost : '$0.0000'}</span>)}</div>
          {isOpen && <div className="usage-resource-table"><div className="usage-resource-table-head"><span>Resource</span><span>Accumulated usage</span><span>Rate</span><span>Cost</span></div>{RESOURCES.map(r => <div key={r.name}><span>{r.name}</span><span>{recorded ? r.amount : 0} {r.unit}</span><span>{r.rate}</span><span>{recorded ? r.cost : '$0.0000'}</span></div>)}<p>Displayed costs are rounded independently; total {recorded ? cost : '$0.0000'}.</p></div>}
        </div>;
      })}</> : <UsageChart title="Project Cost" total={original ? .0112 : 0} unit="$" />}
  </div>}</div>;
}

export function Usage() {
  useSyncExternalStore(subscribeDemoProjects, getDemoRevision, getDemoRevision);
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
                  {projects.filter(p => p.name === 'believable-playfulness' || p.id.startsWith('demo-')).map(p => <ProjectUsage key={p.id} project={p} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
