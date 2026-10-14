import { getActiveTenant, tenantStorage } from '../saas/tenants';
export interface InstitutionSettings {
  organizationName?: string; shortName?: string; cnpj?: string; city?: string; state?: string;
  email?: string; phone?: string; address?: string; logoDataUrl?: string; logoName?: string;
  portalName?: string; publicUrl?: string; publicConsultation?: boolean; labelWidth?: string; labelHeight?: string;
  loginTitle?: string; loginDescription?: string; loginAccent?: string; loginPanelColor?: string; loginUseAppearance?: boolean;
}
export const readInstitutionSettings = (): InstitutionSettings => {
  try {
    const tenant = getActiveTenant();
    return { ...(tenant ? { organizationName: tenant.name, shortName: tenant.abbreviation, city: tenant.city, state: tenant.state } : {}), ...JSON.parse(tenantStorage.getItem('fluxo-publico:settings-general') ?? '{}') };
  }
  catch { return {}; }
};
