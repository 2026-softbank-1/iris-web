import { Box, Plus } from 'lucide-react';
import { useUI } from '../../components/ui';

export function Sandboxes() {
  const { setUpgradeOpen } = useUI();
  return (
    <div className="proj-page-region">
      <div className="proj-frame sandboxes">
        <div className="sb-empty">
          <div className="sb-icon">
            <Box size={22} />
          </div>
          <p className="obs-title">No sandboxes yet</p>
          <p className="obs-desc">Spin up short-lived, isolated environments to try changes without touching production.</p>
          <button type="button" className="btn btn-primary" onClick={() => setUpgradeOpen(true)}>
            <Plus size={16} /> New Sandbox
          </button>
        </div>
      </div>
    </div>
  );
}
