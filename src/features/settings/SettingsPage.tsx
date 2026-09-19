import { useEffect, useRef, useState } from "react";
import {
  Building2,
  FileText,
  Globe2,
  ImagePlus,
  Landmark,
  Palette,
  PanelLeft,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
  Type,
  ZoomIn,
} from "lucide-react";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { Loading, PageTitle } from "../../components/ui/Feedback";
import { defaultAppearance, useSession } from "../../app/session";
import type { AppearancePalette } from "../../app/session";
import { useDb } from "../../app/queries";
type Tab = "general" | "portal" | "appearance";
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
  detail: string;
  theme: "light" | "dark";
  lightColors: AppearancePalette;
  darkColors: AppearancePalette;
};
const appearancePresets: AppearancePreset[] = [
  {
    name: "Oceano", detail: "Azul institucional nos dois modos", theme: "light",
    lightColors: { sidebarColor: "#dce8ee", headerColor: "#dce8ee", accent: "#17628b", backgroundColor: "#ffffff" },
    darkColors: { sidebarColor: "#0f2935", headerColor: "#11202b", accent: "#2a95c5", backgroundColor: "#020617" },
  },
  {
    name: "Esmeralda", detail: "Verde sóbrio nos dois modos", theme: "light",
    lightColors: { sidebarColor: "#dcece7", headerColor: "#e7f1ed", accent: "#0f766e", backgroundColor: "#fbfdfc" },
    darkColors: { sidebarColor: "#0d2926", headerColor: "#102f2b", accent: "#2dd4bf", backgroundColor: "#071310" },
  },
  {
    name: "Terracota", detail: "Tons quentes nos dois modos", theme: "light",
    lightColors: { sidebarColor: "#f0e0d6", headerColor: "#f5e9e1", accent: "#9a3412", backgroundColor: "#fffdfb" },
    darkColors: { sidebarColor: "#321c16", headerColor: "#3b2118", accent: "#fb923c", backgroundColor: "#160b07" },
  },
  {
    name: "Violeta", detail: "Contraste suave nos dois modos", theme: "light",
    lightColors: { sidebarColor: "#e9e0f2", headerColor: "#f0e9f6", accent: "#7e22ce", backgroundColor: "#fefcff" },
    darkColors: { sidebarColor: "#28183a", headerColor: "#302044", accent: "#c084fc", backgroundColor: "#11091c" },
  },
  {
    name: "Noturno", detail: "Grafite claro e azul profundo", theme: "dark",
    lightColors: { sidebarColor: "#e2e8f0", headerColor: "#f1f5f9", accent: "#334155", backgroundColor: "#f8fafc" },
    darkColors: { sidebarColor: "#0b1220", headerColor: "#111827", accent: "#38bdf8", backgroundColor: "#020617" },
  },
];
const GENERAL_KEY = "fluxo-publico:settings-general";
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
        localStorage.getItem(GENERAL_KEY) ?? "{}",
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
  const { theme, setTheme, appearance, setAppearance } = useSession();
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
  const update = (key: keyof GeneralSettings, value: string | boolean) =>
    setGeneral((current) => ({ ...current, [key]: value }));
  const saveGeneral = () => {
    try {
      if (general.publicUrl.trim()) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(general.publicUrl.trim()) && !/^https?:\/\//i.test(general.publicUrl.trim())) throw new Error('Informe um endereço público HTTP ou HTTPS válido.');
        const address = new URL(/^https?:\/\//i.test(general.publicUrl.trim()) ? general.publicUrl.trim() : `https://${general.publicUrl.trim()}`);
        if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password) throw new Error('Informe um endereço público HTTP ou HTTPS válido.');
      }
      localStorage.setItem(GENERAL_KEY, JSON.stringify(general));
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
  const previewNumber = `2026.09.16.${String(42).padStart(Number(general.sequencePadding) || 4, "0")}`;
  const applyAppearancePreset = (preset: AppearancePreset) => {
    setAppearance({
      ...appearance,
      ...preset.lightColors,
      darkAccent: preset.darkColors.accent,
      darkSidebarColor: preset.darkColors.sidebarColor,
      darkHeaderColor: preset.darkColors.headerColor,
      darkBackgroundColor: preset.darkColors.backgroundColor,
    });
    setTheme(preset.theme);
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
        eyebrow="Administração"
        title="Configurações"
        action={
          <button className="btn-primary" onClick={saveGeneral} disabled={uploadingLogo}>
            <Save size={16} />
            Salvar configurações
          </button>
        }
      />
      <p className="-mt-3 mb-6 text-sm text-slate-600 dark:text-slate-300">
        Personalize dados institucionais, portal e aparência do sistema.
      </p>
      <section className="panel overflow-hidden">
        <div
          role="tablist"
          aria-label="Seções de configurações"
          className="m-3 grid grid-cols-3 rounded-md bg-[#efede5] p-1 dark:bg-slate-800"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-label={label}
              aria-selected={tab === id}
              aria-controls={`settings-${id}`}
              onClick={() => setTab(id)}
              className={`flex min-h-9 items-center justify-center gap-2 rounded px-3 text-sm font-semibold transition-colors ${tab === id ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"}`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        {tab === "general" && (
          <div
            id="settings-general"
            role="tabpanel"
            className="space-y-7 p-5 sm:p-7"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SettingField label="Nome da organização">
                <Input
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
                <Input
                  value={general.cnpj}
                  onChange={(event) => update("cnpj", event.target.value)}
                />
              </SettingField>
              <SettingField label="Cidade">
                <Input
                  value={general.city}
                  onChange={(event) => update("city", event.target.value)}
                />
              </SettingField>
              <SettingField label="UF">
                <Input
                  maxLength={2}
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
                  value={general.email}
                  onChange={(event) => update("email", event.target.value)}
                />
              </SettingField>
              <SettingField label="Telefone">
                <Input
                  value={general.phone}
                  onChange={(event) => update("phone", event.target.value)}
                />
              </SettingField>
              <SettingField label="Endereço">
                <Input
                  value={general.address}
                  onChange={(event) => update("address", event.target.value)}
                />
              </SettingField>
            </div>
            <SettingsSection
              icon={FileText}
              title="Numeração de processos"
              detail="Formato do número gerado automaticamente ao abrir um novo processo."
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
                <SettingField label="Prévia">
                  <Input
                    readOnly
                    className="bg-slate-50 dark:bg-slate-800"
                    value={previewNumber}
                  />
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
                    value={general.organizationName}
                    onChange={(event) =>
                      update("organizationName", event.target.value)
                    }
                  />
                </SettingField>
                <SettingField label="Linha 2 do timbre">
                  <Input
                    value={general.cnpj}
                    onChange={(event) => update("cnpj", event.target.value)}
                  />
                </SettingField>
              </div>
              <div className="mt-5 grid gap-4 border-t pt-5 md:grid-cols-2">
                <SettingField label="Largura da etiqueta (pt)">
                  <Input
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
        {tab === "portal" && (
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
                  <Input value={general.portalName || db.organization.name} onChange={(event) => update("portalName", event.target.value)} />
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
        {tab === "appearance" && (
          <div
            id="settings-appearance"
            role="tabpanel"
            className="space-y-7 p-5 sm:p-7"
          >
            <SettingsSection
              icon={Palette}
              title="Tema e cores"
              detail="Defina as cores dos modos claro e escuro separadamente ou aplique um preset completo para ambos."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" aria-label="Selecionar tema claro" onClick={() => setTheme("light")} className={`rounded-lg border p-4 text-left transition-shadow ${theme === "light" ? "border-public-600 ring-2 ring-public-100 dark:ring-public-950" : "hover:shadow-sm"}`}>
                  <span className="mb-4 block h-12 rounded bg-slate-100"></span><strong className="block text-sm">Tema claro</strong><small className="mt-1 block text-xs text-slate-500">Interface clara e neutra.</small>
                </button>
                <button type="button" aria-label="Selecionar tema escuro" onClick={() => setTheme("dark")} className={`rounded-lg border p-4 text-left transition-shadow ${theme === "dark" ? "border-public-600 ring-2 ring-public-100 dark:ring-public-950" : "hover:shadow-sm"}`}>
                  <span className="mb-4 block h-12 rounded bg-slate-900"></span><strong className="block text-sm">Tema escuro</strong><small className="mt-1 block text-xs text-slate-500">Reduz o brilho em ambientes escuros.</small>
                </button>
              </div>
              <div className="mt-6">
                <p className="label mb-3">Presets rápidos</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {appearancePresets.map((preset) => {
                    const lightSelected = Object.entries(preset.lightColors).every(([key, value]) => appearance[key as keyof AppearancePalette] === value);
                    const darkSelected = appearance.darkAccent === preset.darkColors.accent && appearance.darkSidebarColor === preset.darkColors.sidebarColor && appearance.darkHeaderColor === preset.darkColors.headerColor && appearance.darkBackgroundColor === preset.darkColors.backgroundColor;
                    const selected = lightSelected && darkSelected;
                    return <button key={preset.name} type="button" aria-label={`Aplicar preset ${preset.name}`} aria-pressed={selected} onClick={() => applyAppearancePreset(preset)} className={`rounded-lg border p-3 text-left transition ${selected ? "border-public-600 ring-2 ring-public-100 dark:ring-public-950" : "hover:-translate-y-0.5 hover:shadow-sm"}`}>
                      <span className="mb-2 grid h-9 grid-rows-2 overflow-hidden rounded border border-black/10" aria-hidden="true">
                        <span className="grid grid-cols-4"><span style={{ backgroundColor: preset.lightColors.sidebarColor }}/><span style={{ backgroundColor: preset.lightColors.headerColor }}/><span style={{ backgroundColor: preset.lightColors.accent }}/><span style={{ backgroundColor: preset.lightColors.backgroundColor }}/></span>
                        <span className="grid grid-cols-4"><span style={{ backgroundColor: preset.darkColors.sidebarColor }}/><span style={{ backgroundColor: preset.darkColors.headerColor }}/><span style={{ backgroundColor: preset.darkColors.accent }}/><span style={{ backgroundColor: preset.darkColors.backgroundColor }}/></span>
                      </span>
                      <strong className="block text-sm">{preset.name}</strong><small className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{preset.detail}</small>
                    </button>;
                  })}
                </div>
              </div>
              <div className="mt-6 space-y-5">
                <section className="rounded-lg border p-4">
                  <div className="mb-4"><p className="text-sm font-bold">Cores do tema claro</p><p className="mt-1 text-xs text-muted-foreground">Aplicadas quando o sistema estiver no modo claro.</p></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <AppearanceColorField label="Cor da sidebar — tema claro" value={appearance.sidebarColor} onChange={(sidebarColor) => setAppearance({ ...appearance, sidebarColor })}/>
                    <AppearanceColorField label="Cor do header — tema claro" value={appearance.headerColor} onChange={(headerColor) => setAppearance({ ...appearance, headerColor })}/>
                    <AppearanceColorField label="Cor primária — tema claro" value={appearance.accent} onChange={(accent) => setAppearance({ ...appearance, accent })}/>
                    <AppearanceColorField label="Cor de fundo — tema claro" value={appearance.backgroundColor} onChange={(backgroundColor) => setAppearance({ ...appearance, backgroundColor })}/>
                  </div>
                </section>
                <section className="rounded-lg border p-4">
                  <div className="mb-4"><p className="text-sm font-bold">Cores do tema escuro</p><p className="mt-1 text-xs text-muted-foreground">Aplicadas quando o sistema estiver no modo escuro.</p></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <AppearanceColorField label="Cor da sidebar — tema escuro" value={appearance.darkSidebarColor} onChange={(darkSidebarColor) => setAppearance({ ...appearance, darkSidebarColor })}/>
                    <AppearanceColorField label="Cor do header — tema escuro" value={appearance.darkHeaderColor} onChange={(darkHeaderColor) => setAppearance({ ...appearance, darkHeaderColor })}/>
                    <AppearanceColorField label="Cor primária — tema escuro" value={appearance.darkAccent} onChange={(darkAccent) => setAppearance({ ...appearance, darkAccent })}/>
                    <AppearanceColorField label="Cor de fundo — tema escuro" value={appearance.darkBackgroundColor} onChange={(darkBackgroundColor) => setAppearance({ ...appearance, darkBackgroundColor })}/>
                  </div>
                </section>
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
              icon={Type}
              title="Fonte do sistema"
              detail="Define a tipografia da interface e dos relatórios exibidos em tela."
            >
              <SettingField label="Família tipográfica">
                <Select
                  value={appearance.font}
                  onChange={(event) =>
                    setAppearance({
                      ...appearance,
                      font: event.target.value as typeof appearance.font,
                    })
                  }
                >
                  <option value="inter">Inter</option>
                  <option value="roboto">Roboto</option>
                  <option value="system">Fonte do sistema</option>
                </Select>
              </SettingField>
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
function AppearanceColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const update = (next: string) => { if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase()); };
  return <SettingField label={label}><div className="flex items-center gap-3"><Input aria-label={label} className="h-11 w-16 cursor-pointer p-1" type="color" value={value} onChange={(event) => onChange(event.target.value)}/><Input aria-label={`${label} hexadecimal`} className="w-32 font-mono uppercase" value={value.toUpperCase()} onChange={(event) => update(event.target.value)}/><span className="h-9 flex-1 rounded-md border" style={{ backgroundColor: value }} aria-hidden="true"/></div></SettingField>;
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
