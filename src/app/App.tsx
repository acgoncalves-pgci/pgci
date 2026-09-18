import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
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
import { UsersPage } from '../features/usuarios/UsersPage';
import { ReportsPage } from '../features/relatorios/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
function NotFound() {
    return <div className="py-12"><PageTitle title="Página não encontrada"/><Empty title="Não encontramos esta página" detail="Verifique o endereço ou volte para a dashboard." action={<Link className="btn-primary" to="/dashboard">Ir para a dashboard</Link>}/></div>;
}
export function App() {
    return <BrowserRouter><RecoveryGate><AppShell><Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
    <Route path="/dashboard" element={<Dashboard />}/>
    <Route path="/relatorios" element={<ReportsPage />}/>
    <Route path="/protocolos" element={<Protocols />}/>
    <Route path="/protocolos/novo" element={<NewProtocol />}/>
    <Route path="/protocolos/:id" element={<ProtocolDetail />}/>
    <Route path="/documentos" element={<Documents />}/>
    <Route path="/documentos/novo" element={<NewDocument />}/>
    <Route path="/documentos/:id" element={<DocumentDetail />}/>
    <Route path="/pessoas" element={<PeoplePage />}/>
    <Route path="/estrutura" element={<StructurePage />}/>
    <Route path="/tipos-protocolo" element={<ProtocolTypesPage />}/>
    <Route path="/tipos-documento" element={<DocumentTypesPage />}/>
    <Route path="/usuarios" element={<UsersPage />}/>
    <Route path="/configuracoes" element={<SettingsPage />}/>
    <Route path="*" element={<NotFound />}/>
  </Routes></AppShell></RecoveryGate></BrowserRouter>;
}
