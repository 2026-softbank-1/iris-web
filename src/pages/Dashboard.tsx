import { ChevronDown, CircleAlert, Folder, LayoutGrid, List, Plus, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreateDialog } from '../components/CreateDialog';
import { RepoIcon } from '../components/brand';
import { Popover, usePopover } from '../components/ui';
import { type Project } from '../data/mock';
import { useProjects } from '../data/ProjectsContext';
import { formatAgo, useI18n } from '../i18n';

type Sort = 'updatedAt' | 'createdAt' | 'alphabetical';

function projectSummary(p: Project) {
  // 서비스 수는 was 가 센 값을 쓰고, 상태는 서비스별 최근 배포(latestDeployment)로 센다.
  const total = p.serviceCount ?? p.services.length;
  const crashed = p.services.filter((s) => s.state === 'crashed').length;
  const online = p.services.filter((s) => s.state === 'online').length;
  return { total, crashed, online };
}

function StatusLine({ p }: { p: Project }) {
  const { t } = useI18n();
  const { total, crashed, online } = projectSummary(p);
  if (crashed > 0) {
    return (
      <div className="pc-status">
        <div className="pc-status-icon crashed">
          <CircleAlert size={16} />
        </div>
        <span className="crashed">{t('dash.crashedOf', { n: crashed, total })}</span>
      </div>
    );
  }
  return (
    <div className="pc-status">
      <div className="pc-status-row">
        <div className="pc-dot" />
        <span>{p.environment}</span>
        <span>·</span>
        <span>{t('dash.onlineOf', { n: online, total })}</span>
      </div>
    </div>
  );
}

function ProjectCard({ p, fav, onFav }: { p: Project; fav: boolean; onFav: () => void }) {
  const { t } = useI18n();
  return (
    <div className="pc">
      <Link to={`/project/${p.id}`} className="pc-link">
        <span className="sr-only">{t('dash.viewProject')}</span>
      </Link>
      <div className="pc-body">
        <div className="pc-head">
          <div className="pc-head-row">
            <span className="pc-name truncate">{p.name}</span>
            <div className="pc-fav-wrap">
              <button
                type="button"
                aria-label={t(fav ? 'dash.favRemove' : 'dash.favAdd')}
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
  const { t, lang } = useI18n();
  const { total, crashed, online } = projectSummary(p);
  return (
    <Link to={`/project/${p.id}`} className="pl-row">
      <div className="pl-tile">
        <RepoIcon size={18} />
      </div>
      <div className="pl-main">
        <span className="pl-name">{p.name}</span>
        <span className="pl-sub">
          {t(p.services.length === 1 ? 'dash.serviceOne' : 'dash.serviceOther', { n: p.services.length })} · {t('dash.updated', { ago: formatAgo(p.updatedAt, lang) })}
        </span>
      </div>
      {crashed > 0 ? (
        <span className="pl-state crashed">
          <CircleAlert size={14} /> {t('dash.crashedOf', { n: crashed, total })}
        </span>
      ) : (
        <span className="pl-state">
          <span className="pc-dot" /> {p.environment} · {t('dash.onlineOf', { n: online, total })}
        </span>
      )}
    </Link>
  );
}

export function Dashboard() {
  const { t } = useI18n();
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
          <h1 className="page-title dash-h1">{t('dash.title')}</h1>
          <div>
            <button type="button" className="btn btn-primary dash-new" onClick={() => setCreateOpen(true)}>
              <div className="side-icon">
                <Plus size={16} strokeWidth={2.25} />
              </div>
              <span>{t('dash.new')}</span>
            </button>
          </div>
        </div>

        <div className="dash-grid">
          <div className="dash-filters">
            <div className="dash-filters-left">
              <div className="dash-count-wrap">
                <button type="button" className="dash-count" onClick={(e) => filterPop.toggle(e.currentTarget)}>
                  <div className="side-icon dash-count-icon">
                    <LayoutGrid size={16} />
                  </div>
                  {t('dash.count', { n: status === 'ready' ? list.length : '–' })}
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
                  <Folder size={16} className="menu-icon" /> {t('dash.all')}
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
                  <Star size={16} className="menu-icon" /> {t('dash.favorites')}
                </button>
              </Popover>
              <div className="dash-vsep" />
              <div className="dash-sort">
                <label htmlFor="project-sort" className="sr-only">
                  {t('dash.sort')}
                </label>
                <div className="dash-sort-box">
                  <select id="project-sort" aria-label={t('dash.sort')} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                    <option value="updatedAt">{t('dash.sort.updated')}</option>
                    <option value="createdAt">{t('dash.sort.created')}</option>
                    <option value="alphabetical">{t('dash.sort.alpha')}</option>
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
              <div role="group" aria-label={t('dash.view')} className="view-toggle">
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
              <p>{t('dash.loadError')}</p>
              <span>{error}</span>
              <button type="button" className="btn btn-secondary" onClick={() => void reload()}>
                {t('dash.retry')}
              </button>
            </div>
          ) : status !== 'ready' ? (
            <div className="dash-empty" role="status">
              <p>{t('dash.loading')}</p>
            </div>
          ) : list.length === 0 ? (
            <div className="dash-empty">
              {filter === 'favorites' ? (
                <>
                  <p>{t('dash.noFavTitle')}</p>
                  <span>{t('dash.noFavBody')}</span>
                </>
              ) : (
                <>
                  <p>{t('dash.emptyTitle')}</p>
                  <span>{t('dash.emptyBody')}</span>
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
          {t('dash.templates')}
        </button>
      </div>
    </div>
  );
}
