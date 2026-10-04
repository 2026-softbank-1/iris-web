import {
  Background,
  BackgroundVariant,
  Handle,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  MarkerType,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Edge,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CreateDialog } from '../../components/CreateDialog';
import { RepoIcon } from '../../components/brand';
import { ServiceStatusPill } from '../../components/ServiceStatusPill';
import { Dialog, Popover, Tooltip, usePopover, useUI } from '../../components/ui';
import { VariableIssueList } from '../../components/VariableIssues';
import { heldByName, isStepActive, layoutStacks } from '../../data/stackModel';
import { useStacks, type StacksApi } from '../../data/useStacks';
import { ApiError, describeError } from '../../lib/api';
import { networkingErrorKey } from '../../data/networkingError';
import { variablesInvalidIssues, type StackDto, type StackServiceDto, type VariableIssueDto } from '../../lib/endpoints';
import { ENGINE_LABEL } from '../../components/DatabaseBits';
import { PendingChangesDialog } from './PendingChangesDialog';
import { StackGroup, type StackGroupNode } from './StackGroup';
import type { Project, Service } from '../../data/mock';
import { useProject, useProjects } from '../../data/ProjectsContext';
import { apiStatusLabel } from '../../data/deploymentModel';
import { useDeployments } from '../../data/useDeployments';
import type { DeploymentStatus as ApiStatus } from '../../lib/endpoints';
import { useI18n, type MessageKey } from '../../i18n';
import { DeploymentPane } from './DeploymentPane';
import { ServicePane } from './ServicePane';

/* ------------------------------------------------------------------ */
/* Service node                                                        */
/* ------------------------------------------------------------------ */

type ServiceNodeData = {
  service: Service;
  projectId: string;
  selected: boolean;
  /** 스택에 속한 서비스면 배포 순서와 이 스택 배포에서의 진행. */
  step?: StackServiceDto;
  /** step.status 가 HELD 일 때 막은 서비스 이름. */
  heldBy?: string;
  /** 앞 단계가 끝나길 기다리는 중이면 그 서비스 이름. */
  waitingOn?: string;
};
type ServiceNodeType = Node<ServiceNodeData, 'service'>;

function ServiceNode({ data }: NodeProps<ServiceNodeType>) {
  const { service, selected } = data;
  const { t } = useI18n();
  const online = service.state === 'online';
  const database = service.remote?.kind === 'DATABASE';
  const engine = service.remote?.databaseEngine;
  const { step, heldBy, waitingOn } = data;
  return (
    <div className="svc-node-wrap">
      <Handle type="target" position={Position.Top} className="svc-handle" />
      <Handle id="out" type="source" position={Position.Left} className="svc-handle" />
      <Handle id="in" type="target" position={Position.Right} className="svc-handle" />
      <span>
        <a
          href={`/project/${data.projectId}/service/${service.id}`}
          className={`svc-node${selected ? ' selected' : ''}`}
          onClick={(e) => e.preventDefault()}
          draggable={false}
        >
          <div className="svc-node-top">
            <div className="svc-node-icon">
              {database ? <Database size={24} aria-hidden /> : <RepoIcon size={24} />}
            </div>
            <div className="svc-node-text">
              <p className="svc-node-name truncate">{service.name}</p>
              {database ? <p className="svc-node-domain truncate">{engine ? ENGINE_LABEL[engine] : t('stack.db.managed')}</p> : online && service.domain && <p className="svc-node-domain truncate">{service.domain}</p>}
            </div>
            {step && <span className="svc-step-no" title={t('stack.node.order', { n: step.order })} aria-label={t('stack.node.order', { n: step.order })}>{step.order}</span>}
          </div>
          <div className="svc-node-bottom">
            {step && isStepActive(step.status) ? <span className="status-pill deploying">{apiStatusLabel(step.status as ApiStatus)}</span> : <ServiceStatusPill service={service} />}
            {step?.status === 'HELD' ? (
              <p className="svc-node-held truncate" title={t('stack.node.held', { name: heldBy ?? '' })}>{t('stack.node.held', { name: heldBy ?? '' })}</p>
            ) : step?.status === 'QUEUED' && waitingOn ? (
              <p className="svc-node-waiting truncate" title={t('stack.node.waiting', { name: waitingOn })}>{t('stack.node.waiting', { name: waitingOn })}</p>
            ) : service.state === 'crashed' && !service.deploying && <p className="svc-node-failed truncate">{service.crashedLabel ? t(service.crashedLabel.key, service.crashedLabel.vars) : t('project.canvas.deployFailed')}</p>}
          </div>
        </a>
      </span>
      <Handle type="source" position={Position.Bottom} className="svc-handle" />
    </div>
  );
}

const nodeTypes = { service: ServiceNode, stack: StackGroup };

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

