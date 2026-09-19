import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Empty, PageTitle } from '../components/ui/Feedback';
import { RecoveryGate } from './recovery/RecoveryGate';
import { AppShell } from './layout/AppShell';
import { Dashboard } from '../features/dashboard/DashboardPage';
import { ProtocolDetail, Protocols, NewProtocol } from '../features/processos/ProtocolPages';
import { DocumentDetail, Documents, NewDocument } from '../features/documents/DocumentPages';
import { PeoplePage } from '../features/pessoas/PeoplePage';
import { StructurePage } from '../features/estrutura/StructurePage';
import { ProtocolTypesPage } from '../features/tipos-protocolo/ProtocolTypesPage';
import { DocumentTypesPage } from '../features/tipos-documento/DocumentTypesPage';
import { UserAccessPage, UsersPage } from '../features/usuarios/UsersPage';
import { ReportsPage } from '../features/relatorios/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SituationsPage } from '../features/situacoes/SituationsPage';
import { PhasesPage } from '../features/fases/PhasesPage';
import { ProcessCategoriesPage } from '../features/categorias/ProcessCategoriesPage';
function NotFound() {
    return <div className="py-12"><PageTitle title="Página não encontrada"/><Empty title="Não encontramos esta página" detail="Verifique o endereço ou volte para a dashboard." action={<Link className="btn-primary" to="/dashboard">Ir para a dashboard</Link>}/></div>;
}
function LegacyProcessRedirect() {
    const { id } = useParams();
    return <Navigate to={id ? '/processos/' + id : '/processos'} replace/>;
}
export function App() {
    return <BrowserRouter><RecoveryGate><AppShell><Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
    <Route path="/dashboard" element={<Dashboard />}/>
    <Route path="/relatorios" element={<ReportsPage />}/>
    <Route path="/processos" element={<Protocols />}/>
    <Route path="/processos/novo" element={<NewProtocol />}/>
    <Route path="/processos/:id" element={<ProtocolDetail />}/>
    <Route path="/protocolos" element={<Navigate to="/processos" replace/>}/>
    <Route path="/protocolos/novo" element={<Navigate to="/processos/novo" replace/>}/>
    <Route path="/protocolos/:id" element={<LegacyProcessRedirect />}/>
    <Route path="/documentos" element={<Documents />}/>
    <Route path="/documentos/novo" element={<NewDocument />}/>
    <Route path="/documentos/:id" element={<DocumentDetail />}/>
    <Route path="/pessoas" element={<PeoplePage />}/>
    <Route path="/estrutura" element={<StructurePage />}/>
    <Route path="/tipos-processo" element={<ProtocolTypesPage />}/>
    <Route path="/categorias-processo" element={<ProcessCategoriesPage />}/>
    <Route path="/situacoes" element={<SituationsPage />}/>
    <Route path="/fases" element={<PhasesPage />}/>
    <Route path="/tipos-protocolo" element={<Navigate to="/tipos-processo" replace/>}/>
    <Route path="/tipos-documento" element={<DocumentTypesPage />}/>
    <Route path="/usuarios" element={<UsersPage />}/>
    <Route path="/usuarios/:id/unidades" element={<UserAccessPage />}/>
    <Route path="/configuracoes" element={<SettingsPage />}/>
    <Route path="*" element={<NotFound />}/>
  </Routes></AppShell></RecoveryGate></BrowserRouter>;
}
