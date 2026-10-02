import { useEffect, useRef, useState } from "react";
import {
  Building2,
  FileText,
  Globe2,
  ImagePlus,
  Landmark,
  Palette,
  PanelLeft,
  Moon,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sun,
  Trash2,
  Type,
  ZoomIn,
} from "lucide-react";
import { Input } from "../../components/ui/Input";
import { CnpjInput } from "../../components/ui/CnpjInput";
import { BrazilianPhoneInput } from "../../components/ui/BrazilianPhoneInput";
import { MaskedInput } from "../../components/ui/MaskedInput";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { Loading, PageTitle } from "../../components/ui/Feedback";
import { defaultAppearance, useSession } from "../../app/session";
import type { AppearancePalette } from "../../app/session";
import { useDb } from "../../app/queries";
import { hasPermission } from '../../domain/permissions';
import { formatConfiguredNumber, GENERAL_SETTINGS_KEY } from "../../lib/numbering";
type Tab = "general" | "portal" | "appearance";
const stateTokens = { A: { pattern: /[a-z]/i, transform: (char: string) => char.toUpperCase() } };
type GeneralSettings = {
  organizationName: string;
  shortName: string;
  cnpj: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  address: string;
  clientCode: string;
  numberFormat: string;
  sequencePadding: string;
  labelWidth: string;
  labelHeight: string;
  logoDataUrl: string;
  logoName: string;
  portalName: string;
  publicUrl: string;
  publicConsultation: boolean;
};
type AppearancePreset = {
  name: string;
  lightColors: AppearancePalette;
  darkColors: AppearancePalette;
};
const appearancePresets: AppearancePreset[] = [
  {
    name: "Azul original",
    lightColors: { sidebarColor: "#dce8ee", headerColor: "#dce8ee", accent: "#17628b", backgroundColor: "#ffffff", footerColor: "#303030" },
    darkColors: { sidebarColor: "#0f2935", headerColor: "#11202b", accent: "#2a95c5", backgroundColor: "#020617", footerColor: "#0f2935" },
  },
  {
    name: "Esmeralda",
    lightColors: { sidebarColor: "#065f46", headerColor: "#d1fae5", accent: "#026e4c", backgroundColor: "#ffffff", footerColor: "#064e3b" },
    darkColors: { sidebarColor: "#022c22", headerColor: "#064e3b", accent: "#007a52", backgroundColor: "#020907", footerColor: "#022c22" },
  },
  {
    name: "Violeta",
    lightColors: { sidebarColor: "#5b21b6", headerColor: "#ede9fe", accent: "#7c3aed", backgroundColor: "#ffffff", footerColor: "#4c1d95" },
    darkColors: { sidebarColor: "#2e1065", headerColor: "#4c1d95", accent: "#a78bfa", backgroundColor: "#10091e", footerColor: "#2e1065" },
  },
  {
    name: "Âmbar",
    lightColors: { sidebarColor: "#92400e", headerColor: "#fef3c7", accent: "#d97706", backgroundColor: "#fffbeb", footerColor: "#78350f" },
    darkColors: { sidebarColor: "#451a03", headerColor: "#78350f", accent: "#f59e0b", backgroundColor: "#120b03", footerColor: "#451a03" },
  },
];
const defaultGeneral: GeneralSettings = {
  organizationName: "",
  shortName: "",
  cnpj: "",
  city: "",
  state: "",
  email: "",
  phone: "",
  address: "",
  clientCode: "",
  numberFormat: "Diário — YYYY.MM.DD.NNNN",
  sequencePadding: "4",
  labelWidth: "425",
  labelHeight: "283",
  logoDataUrl: "",
  logoName: "",
  portalName: "",
  publicUrl: "",
  publicConsultation: true,
};
const readGeneral = () => {
  try {
    return {
      ...defaultGeneral,
      ...(JSON.parse(
        localStorage.getItem(GENERAL_SETTINGS_KEY) ?? "{}",
      ) as Partial<GeneralSettings>),
    };
  } catch {
    return defaultGeneral;
  }
};
const notify = (message: string) =>
  window.dispatchEvent(
    new CustomEvent("fluxo-publico:toast", {
      detail: { kind: "success", message },
    }),
  );
