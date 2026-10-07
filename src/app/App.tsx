import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Empty, Loading, PageTitle } from '../components/ui/Feedback';
import { ForgotPasswordPage, LoginPage } from '../features/auth/AuthPage';
import { RecoveryGate } from './recovery/RecoveryGate';
import { AppShell } from './layout/AppShell';
import { Dashboard } from '../features/dashboard/DashboardPage';
import { ProtocolDetail, Protocols, NewProtocol } from '../features/processos/ProtocolPages';
import { Documents, EditDocument, NewDocument } from '../features/documents/DocumentPages';
import { PeoplePage } from '../features/pessoas/PeoplePage';
import { StructurePage } from '../features/estrutura/StructurePage';
import { ProtocolTypesPage } from '../features/tipos-protocolo/ProtocolTypesPage';
import { DocumentTypesPage } from '../features/tipos-documento/DocumentTypesPage';
import { DocumentTemplatePage } from '../features/tipos-documento/DocumentTemplatePage';
import { UserAccessPage, UsersPage } from '../features/usuarios/UsersPage';
import { ProfilesPage } from '../features/usuarios/ProfilesPage';
import { ReportsPage } from '../features/relatorios/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SituationsPage } from '../features/situacoes/SituationsPage';
import { PhasesPage } from '../features/fases/PhasesPage';
import { ProcessCategoriesPage } from '../features/categorias/ProcessCategoriesPage';
import { useDb } from './queries';
import { useSession } from './session';
import { hasPermission } from '../domain/permissions';
import type { Permission } from '../domain/permissions';
import type { ReactNode } from 'react';
function PermissionGate({ permission, children }: { permission: Permission; children: ReactNode }) {
    const ctx = useSession();
    const { data: db, isLoading } = useDb();
    if (isLoading || !db) return null;
    return hasPermission(db, ctx, permission) ? children : <Empty title="Acesso restrito" detail="Você não possui permissão para acessar esta área na unidade selecionada."/>;
}
function NotFound() {
    return <div className="py-12"><PageTitle title="Página não encontrada"/><Empty title="Não encontramos esta página" detail="Verifique o endereço ou volte para a dashboard." action={<Link className="btn-primary" to="/dashboard">Ir para a dashboard</Link>}/></div>;
}
function LegacyProcessRedirect() {
    const { id } = useParams();
    return <Navigate to={id ? '/processos/' + id : '/processos'} replace/>;
}
export function App() {
    return <BrowserRouter><RecoveryGate><Routes>
      <Route path="/login" element={<LoginPage/>}/>
      <Route path="/esqueci-a-senha" element={<ForgotPasswordPage/>}/>
      <Route path="*" element={<AuthenticatedApp/>}/>
    </Routes></RecoveryGate></BrowserRouter>;
}
function AuthenticatedApp() {
    const ctx = useSession();
    const location = useLocation();
    if (ctx.sessionLoading) return <div className="p-8"><Loading/></div>;
    if (!ctx.authenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }}/>;
    return <AppShell><Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
    <Route path="/dashboard" element={<Dashboard />}/>
    <Route path="/relatorios" element={<PermissionGate permission="reports.view"><ReportsPage /></PermissionGate>}/>
    <Route path="/processos" element={<PermissionGate permission="processes.view"><Protocols /></PermissionGate>}/>
    <Route path="/processos/novo" element={<PermissionGate permission="processes.create"><NewProtocol /></PermissionGate>}/>
    <Route path="/processos/:id" element={<PermissionGate permission="processes.view"><ProtocolDetail /></PermissionGate>}/>
    <Route path="/protocolos" element={<Navigate to="/processos" replace/>}/>
    <Route path="/protocolos/novo" element={<Navigate to="/processos/novo" replace/>}/>
    <Route path="/protocolos/:id" element={<LegacyProcessRedirect />}/>
    <Route path="/documentos" element={<PermissionGate permission="documents.view"><Documents /></PermissionGate>}/>
    <Route path="/documentos/novo" element={<PermissionGate permission="documents.create"><NewDocument /></PermissionGate>}/>
    <Route path="/documentos/:id/editar" element={<PermissionGate permission="documents.edit"><EditDocument /></PermissionGate>}/>
    <Route path="/documentos/:id" element={<Navigate to="/documentos" replace/>}/>
    <Route path="/pessoas" element={<PermissionGate permission="people.view"><PeoplePage /></PermissionGate>}/>
    <Route path="/estrutura" element={<PermissionGate permission="structure.view"><StructurePage /></PermissionGate>}/>
    <Route path="/tipos-processo" element={<PermissionGate permission="protocolTypes.view"><ProtocolTypesPage /></PermissionGate>}/>
    <Route path="/categorias-processo" element={<PermissionGate permission="protocolTypes.view"><ProcessCategoriesPage /></PermissionGate>}/>
    <Route path="/situacoes" element={<PermissionGate permission="workflow.view"><SituationsPage /></PermissionGate>}/>
    <Route path="/fases" element={<PermissionGate permission="workflow.view"><PhasesPage /></PermissionGate>}/>
    <Route path="/tipos-protocolo" element={<Navigate to="/tipos-processo" replace/>}/>
    <Route path="/tipos-documento" element={<PermissionGate permission="documentTypes.view"><DocumentTypesPage /></PermissionGate>}/>
    <Route path="/tipos-documento/:typeId/modelos/novo" element={<PermissionGate permission="documentTypes.create"><DocumentTemplatePage /></PermissionGate>}/>
    <Route path="/tipos-documento/:typeId/modelos/:templateId/editar" element={<PermissionGate permission="documentTypes.edit"><DocumentTemplatePage /></PermissionGate>}/>
    <Route path="/usuarios" element={<PermissionGate permission="users.view"><UsersPage /></PermissionGate>}/>
    <Route path="/perfis" element={<PermissionGate permission="profiles.manage"><ProfilesPage /></PermissionGate>}/>
    <Route path="/usuarios/:id/unidades" element={<PermissionGate permission="users.view"><UserAccessPage /></PermissionGate>}/>
    <Route path="/configuracoes" element={<SettingsPage />}/>
    <Route path="*" element={<NotFound />}/>
  </Routes></AppShell>;
}
