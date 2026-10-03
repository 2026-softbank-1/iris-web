import {
  ArrowRight,
  Box,
  Clock,
  FolderKanban,
  Globe,
  LayoutTemplate,
  Palette,
  Plus,
  Search,
  // ChartNoAxesColumn, // Usage command (disabled for now)
  User,
  Wrench,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../data/ProjectsContext';
import { toggleTheme } from '../lib/theme';
import { CreateDialog } from './CreateDialog';
import { Dialog, useUI } from './ui';

interface Cmd {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  shortcut?: string[];
  run: () => void;
  keywords?: string;
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, toast } = useUI();
  const { projects } = useProjects();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K toggles the palette anywhere in the app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, setPaletteOpen]);

  useEffect(() => {
    if (paletteOpen) {
      setQ('');
      setIdx(0);
    }
  }, [paletteOpen]);

  const close = () => setPaletteOpen(false);
  const go = (to: string) => () => {
    close();
    navigate(to);
  };

  const base: Cmd[] = useMemo(
    () => [
      { id: 'new-project', label: 'New Project', icon: Plus, group: 'Dashboard', shortcut: ['⌘', '/'], run: () => (close(), setCreateOpen(true)) },
      { id: 'new-ws', label: 'New Workspace', icon: Briefcase, group: 'Dashboard', run: () => (close(), toast('Workspaces are not available yet')) },
      { id: 'templates', label: 'Go to Templates', icon: LayoutTemplate, group: 'General', run: go('/workspace/templates') },
      // Usage is disabled for now (non-MVP)
      // { id: 'usage', label: 'Go to Usage', icon: ChartNoAxesColumn, group: 'General', run: go('/workspace/usage') },
      { id: 'search-projects', label: 'Search Projects...', icon: FolderKanban, group: 'General', run: () => setQ('project ') },
      { id: 'search-services', label: 'Search Services...', icon: Box, group: 'General', run: () => setQ('service ') },
      { id: 'account', label: 'Account', icon: User, group: 'General', run: () => (close(), toast('Account settings are not available yet')) },
      { id: 'theme', label: 'Change theme', icon: Palette, group: 'General', run: () => (close(), toggleTheme()) },
      { id: 'utils', label: 'Utilities', icon: Wrench, group: 'General', run: () => (close(), toast('Utilities are not available yet')) },
      { id: 'region', label: 'Update Preferred Region', icon: Globe, group: 'General', run: () => (close(), toast('Preferred region: US West')) },
      { id: 'time', label: 'Time', icon: Clock, group: 'Internationalization', run: () => (close(), toast('Times are shown in GMT+9')) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const items: Cmd[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return base;
    const projectMode = query.startsWith('project');
    const serviceMode = query.startsWith('service');
    const term = query.replace(/^(project|service)s?\s*/, '');
    const out: Cmd[] = [];
    if (!serviceMode) {
      for (const p of projects) {
        if (!term || p.name.toLowerCase().includes(term))
          out.push({ id: 'p-' + p.id, label: p.name, icon: FolderKanban, group: 'Projects', run: go(`/project/${p.id}`) });
      }
    }
    if (!projectMode) {
      for (const p of projects)
        for (const s of p.services)
          if (!term || s.name.toLowerCase().includes(term))
            out.push({ id: 's-' + s.id, label: `${s.name}`, icon: Box, group: `Services`, keywords: p.name, run: go(`/project/${p.id}/service/${s.id}`) });
    }
    if (!projectMode && !serviceMode) out.push(...base.filter((c) => c.label.toLowerCase().includes(query)));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, base, projects]);

  useEffect(() => setIdx(0), [q]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const groups = useMemo(() => {
    const m = new Map<string, Cmd[]>();
    items.forEach((c) => m.set(c.group, [...(m.get(c.group) || []), c]));
    return [...m.entries()];
  }, [items]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[idx]?.run();
    }
  };

  let flat = -1;
  return (
    <>
    <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    <Dialog open={paletteOpen} onClose={close} className="cmdk" label="Enter a command">
      <h3 className="sr-only">Enter a command</h3>
      <button type="button" className="sr-only" onClick={close}>
        Dismiss
      </button>
      <div className="cmdk-input-row">
        <label htmlFor="cmdk-input" className="sr-only">
          What can we help with?
        </label>
        <input
          id="cmdk-input"
          autoFocus
          className="cmdk-input"
          placeholder="What can we help with?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="cmdk-list" role="listbox" ref={listRef}>
        {groups.length === 0 && (
          <div className="cmdk-empty">
            <Search size={16} /> No results for “{q}”
          </div>
        )}
        {groups.map(([g, cmds]) => (
          <div key={g} role="listitem" aria-label={g} className="cmdk-group">
            <div className="cmdk-group-label">{g}</div>
            <div role="group" aria-label={g}>
              {cmds.map((c) => {
                flat += 1;
                const i = flat;
                const Icon = c.icon;
                return (
                  <div
                    key={c.id}
                    role="option"
                    aria-selected={i === idx}
                    className="cmdk-item"
                    onMouseMove={() => setIdx(i)}
                    onClick={() => c.run()}
                  >
                    <Icon size={16} className="cmdk-item-icon" />
                    <span className="cmdk-item-label">{c.label}</span>
                    {c.keywords && <span className="cmdk-item-hint">{c.keywords}</span>}
                    {c.shortcut ? (
                      <span className="cmdk-shortcut">
                        {c.shortcut.map((k) => (
                          <kbd key={k} className="kbd">
                            {k}
                          </kbd>
                        ))}
                      </span>
                    ) : (
                      i === idx && <ArrowRight size={14} className="cmdk-enter" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
    </>
  );
}
