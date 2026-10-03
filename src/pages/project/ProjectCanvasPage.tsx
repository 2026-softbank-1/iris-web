import {
  Background,
  BackgroundVariant,
  Handle,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  Box,
  Database,
  FileCode2,
  FolderGit2,
  Grip,
  HardDrive,
  Layers,
  LayoutTemplate,
  Expand,
  Maximize,
  Minus,
  Plus,
  Redo,
  Undo,
  Container,
  SquareFunction,
  Eye,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CreateDialog } from '../../components/CreateDialog';
import { OnlineDot, RepoIcon } from '../../components/brand';
import { Popover, Tooltip, usePopover, useUI } from '../../components/ui';
import type { Project, Service } from '../../data/mock';
import { useProject, useProjects } from '../../data/ProjectsContext';
import { useDeployments } from '../../data/useDeployments';
import { useI18n, type MessageKey } from '../../i18n';
import { DeploymentPane } from './DeploymentPane';
import { ServicePane } from './ServicePane';

/* ------------------------------------------------------------------ */
/* Service node                                                        */
/* ------------------------------------------------------------------ */

type ServiceNodeData = { service: Service; projectId: string; selected: boolean };
type ServiceNodeType = Node<ServiceNodeData, 'service'>;

function ServiceNode({ data }: NodeProps<ServiceNodeType>) {
  const { service, selected } = data;
  const { t } = useI18n();
  const online = service.state === 'online';
  return (
    <div className="svc-node-wrap">
      <Handle type="target" position={Position.Top} className="svc-handle" />
      <span>
        <a
          href={`/project/${data.projectId}/service/${service.id}`}
          className={`svc-node${selected ? ' selected' : ''}`}
          onClick={(e) => e.preventDefault()}
          draggable={false}
        >
          <div className={`svc-node-top${online ? '' : ' center'}`}>
            <div className="svc-node-icon">
              <RepoIcon size={24} />
            </div>
            <div className="svc-node-text">
              <p className="svc-node-name truncate">{service.name}</p>
              {online && service.domain && <p className="svc-node-domain truncate">{service.domain}</p>}
            </div>
          </div>
          {online ? (
            <div className="svc-node-bottom">
              <div className="svc-node-status">
                <OnlineDot size={16} />
                <p>Online</p>
              </div>
            </div>
          ) : (
            <p className="svc-node-offline">{service.deploying ? 'Deploying' : service.state === 'crashed' ? t('project.canvas.deployFailed') : t('project.canvas.offline')}</p>
          )}
        </a>
      </span>
      <Handle type="source" position={Position.Bottom} className="svc-handle" />
    </div>
  );
}

const nodeTypes = { service: ServiceNode };

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

function ToolButton({ title, onClick, children, disabled }: { title: string; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Tooltip label={title} side="right">
      <button type="button" title={title} className="tool-btn" onClick={onClick} disabled={disabled}>
        <div className="tool-icon">{children}</div>
      </button>
    </Tooltip>
  );
}

const ADD_OPTIONS: { icon: typeof Box; label: MessageKey }[] = [
  { icon: FolderGit2, label: 'project.canvas.add.github' },
  { icon: Database, label: 'project.canvas.add.database' },
  { icon: LayoutTemplate, label: 'project.canvas.add.template' },
  { icon: Container, label: 'project.canvas.add.docker' },
  { icon: SquareFunction, label: 'project.canvas.add.function' },
  { icon: HardDrive, label: 'project.canvas.add.bucket' },
  { icon: HardDrive, label: 'project.canvas.add.volume' },
  { icon: Box, label: 'project.canvas.add.empty' },
];

