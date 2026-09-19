export interface InstitutionSettings {
  organizationName?: string; shortName?: string; cnpj?: string; city?: string; state?: string;
  email?: string; phone?: string; address?: string; logoDataUrl?: string; logoName?: string;
  portalName?: string; publicUrl?: string; publicConsultation?: boolean; labelWidth?: string; labelHeight?: string;
}
export const readInstitutionSettings = (): InstitutionSettings => {
  try { return JSON.parse(localStorage.getItem('fluxo-publico:settings-general') ?? '{}'); }
  catch { return {}; }
};
