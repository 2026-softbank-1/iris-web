import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { CommandPalette } from './components/CommandPalette';
import { UIProvider } from './components/ui';
import { ProjectLayout } from './layouts/ProjectLayout';
import { WorkspaceLayout } from './layouts/WorkspaceLayout';
import { Dashboard } from './pages/Dashboard';
import { Templates } from './pages/Templates';
// import { Usage } from './pages/Usage'; // Usage is disabled for now (non-MVP)
import { WorkspaceSettings } from './pages/WorkspaceSettings';
import { ProjectCanvasPage } from './pages/project/ProjectCanvasPage';
import { ProjectLogs } from './pages/project/ProjectLogs';
import { Observability } from './pages/project/Observability';
import { ProjectSettings } from './pages/project/ProjectSettings';
import { Sandboxes } from './pages/project/Sandboxes';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthPage } from './pages/AuthPages';
import { ProjectsProvider } from './data/ProjectsContext';

function RequireAuth() {
  const { status } = useAuth();
  if (status === 'loading') return null; // 세션(/me) 확인 중에는 로그인 화면으로 튕기지 않는다.
  return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />;
}

function AuthenticatedOverlays() { const { status } = useAuth(); return status === 'authenticated' ? <CommandPalette /> : null; }

function TitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname.startsWith('/project/')) document.title = 'LikeLion';
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <AuthProvider><UIProvider><ProjectsProvider>
      <TitleSync />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<AuthPage />} />
        <Route element={<RequireAuth />}>
        <Route element={<WorkspaceLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/workspace/templates" element={<Templates />} />
          {/* Usage is disabled for now (non-MVP). To restore: uncomment this route and the import, remove the redirect below. */}
          {/* <Route path="/workspace/usage" element={<Usage />} /> */}
          <Route path="/workspace/usage" element={<Navigate to="/dashboard" replace />} />
          <Route path="/workspace/people" element={<Navigate to="/dashboard" replace />} />
          <Route path="/workspace/plans" element={<Navigate to="/dashboard" replace />} />
          <Route path="/workspace/billing" element={<Navigate to="/dashboard" replace />} />
          {/* General is removed. /workspace goes back to the dashboard. */}
          <Route path="/workspace" element={<Navigate to="/dashboard" replace />} />
          <Route path="/workspace/:section" element={<WorkspaceSettings />} />
        </Route>
        <Route path="/project/:projectId" element={<ProjectLayout />}>
          <Route index element={<ProjectCanvasPage />} />
          <Route path="service/:serviceId" element={<ProjectCanvasPage />} />
          <Route path="service/:serviceId/:tab" element={<ProjectCanvasPage />} />
          <Route path="service/:serviceId/deployment/:deploymentId" element={<ProjectCanvasPage />} />
          <Route path="service/:serviceId/deployment/:deploymentId/:dtab" element={<ProjectCanvasPage />} />
          <Route path="observability" element={<Observability />} />
          <Route path="logs" element={<ProjectLogs />} />
          <Route path="sandboxes" element={<Sandboxes />} />
          <Route path="settings" element={<ProjectSettings />} />
          <Route path="settings/:section" element={<ProjectSettings />} />
        </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <AuthenticatedOverlays />
    </ProjectsProvider></UIProvider></AuthProvider>
  );
}