function Canvas({ project, selectedId }: { project: Project; selectedId?: string }) {
  const navigate = useNavigate();
  const rf = useReactFlow();
  const { toast } = useUI();
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const addPop = usePopover();
  const settingsPop = usePopover();
  const layersPop = usePopover();
  const [snap, setSnap] = useState(() => localStorage.getItem('ll:snap') === '1');
  const [showDomains, setShowDomains] = useState(true);

  const initial = useMemo<ServiceNodeType[]>(
    () =>
      project.services.map((s, i) => ({
        id: s.id,
        type: 'service',
        position: { x: i * 336, y: 0 },
        data: {
          service: showDomains ? s : { ...s, domain: undefined },
          projectId: project.id,
          selected: s.id === selectedId,
        },
        draggable: true,
      })),
    [project, selectedId, showDomains],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<ServiceNodeType>(initial);

  // 서비스 상태가 다시 불러와져도(배포 진행 중 등) 끌어서 옮긴 위치는 그대로 둔다.
  useEffect(() => {
    setNodes((prev) => initial.map((n) => ({ ...n, position: prev.find((p) => p.id === n.id)?.position ?? n.position })));
  }, [initial, setNodes]);

  // When a service pane is open, slide the canvas so the selected node sits in the
  // visible strip left of the pane (the pane is 904px wide, or full width minus 24px).
  const initialized = useNodesInitialized();
  useEffect(() => {
    if (!initialized) return;
    const frame = document.querySelector('.canvas-frame') as HTMLElement | null;
    if (!frame) return;
    const { zoom, y } = rf.getViewport();
    if (!selectedId) return;
    const node = rf.getNode(selectedId);
    if (!node) return;
    const W = frame.clientWidth;
    const paneW = Math.min(904, W - 24);
    const leftArea = W - paneW;
    const x = leftArea / 2 - node.position.x * zoom - (288 * zoom) / 2;
    rf.setViewport({ x, y, zoom }, { duration: 300 });
  }, [selectedId, initialized, rf]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: ServiceNodeType) => navigate(`/project/${project.id}/service/${node.id}`),
    [navigate, project.id],
  );

  return (
    <>
    <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} projectId={project.id} />
    <ReactFlow
      nodes={nodes}
      edges={[]}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={onNodeClick}
      onPaneClick={() => selectedId && navigate(`/project/${project.id}`)}
      fitView
      fitViewOptions={{ minZoom: 1, maxZoom: 1 }}
      minZoom={0.2}
      maxZoom={2}
      snapToGrid={snap}
      snapGrid={[24, 24]}
      nodeOrigin={[0, 0]}
      proOptions={{ hideAttribution: true }}
      zoomOnDoubleClick={false}
      className="rw-flow"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} offset={0.5} color="var(--dot)" />
      <Panel position="bottom-left" className="toolbar-left">
        <div role="toolbar" aria-label={t('project.canvas.options')} className="toolbar">
          <ToolButton title={t('project.canvas.settings')} onClick={(e) => settingsPop.toggle(e.currentTarget)}>
            <Grip size={16} />
          </ToolButton>
          <div role="group" aria-label={t('project.canvas.action')} className="tool-group">
            <ToolButton title={t('project.canvas.zoomIn')} onClick={() => rf.zoomIn({ duration: 150 })}>
              <Plus size={16} />
            </ToolButton>
            <ToolButton title={t('project.canvas.zoomOut')} onClick={() => rf.zoomOut({ duration: 150 })}>
              <Minus size={16} />
            </ToolButton>
            <ToolButton title={t('project.canvas.center')} onClick={() => rf.fitView({ duration: 200, minZoom: 1, maxZoom: 1 })}>
              <Expand size={16} />
            </ToolButton>
          </div>
          <div role="group" aria-label={t('project.canvas.action')} className="tool-group">
            <ToolButton title={t('project.canvas.undo')}>
              <Undo size={16} />
            </ToolButton>
            <ToolButton title={t('project.canvas.redo')}>
              <Redo size={16} />
            </ToolButton>
          </div>
          <ToolButton title={t('project.canvas.layers')} onClick={(e) => layersPop.toggle(e.currentTarget)}>
            <Layers size={16} />
          </ToolButton>
        </div>
      </Panel>
      <Popover anchor={settingsPop.anchor} onClose={settingsPop.close} side="right" align="start" width={230}>
        <div className="menu-label">{t('project.canvas.settings')}</div>
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            const v = !snap;
            setSnap(v);
            localStorage.setItem('ll:snap', v ? '1' : '0');
          }}
        >
          <Grip size={16} className="menu-icon" /> {t('project.canvas.snap')}
          <span className="switch menu-right" aria-checked={snap} role="switch" />
        </button>
        <button type="button" className="menu-item" onClick={() => rf.fitView({ duration: 200, maxZoom: 1 })}>
          <Maximize size={16} className="menu-icon" /> {t('project.canvas.fitAll')}
        </button>
      </Popover>
      <Popover anchor={layersPop.anchor} onClose={layersPop.close} side="right" align="end" width={230}>
        <div className="menu-label">{t('project.canvas.layers')}</div>
        <button type="button" className="menu-item" onClick={() => setShowDomains((v) => !v)}>
          <Eye size={16} className="menu-icon" /> {t('project.canvas.publicDomains')}
          <span className="switch menu-right" aria-checked={showDomains} role="switch" />
        </button>
      </Popover>
      <Panel position="top-right" className="toolbar-right" style={selectedId ? { visibility: 'hidden' } : undefined}>
        <div className="add-wrap">
          <button type="button" className="btn btn-secondary add-btn" onClick={() => setCreateOpen(true)}>
            <div className="tool-icon">
              <Plus size={16} />
            </div>
            <span>{t('project.canvas.create')}</span>
          </button>
        </div>
      </Panel>
      <Popover anchor={addPop.anchor} onClose={addPop.close} align="end" width={260}>
        <div className="menu-label">{t('project.canvas.whatCreate')}</div>
        {ADD_OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            className="menu-item"
            onClick={() => {
              addPop.close();
              setCreateOpen(true);
            }}
          >
            <o.icon size={16} className="menu-icon" />
            {t(o.label)}
          </button>
        ))}
        <div className="menu-sep" />
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            addPop.close();
            toast(t('project.canvas.composeToast'));
          }}
        >
          <FileCode2 size={16} className="menu-icon" /> {t('project.canvas.importCompose')}
        </button>
      </Popover>
    </ReactFlow>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ProjectCanvasPage() {
  const { projectId, serviceId, tab, deploymentId, dtab } = useParams();
  const navigate = useNavigate();
  // ProjectLayout 이 프로젝트가 있을 때만 이 페이지를 그린다.
  const project = useProject(projectId).project!;
  const { refreshProject } = useProjects();
  const service = project.services.find((s) => s.id === serviceId || s.shortId === serviceId);

  // 이 화면을 보는 동안은 서비스 상태를 가끔 다시 받는다(push 웹훅이 만든 배포도 보이게).
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshProject(project.id).catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [project.id, refreshProject]);
  const deps = useDeployments(service);
  const deployment = deps.items.find((d) => d.id === deploymentId || d.shortId === deploymentId);

  useEffect(() => {
    document.title = deployment ? service!.name : service ? service.name : project.name;
  }, [project, service, deployment]);

  // Esc closes the top-most pane
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"], .menu')) return;
      if (deployment && service) navigate(`/project/${project.id}/service/${service.id}`);
      else if (service) navigate(`/project/${project.id}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deployment, service, project.id, navigate]);

  return (
    <div className="canvas-region" role="region">
      <div className="canvas-frame">
        <ReactFlowProvider>
          <Canvas project={project} selectedId={service?.id} />
        </ReactFlowProvider>
        {service && (
          <div className="pane-wrapper">
            <ServicePane project={project} service={service} tab={tab} stacked={!!deployment} deps={deps} />
            {deployment && <DeploymentPane project={project} service={service} deployment={deployment} tab={dtab} deps={deps} />}
          </div>
        )}
      </div>
    </div>
  );
}
