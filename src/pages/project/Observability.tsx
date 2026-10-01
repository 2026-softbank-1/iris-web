import { Clock, Pause, Play, SquarePlus, X } from 'lucide-react';
import { useState } from 'react';

function MiniBars({ seed }: { seed: number }) {
  const bars = Array.from({ length: 22 }, (_, i) => 3 + Math.abs(Math.sin(i * 1.3 + seed) * 18 + Math.cos(i * 0.7 * seed) * 6));
  return (
    <div className="obs-mini">
      <div className="obs-mini-title" style={{ width: 22 + seed * 6 }} />
      <div className="obs-mini-line" />
      <div className="obs-mini-bars">
        {bars.map((h, i) => (
          <span key={i} style={{ height: Math.min(h, 26) }} />
        ))}
      </div>
    </div>
  );
}

type Block = { id: number; title: string; kind: 'cpu' | 'memory' | 'logs' | 'network' };

export function Observability() {
  const [live, setLive] = useState(true);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const addDashboard = () =>
    setBlocks([
      { id: 1, title: 'CPU usage', kind: 'cpu' },
      { id: 2, title: 'Memory usage', kind: 'memory' },
      { id: 3, title: 'Network egress', kind: 'network' },
      { id: 4, title: 'Error logs', kind: 'logs' },
    ]);
  const addOne = () => setBlocks((b) => [...b, { id: Date.now(), title: `Block ${b.length + 1}`, kind: 'cpu' }]);

  return (
    <div className="proj-page-region">
      <div className="proj-frame obs">
        <div className="obs-bar">
          <button type="button" className="btn btn-outline" onClick={addOne}>
            <div className="tool-icon">
              <SquarePlus size={16} />
            </div>
            <span>Add block</span>
          </button>
          <div className="obs-bar-right">
            <button type="button" className="btn btn-outline">
              <div className="tool-icon">
                <Clock size={16} />
              </div>
              <span>Last 15 min</span>
            </button>
            <button type="button" className={`btn btn-icon-only live-btn${live ? '' : ' paused'}`} onClick={() => setLive((v) => !v)} title="Pause live updates">
              <div className="tool-icon">{live ? <Pause size={16} /> : <Play size={16} />}</div>
            </button>
          </div>
        </div>
        <div className="obs-board">
          {blocks.length === 0 ? (
            <div className="obs-empty">
              <div className="obs-art">
                <MiniBars seed={1} />
                <MiniBars seed={2} />
                <MiniBars seed={3} />
                <MiniBars seed={4} />
              </div>
              <p className="obs-title">Observe this environment</p>
              <p className="obs-desc">Build dashboards from usage, resource metrics and log queries for this environment.</p>
              <button type="button" className="btn btn-outline obs-btn" onClick={addOne}>
                Add new item
              </button>
              <button type="button" className="btn btn-primary obs-btn" onClick={addDashboard}>
                Start with a simple dashboard
              </button>
            </div>
          ) : (
            <div className="obs-grid">
              {blocks.map((b, i) => (
                <div key={b.id} className="metric-card obs-block">
                  <div className="metric-head">
                    <p className="metric-title">{b.title}</p>
                    <button type="button" className="icon-btn" aria-label="Remove block" onClick={() => setBlocks((all) => all.filter((x) => x.id !== b.id))}>
                      <X size={14} />
                    </button>
                  </div>
                  <MiniBars seed={i + 1} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
