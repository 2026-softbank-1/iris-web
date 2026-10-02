import { ChevronDown, CircleAlert, Folder, LayoutGrid, List, Plus, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreateDialog } from '../components/CreateDialog';
import { RepoIcon } from '../components/brand';
import { Popover, usePopover, useUI } from '../components/ui';
import { timeAgo, type Project } from '../data/mock';
import { useProjects } from '../data/ProjectsContext';

type Sort = 'updatedAt' | 'createdAt' | 'alphabetical';

function projectSummary(p: Project) {
  // 서비스 수는 was 가 센 값을 쓰고, 상태는 서비스별 최근 배포(latestDeployment)로 센다.
  const total = p.serviceCount ?? p.services.length;
  const crashed = p.services.filter((s) => s.state === 'crashed').length;
  const online = p.services.filter((s) => s.state === 'online').length;
  return { total, crashed, online };
}

function StatusLine({ p }: { p: Project }) {
  const { total, crashed, online } = projectSummary(p);
  if (crashed > 0) {
    return (
      <div className="pc-status">
        <div className="pc-status-icon crashed">
          <CircleAlert size={16} />
        </div>
        <span className="crashed">
          {crashed}/{total} service crashed
        </span>
      </div>
    );
  }
  return (
    <div className="pc-status">
      <div className="pc-status-row">
        <div className="pc-dot" />
        <span>{p.environment}</span>
        <span>·</span>
        <span>
          {online}/{total} service online
        </span>
      </div>
    </div>
  );
}

