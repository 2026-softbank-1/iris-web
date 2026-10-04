import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { CommandPalette } from './components/CommandPalette';
import { UIProvider } from './components/ui';
import { ProjectLayout } from './layouts/ProjectLayout';
import { WorkspaceLayout } from './layouts/WorkspaceLayout';
import { Dashboard } from './pages/Dashboard';
// import { Templates } from './pages/Templates'; // [주석 처리] 샘플 화면이라 숨겼다
// import { Usage } from './pages/Usage'; // Usage is disabled for now (non-MVP)
import { ProjectCanvasPage } from './pages/project/ProjectCanvasPage';
import { ProjectLogs } from './pages/project/ProjectLogs';
// import { Observability } from './pages/project/Observability'; // [주석 처리] 샘플 화면이라 숨겼다
import { ProjectSettings } from './pages/project/ProjectSettings';
// import { Sandboxes } from './pages/project/Sandboxes'; // [주석 처리] 샘플 화면이라 숨겼다

import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthPage } from './pages/AuthPages';
import { Landing } from './pages/Landing';
import { ProjectsProvider } from './data/ProjectsContext';
import { I18nProvider } from './i18n';

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
    <I18nProvider><AuthProvider><UIProvider><ProjectsProvider>
      <TitleSync />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage />} />
        <Route element={<RequireAuth />}>
        <Route element={<WorkspaceLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          {/* [주석 처리] 템플릿은 샘플 화면이라 숨겼다. 예전 주소는 아래 /workspace/:section 이 대시보드로 보낸다.
          <Route path="/workspace/templates" element={<Templates />} />
          */}
          {/* Usage is disabled for now (non-MVP). To restore: uncomment this route and the import, remove the redirect below. */}
          {/* <Route path="/workspace/usage" element={<Usage />} /> */}
          <Route path="/workspace/usage" element={<Navigate to="/dashboard" replace />} />
          <Route path="/workspace/people" element={<Navigate to="/dashboard" replace />} />
          <Route path="/workspace/plans" element={<Navigate to="/dashboard" replace />} />
          <Route path="/workspace/billing" element={<Navigate to="/dashboard" replace />} />
          {/* General is removed. /workspace goes back to the dashboard. */}
          <Route path="/workspace" element={<Navigate to="/dashboard" replace />} />
          {/* 도메인·감사 로그·개발자 화면은 없앴다. 예전 주소는 대시보드로 보낸다. */}
          <Route path="/workspace/:section" element={<Navigate to="/dashboard" replace />} />
        </Route>
        <Route path="/project/:projectId" element={<ProjectLayout />}>
          <Route index element={<ProjectCanvasPage />} />
          <Route path="service/:serviceId" element={<ProjectCanvasPage />} />
          <Route path="service/:serviceId/:tab" element={<ProjectCanvasPage />} />
          <Route path="service/:serviceId/deployment/:deploymentId" element={<ProjectCanvasPage />} />
          <Route path="service/:serviceId/deployment/:deploymentId/:dtab" element={<ProjectCanvasPage />} />
          {/* [주석 처리] Observability 는 샘플 화면이라 숨겼다. 예전 주소는 프로젝트 첫 화면으로 보낸다.
          <Route path="observability" element={<Observability />} />
          */}
          <Route path="observability" element={<Navigate to=".." replace />} />
          <Route path="logs" element={<ProjectLogs />} />
          {/* [주석 처리] Sandboxes 는 샘플 화면이라 숨겼다. 예전 주소는 프로젝트 첫 화면으로 보낸다.
          <Route path="sandboxes" element={<Sandboxes />} />
          */}
          <Route path="sandboxes" element={<Navigate to=".." replace />} />
          <Route path="settings" element={<ProjectSettings />} />
          <Route path="settings/:section" element={<ProjectSettings />} />
        </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <AuthenticatedOverlays />
    </ProjectsProvider></UIProvider></AuthProvider></I18nProvider>
  );
}