export function SettingsPage() {
  const { data: db, isLoading } = useDb();
  const { theme, setTheme, appearance, setAppearance, userId, activeUnitId } = useSession();
  const [tab, setTab] = useState<Tab>("general");
  const [general, setGeneral] = useState<GeneralSettings>(readGeneral);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (db && !general.organizationName)
      setGeneral((value) => ({
        ...value,
        organizationName: db.organization.name,
        shortName: db.organization.abbreviation,
      }));
  }, [db, general.organizationName]);
  if (isLoading || !db) return <Loading variant="detail" />;
  const canManage = hasPermission(db, { userId, activeUnitId }, 'settings.manage');
  const selectedTab = canManage ? tab : 'appearance';
  const update = (key: keyof GeneralSettings, value: string | boolean) =>
    setGeneral((current) => ({ ...current, [key]: value }));
  const saveGeneral = () => {
    if (!canManage) return;
    try {
      if (general.publicUrl.trim()) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(general.publicUrl.trim()) && !/^https?:\/\//i.test(general.publicUrl.trim())) throw new Error('Informe um endereço público HTTP ou HTTPS válido.');
        const address = new URL(/^https?:\/\//i.test(general.publicUrl.trim()) ? general.publicUrl.trim() : `https://${general.publicUrl.trim()}`);
        if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password) throw new Error('Informe um endereço público HTTP ou HTTPS válido.');
      }
      localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify(general));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível salvar as configurações.' } }));
      return;
    }
    window.dispatchEvent(new Event("fluxo-publico:settings-general"));
    notify("Configurações gerais salvas com sucesso.");
  };
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error('Envie uma logo PNG, JPG ou SVG de até 2 MB.');
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Não foi possível ler esta imagem.')); image.src = url; });
        const scale = Math.min(1, 600 / image.naturalWidth, 400 / image.naturalHeight);
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível processar a logo.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setGeneral((current) => ({ ...current, logoDataUrl: canvas.toDataURL('image/png'), logoName: file.name }));
      } finally { URL.revokeObjectURL(url); }
    } catch (error) { window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'error', message: error instanceof Error ? error.message : 'Falha ao enviar a logo.' } })); }
    finally { setUploadingLogo(false); if (logoInput.current) logoInput.current.value = ''; }
  };
  const previewProcessNumber = formatConfiguredNumber('protocol', 42, general);
  const previewDocumentNumber = formatConfiguredNumber('document', 42, general);
  const applyAppearancePreset = (preset: AppearancePreset) => {
    setAppearance({
      ...appearance,
      ...preset.lightColors,
      darkAccent: preset.darkColors.accent,
      darkSidebarColor: preset.darkColors.sidebarColor,
      darkHeaderColor: preset.darkColors.headerColor,
      darkBackgroundColor: preset.darkColors.backgroundColor,
      footerColor: preset.lightColors.footerColor,
      darkFooterColor: preset.darkColors.footerColor,
    });
  };
  const tabs: {
    id: Tab;
    label: string;
    icon: typeof Building2;
  }[] = [
    { id: "general", label: "Geral", icon: Building2 },
    { id: "portal", label: "Portal", icon: Globe2 },
    { id: "appearance", label: "Aparência", icon: Palette },
  ];
  return (
    <div className="mx-auto max-w-7xl pb-10">
      <PageTitle
        title="Configurações"
        detail="Personalize dados institucionais, portal e aparência do sistema."
        icon={SlidersHorizontal}
        action={canManage &&
          <button className="btn-primary" onClick={saveGeneral} disabled={uploadingLogo}>
            <Save size={16} />
            Salvar configurações
          </button>
        }
      />
      <section className="panel overflow-hidden">
        <div
          role="tablist"
          aria-label="Seções de configurações"
          className={`m-3 grid rounded-md bg-[#efede5] p-1 dark:bg-slate-800 ${canManage ? 'grid-cols-3' : 'grid-cols-1'}`}
        >
          {tabs.filter(({ id }) => canManage || id === 'appearance').map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-label={label}
              aria-selected={selectedTab === id}
              aria-controls={`settings-${id}`}
              onClick={() => setTab(id)}
              className={`flex min-h-8 items-center justify-center gap-2 rounded px-3 text-sm font-semibold transition-colors ${selectedTab === id ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"}`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        {selectedTab === "general" && (
          <div
            id="settings-general"
            role="tabpanel"
            className="space-y-7 p-5 sm:p-7"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SettingField label="Nome da organização">
                <Input
                  placeholder="Ex.: Prefeitura Municipal de Aracaju"
                  value={general.organizationName}
                  onChange={(event) =>
                    update("organizationName", event.target.value)
                  }
                />
              </SettingField>
              <SettingField label="Nome reduzido">
                <Input
                  placeholder="Ex.: PMA, Pref. Aracaju"
                  value={general.shortName}
                  onChange={(event) => update("shortName", event.target.value)}
                />
              </SettingField>
              <SettingField label="CNPJ">
                <CnpjInput
                  placeholder="00.000.000/0000-00"
                  value={general.cnpj}
                  onChange={(event) => update("cnpj", event.target.value)}
                />
              </SettingField>
              <SettingField label="Cidade">
                <Input
                  placeholder="Ex.: Aracaju"
                  value={general.city}
                  onChange={(event) => update("city", event.target.value)}
                />
              </SettingField>
              <SettingField label="UF">
                <MaskedInput
                  mask="AA"
                  tokens={stateTokens}
                  inputMode="text"
                  placeholder="Ex.: SE"
                  value={general.state}
                  onChange={(event) =>
                    update("state", event.target.value.toUpperCase())
                  }
                />
              </SettingField>
            </div>
            <div className="grid gap-4 border-t pt-6 md:grid-cols-3">
              <SettingField label="E-mail de contato">
                <Input
                  type="email"
                  placeholder="contato@municipio.gov.br"
                  value={general.email}
                  onChange={(event) => update("email", event.target.value)}
                />
              </SettingField>
              <SettingField label="Telefone">
                <BrazilianPhoneInput
                  placeholder="(00) 0000-0000"
                  value={general.phone}
                  onChange={(event) => update("phone", event.target.value)}
                />
              </SettingField>
              <SettingField label="Endereço">
                <Input
                  placeholder="Ex.: Praça Central, 100 - Centro"
                  value={general.address}
                  onChange={(event) => update("address", event.target.value)}
                />
              </SettingField>
            </div>
            <SettingsSection
              icon={FileText}
              title="Numeração de processos e documentos"
              detail="Formato aplicado automaticamente na abertura de processos e na criação de documentos."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <SettingField label="Formato">
                  <Select
                    value={general.numberFormat}
                    onChange={(event) =>
                      update("numberFormat", event.target.value)
                    }
                  >
                    <option>Diário — YYYY.MM.DD.NNNN</option>
                    <option>Anual — YYYY.NNNNNN</option>
                    <option>Sequencial — NNNNNN</option>
                  </Select>
                </SettingField>
                <SettingField label="Padding do sequencial">
                  <Input
                    placeholder="Ex.: 4"
                    inputMode="numeric"
                    value={general.sequencePadding}
                    onChange={(event) =>
                      update(
                        "sequencePadding",
                        event.target.value.replace(/\D/g, ""),
                      )
                    }
                  />
                  <small className="mt-1 block text-xs text-slate-500">
                    Quantidade de dígitos: 4 → 0042.
                  </small>
                </SettingField>
                <SettingField label="Prévia do processo">
                  <Input
                    readOnly
                    className="bg-slate-50 dark:bg-slate-800"
                    value={previewProcessNumber}
                  />
                </SettingField>
                <SettingField label="Prévia do documento">
                  <Input readOnly className="bg-slate-50 dark:bg-slate-800" value={previewDocumentNumber}/>
                </SettingField>
              </div>
            </SettingsSection>
            <SettingsSection
              icon={Landmark}
              title="Timbre dos relatórios"
              detail="Aparece no cabeçalho fixo de relatórios e comprovantes gerados pelo sistema."
            >
              <input
                ref={logoInput}
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(event) => void uploadLogo(event.target.files?.[0])}
              />
              <div className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-950/40">
                <p className="label">Brasão / logo da entidade</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="grid size-16 place-items-center rounded-md border bg-white text-public-700 dark:bg-slate-900">
                    {general.logoDataUrl ? <img src={general.logoDataUrl} alt="Logo da entidade" className="max-h-full max-w-full object-contain p-1" /> : <Landmark size={29} />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => logoInput.current?.click()}
                      >
                        <ImagePlus size={16} />
                        Enviar logo
                      </button>
                      {general.logoDataUrl && (
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => setGeneral((current) => ({ ...current, logoDataUrl: "", logoName: "" }))}
                        >
                          <Trash2 size={16} />
                          Remover
                        </button>
                      )}
                    </div>
                    <p className="mt-2 truncate text-xs text-slate-500">
                      {general.logoName ||
                        "PNG, JPG ou SVG (máx. 2MB). A imagem é otimizada para 100px de altura."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <SettingField label="Linha 1 do timbre">
                  <Input
                    placeholder="Ex.: Prefeitura Municipal de Aracaju"
                    value={general.organizationName}
                    onChange={(event) =>
                      update("organizationName", event.target.value)
                    }
                  />
                </SettingField>
                <SettingField label="Linha 2 do timbre">
                  <CnpjInput
                    placeholder="00.000.000/0000-00"
                    value={general.cnpj}
                    onChange={(event) => update("cnpj", event.target.value)}
                  />
                </SettingField>
              </div>
              <div className="mt-5 grid gap-4 border-t pt-5 md:grid-cols-2">
                <SettingField label="Largura da etiqueta (pt)">
                  <Input
                    placeholder="Ex.: 425"
                    inputMode="numeric"
                    value={general.labelWidth}
                    onChange={(event) =>
                      update(
                        "labelWidth",
                        event.target.value.replace(/\D/g, ""),
                      )
                    }
                  />
                </SettingField>
                <SettingField label="Altura da etiqueta (pt)">
                  <Input
                    placeholder="Ex.: 283"
                    inputMode="numeric"
                    value={general.labelHeight}
                    onChange={(event) =>
                      update(
                        "labelHeight",
                        event.target.value.replace(/\D/g, ""),
                      )
                    }
                  />
                </SettingField>
              </div>
            </SettingsSection>
          </div>
        )}
        {selectedTab === "portal" && (
          <div
            id="settings-portal"
            role="tabpanel"
            className="space-y-6 p-5 sm:p-7"
          >
            <SettingsSection
              icon={Globe2}
              title="Portal de acompanhamento"
              detail="Defina como cidadãos acompanham solicitações externas."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <SettingField label="Nome exibido no portal">
                  <Input placeholder="Ex.: Portal do Cidadão" value={general.portalName || db.organization.name} onChange={(event) => update("portalName", event.target.value)} />
                </SettingField>
                <SettingField label="Endereço público">
                  <Input placeholder="https://portal.entidade.gov.br/consulta" value={general.publicUrl} onChange={(event) => update("publicUrl", event.target.value)} />
                </SettingField>
              </div>
              <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border bg-slate-50 p-4 dark:bg-slate-950/40">
                <span>
                  <strong className="block text-sm">
                    Permitir consulta pública
                  </strong>
                  <small className="mt-1 block text-xs text-slate-500">
                    O QR code da capa usa este endereço com o número do processo.
                  </small>
                </span>
                <Switch checked={general.publicConsultation} onCheckedChange={(checked) => update("publicConsultation", checked)} aria-label="Permitir consulta pública" />
              </div>
            </SettingsSection>
          </div>
        )}
        {selectedTab === "appearance" && (
          <div
            id="settings-appearance"
            role="tabpanel"
            className="space-y-7 p-5 sm:p-7"
          >
            <SettingsSection
              icon={Type}
              title="Fonte, tamanho e cantos"
              detail="Escolha a fonte, o tamanho de leitura e o arredondamento dos cartões. A mudança é aplicada em toda a interface."
            >
              <div className="grid gap-5 xl:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                  <h3 className="mb-3 text-sm font-bold">Fonte do sistema</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['inter', 'roboto', 'poppins', 'montserrat', 'sora'] as const).map((font) => <button key={font} type="button" aria-pressed={appearance.font === font} onClick={() => setAppearance({ ...appearance, font })} className={`flex min-h-12 items-center justify-between gap-1 rounded-md border bg-white px-2 text-left text-sm font-semibold dark:bg-slate-900 ${appearance.font === font ? 'border-public-600 ring-1 ring-public-600' : 'hover:border-public-600'}`}><span className="capitalize">{font}</span><span className="shrink-0 whitespace-nowrap text-[10px] text-slate-500" style={{ fontFamily: font, fontWeight: 500 }}>Aa Bb 123</span></button>)}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                  <h3 className="mb-3 text-sm font-bold">Arredondamento dos cartões</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {([{ id: 'square', label: 'Reto', radius: '0' }, { id: 'subtle', label: 'Leve', radius: '.375rem' }, { id: 'default', label: 'Padrão', radius: '.75rem' }, { id: 'medium', label: 'Médio', radius: '1rem' }, { id: 'rounded', label: 'Arredondado', radius: '1.5rem' }, { id: 'pill', label: 'Bem arredondado', radius: '2rem' }] as const).map((option) => <button key={option.id} type="button" aria-pressed={appearance.cardRadius === option.id} onClick={() => setAppearance({ ...appearance, cardRadius: option.id })} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border bg-white p-2 text-center text-[11px] font-semibold dark:bg-slate-900 ${appearance.cardRadius === option.id ? 'border-public-600 ring-1 ring-public-600' : 'hover:border-public-600'}`}><span className="h-8 w-full border border-emerald-600/40 bg-emerald-600/15" style={{ borderRadius: option.radius }} aria-hidden="true"/>{option.label}</button>)}
                  </div>
                </div>
                <div className="order-first rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50 xl:order-last">
                  <h3 className="text-sm font-bold">Tamanho da fonte</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recurso de acessibilidade aplicado em toda a interface.</p>
                  <div className="mt-3 space-y-2">
                    {([{ id: 'default', label: 'Padrão', detail: 'Tamanho atual do sistema.' }, { id: 'large', label: 'Grande', detail: 'Aumenta a leitura em 12,5%.' }, { id: 'very-large', label: 'Muito grande', detail: 'Aumenta a leitura em 25%.' }, { id: 'extra-large', label: 'Extra grande', detail: 'Aumenta a leitura em 37,5%.' }] as const).map((option) => <button key={option.id} type="button" aria-pressed={appearance.fontSize === option.id} onClick={() => setAppearance({ ...appearance, fontSize: option.id })} className={`flex min-h-16 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left dark:bg-slate-900 ${appearance.fontSize === option.id ? 'border-public-600 ring-1 ring-public-600' : 'hover:border-public-600'}`}><span><strong className="block text-lg">Aa</strong><small className="text-xs text-slate-500 dark:text-slate-400">{option.label} · {option.detail}</small></span>{appearance.fontSize === option.id && <span aria-hidden="true">✓</span>}</button>)}
                  </div>
                </div>
              </div>
            </SettingsSection>
            <SettingsSection
              icon={Palette}
              title="Tema e cores"
              detail="Escolha uma paleta rápida e ajuste as cinco cores de cada modo. O texto é adaptado automaticamente para contraste WCAG AA."
            >
              <div>
                <h3 className="text-sm font-bold">Paletas rápidas</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Escolha um ponto de partida e ajuste cada cor se desejar.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {appearancePresets.map((preset) => {
                    const lightSelected = Object.entries(preset.lightColors).every(([key, value]) => appearance[key as keyof AppearancePalette] === value);
                    const darkSelected = appearance.darkAccent === preset.darkColors.accent && appearance.darkSidebarColor === preset.darkColors.sidebarColor && appearance.darkHeaderColor === preset.darkColors.headerColor && appearance.darkBackgroundColor === preset.darkColors.backgroundColor && appearance.darkFooterColor === preset.darkColors.footerColor;
                    const selected = lightSelected && darkSelected;
                    return <button key={preset.name} type="button" aria-label={`Aplicar paleta ${preset.name}`} aria-pressed={selected} onClick={() => applyAppearancePreset(preset)} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm focus-visible:ring-2 ${selected ? "border-public-600 ring-2 ring-public-100 dark:ring-public-950" : "border-transparent bg-slate-50 dark:bg-slate-800/60"}`}>
                      <span className="flex shrink-0 -space-x-2" aria-hidden="true">
                        {[preset.lightColors.accent, preset.lightColors.sidebarColor, preset.darkColors.backgroundColor].map((color, index) => <span key={index} className="size-9 rounded-full border-2 border-white dark:border-slate-800" style={{ backgroundColor: color }}/>) }
                      </span>
                      <span><strong className="block text-sm">{preset.name}</strong><small className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{selected ? "Paleta aplicada" : "Aplicar paleta"}</small></span>
                    </button>;
                  })}
                </div>
              </div>
              <div className="mt-6 grid gap-4 border-t pt-6 xl:grid-cols-2">
                <AppearanceModeCard mode="light" active={theme === "light"} onSelect={() => setTheme("light")} colors={{ accent: appearance.accent, sidebarColor: appearance.sidebarColor, headerColor: appearance.headerColor, footerColor: appearance.footerColor, backgroundColor: appearance.backgroundColor }} onColorChange={(key, value) => setAppearance({ ...appearance, [key]: value })}/>
                <AppearanceModeCard mode="dark" active={theme === "dark"} onSelect={() => setTheme("dark")} colors={{ accent: appearance.darkAccent, sidebarColor: appearance.darkSidebarColor, headerColor: appearance.darkHeaderColor, footerColor: appearance.darkFooterColor, backgroundColor: appearance.darkBackgroundColor }} onColorChange={(key, value) => setAppearance({ ...appearance, [{ accent: 'darkAccent', sidebarColor: 'darkSidebarColor', headerColor: 'darkHeaderColor', footerColor: 'darkFooterColor', backgroundColor: 'darkBackgroundColor' }[key]]: value })}/>
              </div>
            </SettingsSection>
            <SettingsSection
              icon={PanelLeft}
              title="Modo do sidebar"
              detail="No modo compacto, o menu exibe apenas os ícones e se expande temporariamente ao passar o mouse."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  aria-label="Usar sidebar expandido"
                  onClick={() => setAppearance({ ...appearance, sidebar: "expanded" })}
                  className={`rounded-xl border p-4 text-left transition ${
                    appearance.sidebar === "expanded"
                      ? "border-public-500 bg-public-50 ring-2 ring-public-100 dark:bg-public-950/30 dark:ring-public-950"
                      : "hover:border-public-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <strong className="block text-sm">Expandido</strong>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    Mantém o nome e os ícones de todos os itens visíveis.
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Usar sidebar compacto"
                  onClick={() => setAppearance({ ...appearance, sidebar: "compact" })}
                  className={`rounded-xl border p-4 text-left transition ${
                    appearance.sidebar === "compact"
                      ? "border-public-500 bg-public-50 ring-2 ring-public-100 dark:bg-public-950/30 dark:ring-public-950"
                      : "hover:border-public-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <strong className="block text-sm">Compacto</strong>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    Mostra os ícones e abre o menu completo no hover ou foco.
                  </span>
                </button>
              </div>
            </SettingsSection>
            <SettingsSection
              icon={ZoomIn}
              title="Zoom da interface"
              detail="Ajusta a escala visual sem alterar os dados ou o tamanho de impressão."
            >
              <div className="flex flex-wrap items-center gap-4">
                <Input
                  aria-label="Zoom da interface"
                  className="w-full accent-public-700 md:max-w-md"
                  type="range"
                  min="80"
                  max="120"
                  step="5"
                  value={appearance.zoom}
                  onChange={(event) =>
                    setAppearance({
                      ...appearance,
                      zoom: Number(event.target.value),
                    })
                  }
                />
                <strong className="min-w-14 text-lg tabular-nums">
                  {appearance.zoom}%
                </strong>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setAppearance({ ...defaultAppearance })}
                >
                  <RotateCcw size={16} />
                  Restaurar
                </button>
              </div>
            </SettingsSection>
          </div>
        )}
      </section>
    </div>
  );
}
function AppearanceModeCard({ mode, active, onSelect, colors, onColorChange }: { mode: 'light' | 'dark'; active: boolean; onSelect: () => void; colors: AppearancePalette; onColorChange: (key: keyof AppearancePalette, value: string) => void }) {
  const fields: { key: keyof AppearancePalette; label: string; detail: string }[] = [
    { key: 'accent', label: 'Cor primária', detail: 'Botões, links, foco e destaques.' },
    { key: 'sidebarColor', label: 'Sidebar', detail: 'Navegação lateral.' },
    { key: 'headerColor', label: 'Cabeçalho', detail: 'Barra superior do sistema.' },
    { key: 'footerColor', label: 'Rodapé', detail: 'Barra inferior; texto ajustado automaticamente.' },
    { key: 'backgroundColor', label: 'Fundo', detail: 'Base da página e dos cartões.' },
  ];
  const isLight = mode === 'light';
  return <section className={`rounded-xl border bg-slate-50/70 p-4 dark:bg-slate-800/40 ${active ? 'border-public-600' : ''}`}>
    <button type="button" aria-pressed={active} onClick={onSelect} className="mb-5 flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:ring-2">
      <span className="flex items-center gap-2">{isLight ? <Sun size={20} className="text-public-700"/> : <Moon size={20} className="text-public-700"/>}<span><strong className="block text-sm">Modo {isLight ? 'claro' : 'escuro'}</strong><small className="block text-xs text-slate-500 dark:text-slate-400">{isLight ? 'Superfícies luminosas e nítidas.' : 'Contraste confortável em baixa luz.'}</small></span></span>
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">{active ? 'ATIVO' : isLight ? 'LIGHT' : 'DARK'}</span>
    </button>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
      {fields.map(({ key, label, detail }) => <AppearanceColorField key={key} label={label} context={`modo ${isLight ? 'claro' : 'escuro'}`} detail={detail} value={colors[key]} onChange={(value) => onColorChange(key, value)}/>)}
    </div>
  </section>;
}
function AppearanceColorField({ label, context, detail, value, onChange }: { label: string; context: string; detail: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value.toUpperCase());
  useEffect(() => setDraft(value.toUpperCase()), [value]);
  const update = (next: string) => { setDraft(next.toUpperCase()); if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase()); };
  return <div className="min-w-0"><span className="mb-1.5 block text-xs font-bold">{label}</span><div className="flex h-12 items-center gap-2 rounded-md border bg-white p-1 dark:bg-slate-900"><Input aria-label={`Selecionar ${label.toLowerCase()} do ${context}`} className="h-9 w-11 shrink-0 cursor-pointer border-0 p-0" type="color" value={value} onChange={(event) => onChange(event.target.value)}/><Input aria-label={`${label} do ${context} em hexadecimal`} className="min-w-0 flex-1 border-0 bg-transparent px-1 font-mono text-xs uppercase" value={draft} maxLength={7} onChange={(event) => update(event.target.value)} onBlur={() => setDraft(value.toUpperCase())} placeholder="#17628B"/></div><small className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{detail}</small></div>;
}
function SettingField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
function SettingsSection({
  icon: Icon,
  title,
  detail,
  children,
}: {
  icon: typeof SlidersHorizontal;
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t pt-6 first:border-t-0 first:pt-0">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Icon size={17} className="text-public-700" />
          {title}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {detail}
        </p>
      </header>
      {children}
    </section>
  );
}