function ProjectCard({ p, fav, onFav }: { p: Project; fav: boolean; onFav: () => void }) {
  return (
    <div className="pc">
      <Link to={`/project/${p.id}`} className="pc-link">
        <span className="sr-only">View Project</span>
      </Link>
      <div className="pc-body">
        <div className="pc-head">
          <div className="pc-head-row">
            <span className="pc-name truncate">{p.name}</span>
            <div className="pc-fav-wrap">
              <button
                type="button"
                aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
                className={`pc-fav${fav ? ' on' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onFav();
                }}
              >
                <div className="side-icon">
                  <Star size={16} fill={fav ? 'currentColor' : 'none'} />
                </div>
              </button>
            </div>
          </div>
        </div>
        <div className="pc-preview-wrap">
          <div className="pc-preview">
            <div className="pc-tiles">
              {p.services.map((s) => (
                <Link key={s.id} to={`/project/${p.id}/service/${s.id}`} className="pc-tile-link" title={s.name}>
                  <div className="pc-tile">
                    <RepoIcon size={20} />
                  </div>
                </Link>
              ))}
            </div>
            <StatusLine p={p} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectRow({ p }: { p: Project }) {
  const { total, crashed, online } = projectSummary(p);
  return (
    <Link to={`/project/${p.id}`} className="pl-row">
      <div className="pl-tile">
        <RepoIcon size={18} />
      </div>
      <div className="pl-main">
        <span className="pl-name">{p.name}</span>
        <span className="pl-sub">
          {p.services.length} service{p.services.length === 1 ? '' : 's'} · updated {timeAgo(p.updatedAt)}
        </span>
      </div>
      {crashed > 0 ? (
        <span className="pl-state crashed">
          <CircleAlert size={14} /> {crashed} / {total} crashed
        </span>
      ) : (
        <span className="pl-state">
          <span className="pc-dot" /> {p.environment} · {online} / {total} online
        </span>
      )}
    </Link>
  );
}

export function Dashboard() {
  const { setUpgradeOpen } = useUI();
  const { status, error, projects, reload } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const [sort, setSort] = useState<Sort>('updatedAt');
  const [view, setView] = useState<'grid' | 'list'>(() => (localStorage.getItem('ll:view') as 'grid' | 'list') || 'grid');
  const [favs, setFavs] = useState<string[]>(() => JSON.parse(localStorage.getItem('ll:favs') || '[]'));
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const filterPop = usePopover();
  const navigate = useNavigate();

  const toggleFav = (id: string) => {
    setFavs((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      localStorage.setItem('ll:favs', JSON.stringify(next));
      return next;
    });
  };

  const list = useMemo(() => {
    let arr = [...projects];
    if (filter === 'favorites') arr = arr.filter((p) => favs.includes(p.id));
    if (sort === 'alphabetical') arr.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'createdAt') arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (sort === 'updatedAt') arr.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    // favorites float to the top like the original
    arr.sort((a, b) => Number(favs.includes(b.id)) - Number(favs.includes(a.id)));
    return arr;
  }, [sort, favs, filter, projects]);

  const setViewPersist = (v: 'grid' | 'list') => {
    setView(v);
    localStorage.setItem('ll:view', v);
  };

  return (
    <div className="page">
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <div className="page-inner">
        <div className="dash-title-row">
          <h1 className="page-title dash-h1">Projects</h1>
          <div>
            <button type="button" className="btn btn-primary dash-new" onClick={() => localStorage.getItem('ll:plan-limit') === '1' ? setUpgradeOpen(true) : setCreateOpen(true)}>
              <div className="side-icon">
                <Plus size={16} strokeWidth={2.25} />
              </div>
              <span>New</span>
            </button>
          </div>
        </div>

        {localStorage.getItem('ll:plan-limit') === '1' && <button className="btn btn-secondary" onClick={() => setCreateOpen(true)}>Continue</button>}
        <div className="dash-grid">
          <div className="dash-filters">
            <div className="dash-filters-left">
              <div className="dash-count-wrap">
                <button type="button" className="dash-count" onClick={(e) => filterPop.toggle(e.currentTarget)}>
                  <div className="side-icon dash-count-icon">
                    <LayoutGrid size={16} />
                  </div>
                  {status === 'ready' ? list.length : '–'} Projects
                </button>
              </div>
              <Popover anchor={filterPop.anchor} onClose={filterPop.close} width={200}>
                <button
                  type="button"
                  className="menu-item"
                  data-active={filter === 'all'}
                  onClick={() => {
                    setFilter('all');
                    filterPop.close();
                  }}
                >
                  <Folder size={16} className="menu-icon" /> All Projects
                </button>
                <button
                  type="button"
                  className="menu-item"
                  data-active={filter === 'favorites'}
                  onClick={() => {
                    setFilter('favorites');
                    filterPop.close();
                  }}
                >
                  <Star size={16} className="menu-icon" /> Favorites
                </button>
              </Popover>
              <div className="dash-vsep" />
              <div className="dash-sort">
                <label htmlFor="project-sort" className="sr-only">
                  Project sort
                </label>
                <div className="dash-sort-box">
                  <select id="project-sort" aria-label="Project sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                    <option value="updatedAt">Sort By: Recent Activity</option>
                    <option value="createdAt">Sort By: Creation Date</option>
                    <option value="alphabetical">Sort By: Alphabetical</option>
                  </select>
                  <div className="dash-sort-chevron">
                    <div className="side-icon">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="dash-view">
              <div role="group" aria-label="View display" className="view-toggle">
                <button type="button" role="radio" aria-checked={view === 'grid'} data-state={view === 'grid' ? 'on' : 'off'} onClick={() => setViewPersist('grid')}>
                  {view === 'grid' && <div className="view-thumb" />}
                  <div className="view-icon">
                    <LayoutGrid size={16} />
                  </div>
                </button>
                <button type="button" role="radio" aria-checked={view === 'list'} data-state={view === 'list' ? 'on' : 'off'} onClick={() => setViewPersist('list')}>
                  {view === 'list' && <div className="view-thumb" />}
                  <div className="view-icon">
                    <List size={16} />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {status === 'error' ? (
            <div className="dash-empty" role="alert">
              <p>Couldn't load projects</p>
              <span>{error}</span>
              <button type="button" className="btn btn-secondary" onClick={() => void reload()}>
                Retry
              </button>
            </div>
          ) : status !== 'ready' ? (
            <div className="dash-empty" role="status">
              <p>Loading projects…</p>
            </div>
          ) : list.length === 0 ? (
            <div className="dash-empty">
              {filter === 'favorites' ? (
                <>
                  <p>No favorite projects yet</p>
                  <span>Star a project to pin it here.</span>
                </>
              ) : (
                <>
                  <p>No projects yet</p>
                  <span>Create a project from a GitHub repository to get started.</span>
                </>
              )}
            </div>
          ) : view === 'grid' ? (
            <div className="pc-grid">
              {list.map((p) => (
                <ProjectCard key={p.id} p={p} fav={favs.includes(p.id)} onFav={() => toggleFav(p.id)} />
              ))}
            </div>
          ) : (
            <div className="pl-list">
              {list.map((p) => (
                <ProjectRow key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
        <button type="button" className="sr-only" onClick={() => navigate('/workspace/templates')}>
          Browse templates
        </button>
      </div>
    </div>
  );
}