function Canvas({ project, selectedId, stacksApi }: { project: Project; selectedId?: string; stacksApi: StacksApi }) {
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
  const { stacks } = stacksApi;
  const [stackBusy, setStackBusy] = useState(false);
  // 스택 재배포가 환경변수 검증에 막혔거나(retry 로 검증 없이 다시 보낼 수 있다), 분석 apply 가 배포 없이 끝났을 때(applied)의 이슈.
  const [blocked, setBlocked] = useState<{ stack?: StackDto; issues: VariableIssueDto[]; applied?: boolean } | null>(null);
  const location = useLocation();
  const [changesFor, setChangesFor] = useState<StackDto['id'] | null>(null);
  const stacksRef = useRef(stacksApi);
  stacksRef.current = stacksApi;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const tRef = useRef(t);
  tRef.current = t;

  /** 스택 전체 재배포. 환경변수에 error 가 있으면 서버가 422 VARIABLES_INVALID 로 거절하니 이슈를 보여 준다. */
  const deployStack = useCallback(async (stack: StackDto, skip = false) => {
    setStackBusy(true);
    try {
      await stacksRef.current.deploy(stack.id, undefined, skip);
      setBlocked(null);
      toastRef.current(tRef.current('stack.group.requested'));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VARIABLES_INVALID') setBlocked({ stack, issues: variablesInvalidIssues(e) });
      else toastRef.current(networkingErrorKey(e) ? tRef.current(networkingErrorKey(e)!) : describeError(e));
      return;
    } finally {
      setStackBusy(false);
    }
  }, []);
  const showChanges = useCallback((stack: StackDto) => setChangesFor(stack.id), []);
  // 분석 apply 가 환경변수 error 로 배포 없이 끝나면 만들기 창이 이슈를 router state 로 넘겨 준다.
  useEffect(() => {
    const issues = (location.state as { variableIssues?: { serviceId: number; issues: VariableIssueDto[] }[] } | null)?.variableIssues;
    if (!issues?.length) return;
    setBlocked({ issues: issues.flatMap((v) => v.issues.filter((i) => i.severity === 'error').map((i) => ({ serviceId: v.serviceId, ...i }))), applied: true });
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const pendingIds = useMemo(() => new Set(stacks.filter((s) => s.pendingChanges).map((s) => s.id)), [stacks]);
  const stackLayout = useMemo(() => layoutStacks(stacks, project.services, pendingIds), [stacks, project.services, pendingIds]);
  const hasStacks = stackLayout.layouts.length > 0;
  type CanvasNode = ServiceNodeType | StackGroupNode;
  const initial = useMemo<CanvasNode[]>(() => {
    const visible = (s: Service) => (showDomains ? s : { ...s, domain: undefined });
    const groups: StackGroupNode[] = stackLayout.layouts.map((l) => ({
      id: `stack:${l.stack.id}`,
      type: 'stack',
      position: { x: l.x, y: l.y },
      style: { width: l.width, height: l.height },
      zIndex: -1,
      draggable: false,
      selectable: false,
      focusable: false,
      data: {
        stack: l.stack,
        services: project.services,
        deploying: !!l.stack.isDeploying || l.stack.services.some((m) => isStepActive(m.status)),
        busy: stackBusy,
        onDeploy: (s: StackDto) => void deployStack(s),
        onShowChanges: showChanges,
      },
    }));
    const members: ServiceNodeType[] = stackLayout.layouts.flatMap((l) =>
      l.nodes.map((n) => {
        const s = project.services.find((x) => x.id === n.serviceId)!;
        const waiting = n.step.waitingFor?.[0];
        return {
          id: s.id,
          type: 'service' as const,
          position: { x: n.x, y: n.y },
          data: {
            service: visible(s),
            projectId: project.id,
            selected: s.id === selectedId,
            step: n.step,
            heldBy: heldByName(l.stack, n.step, project.services),
            waitingOn: waiting ? (l.stack.services.find((m) => m.unitId === waiting)?.name ?? waiting) : undefined,
          },
          draggable: true,
        };
      }),
    );
    const loose: ServiceNodeType[] = stackLayout.loose.map((s, i) => ({
      id: s.id,
      type: 'service',
      position: { x: i * 336, y: stackLayout.looseY },
      data: { service: visible(s), projectId: project.id, selected: s.id === selectedId },
      draggable: true,
    }));
    return [...groups, ...members, ...loose];
  }, [project, selectedId, showDomains, stackLayout, stackBusy, deployStack, showChanges]);
  const edges = useMemo<Edge[]>(
    () =>
      stackLayout.layouts.flatMap((l) =>
        l.edges.map((e) => ({
          id: `dep:${e.from}-${e.to}`,
          source: e.from,
          target: e.to,
          sourceHandle: 'out',
          targetHandle: 'in',
          type: 'smoothstep',
          animated: e.flowing,
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: 'var(--fg-subtle)' },
          style: { stroke: 'var(--fg-subtle)', strokeWidth: 1.5 },
        })),
      ),
    [stackLayout],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initial);
  const moved = useRef(new Map<string, { x: number; y: number }>());

  // 서비스 상태가 다시 불러와져도(배포 진행 중 등) 끌어서 옮긴 위치는 그대로 둔다.
  useEffect(() => {
    // 배치는 스택 구성에서 계산하고, 사용자가 끌어서 옮긴 서비스만 그 위치를 지킨다.
    setNodes(initial.map((n) => ({ ...n, position: moved.current.get(n.id) ?? n.position })));
  }, [initial, setNodes]);

  // 스택이 처음 도착하면(스택 목록은 서비스보다 늦게 온다) 그룹 전체가 보이게 다시 맞춘다. 서비스 패널이 열려 있으면 패널 쪽 이동이 우선이다.
  useEffect(() => {
    if (!hasStacks || selectedId) return;
    const frame = requestAnimationFrame(() => {
      const box = document.querySelector('.canvas-frame') as HTMLElement | null;
      const widest = Math.max(...stackLayout.layouts.map((l) => l.width));
      // 좁은 화면에서는 전부 보이게 줄이면 글자를 읽을 수 없으니 0.5 배에서 멈추고 왼쪽 위부터 보여 준다(끌어서 이동).
      if (box && (box.clientWidth - 24) / widest < 0.5) void rf.setViewport({ x: 12, y: 72 - (stackLayout.layouts[0]?.y ?? 0) * 0.5, zoom: 0.5 }, { duration: 200 });
      else void rf.fitView({ duration: 200, minZoom: 0.3, maxZoom: 1, padding: 0.08 });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStacks, stackLayout.layouts.length, pendingIds.size]);

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
    (_: React.MouseEvent, node: CanvasNode) => node.type === 'service' && navigate(`/project/${project.id}/service/${node.id}`),
    [navigate, project.id],
  );

  return (
    <>
    <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} projectId={project.id} />
    <Dialog open={!!blocked} onClose={() => setBlocked(null)} className="dialog pending-dialog" label={t('stack.blocked.title')}>
      {blocked && (
        <>
          <h2 className="confirm-title">{t(blocked.applied ? 'stack.blocked.appliedTitle' : 'stack.blocked.title')}</h2>
          <p className="st-muted">{t(blocked.applied ? 'stack.blocked.appliedDesc' : 'stack.blocked.desc')}</p>
          {blocked.issues.length > 0 && (
            <VariableIssueList
              issues={blocked.issues}
              services={project.services}
              serviceName={(i) => (i.serviceId ? project.services.find((s) => s.id === String(i.serviceId))?.name : undefined)}
            />
          )}
          <div className="gate-actions">
            <button type="button" className="btn btn-outline" onClick={() => setBlocked(null)}>{t('create.dismiss')}</button>
            {blocked.stack && <button type="button" className="btn btn-outline" disabled={stackBusy} onClick={() => void deployStack(blocked.stack!, true)}>{t('stack.deploy.skip')}</button>}
            {(() => {
              const first = blocked.issues.find((i) => i.serviceId)?.serviceId;
              return first ? (
                <button type="button" className="btn btn-primary" onClick={() => { setBlocked(null); navigate(`/project/${project.id}/service/${first}/variables`); }}>{t('stack.blocked.fix')}</button>
              ) : null;
            })()}
          </div>
        </>
      )}
    </Dialog>
    <PendingChangesDialog
      project={project}
      stack={stacks.find((s) => s.id === changesFor) ?? null}
      onClose={() => setChangesFor(null)}
      onApplied={() => void stacksApi.reload()}
    />
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={(_, node) => moved.current.set(node.id, node.position)}
      onNodeClick={onNodeClick}
      onPaneClick={() => selectedId && navigate(`/project/${project.id}`)}
      fitView
      fitViewOptions={{ minZoom: hasStacks ? 0.3 : 1, maxZoom: 1, padding: hasStacks ? 0.08 : undefined }}
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
  const stacksApi = useStacks(project.id);
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
          <Canvas project={project} selectedId={service?.id} stacksApi={stacksApi} />
        </ReactFlowProvider>
        {service && (
          <div className="pane-wrapper">
            {/* 한 번에 패널 하나만: 배포 상세를 열면 서비스 패널 대신 보여주고, 닫으면 서비스 패널로 돌아간다 */}
            {deployment ? (
              <DeploymentPane project={project} service={service} deployment={deployment} tab={dtab} deps={deps} />
            ) : (
              <ServicePane project={project} service={service} tab={tab} deps={deps} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
