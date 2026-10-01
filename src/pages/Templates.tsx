import { PanelsTopLeft, Plus } from 'lucide-react';
import { useUI } from '../components/ui';

export function Templates() {
  const { setUpgradeOpen } = useUI();
  return (
    <div className="page">
      <div className="page-inner">
        <div className="pg-head">
          <p className="page-title">Templates</p>
          <button type="button" className="btn btn-primary dash-new" onClick={() => setUpgradeOpen(true)}>
            <div className="side-icon">
              <Plus size={16} strokeWidth={2.25} />
            </div>
            <span>New</span>
          </button>
        </div>
        <div className="tpl-body">
          <div className="tpl-sub">
            <p>
              Publish, edit and manage the templates you own.{' '}
              <a href="https://docs.railway.com" target="_blank" rel="noreferrer">
                Learn more <span>↗</span>
              </a>
            </p>
          </div>
          <div className="tpl-empty">
            <div className="tool-icon">
              <PanelsTopLeft size={24} />
            </div>
            <div className="tpl-empty-text">
              <p className="tpl-empty-title">No templates found</p>
              <p className="tpl-empty-sub">
                You haven't made any templates yet. Click{' '}
                <button type="button" onClick={() => setUpgradeOpen(true)}>
                  here
                </button>{' '}
                to start your first one.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
