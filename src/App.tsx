import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { CommandPalette } from './components/CommandPalette';
import { UIProvider } from './components/ui';
import { UpgradeDialog } from './components/UpgradeDialog';
import { ProjectLayout } from './layouts/ProjectLayout';
import { WorkspaceLayout } from './layouts/WorkspaceLayout';
import { Dashboard } from './pages/Dashboard';
import { People } from './pages/People';
import { Templates } from './pages/Templates';
import { Usage } from './pages/Usage';
import { WorkspaceSettings } from './pages/WorkspaceSettings';
import { ProjectCanvasPage } from './pages/project/ProjectCanvasPage';
import { ProjectLogs } from './pages/project/ProjectLogs';
import { Observability } from './pages/project/Observability';
import { ProjectSettings } from './pages/project/ProjectSettings';
import { Sandboxes } from './pages/project/Sandboxes';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthPage, OnboardingPage } from './pages/AuthPages';

function RequireAuth() { const { status } = useAuth(); return status === 'authenticated' ? <Outlet /> : <Navigate to={status === 'onboarding' ? '/onboarding' : '/login'} replace />; }

function AuthenticatedOverlays() { const { status } = useAuth(); return status === 'authenticated' ? <><CommandPalette /><UpgradeDialog /></> : null; }

function TitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname.startsWith('/project/')) document.title = 'Railway';
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <AuthProvider><UIProvider>
      <TitleSync />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage signup />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<RequireAuth />}>
        <Route element={<WorkspaceLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/workspace/templates" element={<Templates />} />
          <Route path="/workspace/usage" element={<Usage />} />
          <Route path="/workspace/people" element={<People />} />
          <Route path="/workspace" element={<WorkspaceSettings />} />
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
    </UIProvider></AuthProvider>
  );
}
