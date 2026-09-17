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
import { useSession } from "../../app/session";
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
};
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
  const [logoName, setLogoName] = useState("");
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
  const update = (key: keyof GeneralSettings, value: string) =>
    setGeneral((current) => ({ ...current, [key]: value }));
  const saveGeneral = () => {
    localStorage.setItem(GENERAL_KEY, JSON.stringify(general));
    window.dispatchEvent(new Event("fluxo-publico:settings-general"));
    notify("Configurações gerais salvas com sucesso.");
  };
  const previewNumber = `2026.09.16.${String(42).padStart(Number(general.sequencePadding) || 4, "0")}`;
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
          <button className="btn-primary" onClick={saveGeneral}>
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
              title="Numeração de protocolos"
              detail="Formato do número gerado automaticamente ao abrir um novo protocolo."
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
                onChange={(event) =>
                  setLogoName(event.target.files?.[0]?.name ?? "")
                }
              />
              <div className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-950/40">
                <p className="label">Brasão / logo da entidade</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="grid size-16 place-items-center rounded-md border bg-white text-public-700 dark:bg-slate-900">
                    <Landmark size={29} />
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
                      {logoName && (
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => setLogoName("")}
                        >
                          <Trash2 size={16} />
                          Remover
                        </button>
                      )}
                    </div>
                    <p className="mt-2 truncate text-xs text-slate-500">
                      {logoName ||
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
                  <Input defaultValue={db.organization.name} />
                </SettingField>
                <SettingField label="Endereço público">
                  <Input defaultValue="portal.exemplo.gov.br/protocolos" />
                </SettingField>
              </div>
              <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border bg-slate-50 p-4 dark:bg-slate-950/40">
                <span>
                  <strong className="block text-sm">
                    Permitir consulta pública
                  </strong>
                  <small className="mt-1 block text-xs text-slate-500">
                    Exige número e código verificador do protocolo.
                  </small>
                </span>
                <Switch defaultChecked aria-label="Permitir consulta pública" />
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
              detail="As escolhas são aplicadas imediatamente nesta instalação."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  aria-label="Selecionar tema claro"
                  onClick={() => setTheme("light")}
                  className={`rounded-lg border p-4 text-left transition-shadow ${theme === "light" ? "border-public-600 ring-2 ring-public-100 dark:ring-public-950" : "hover:shadow-sm"}`}
                >
                  <span className="mb-4 block h-12 rounded bg-slate-100"></span>
                  <strong className="block text-sm">Tema claro</strong>
                  <small className="mt-1 block text-xs text-slate-500">
                    Interface clara e neutra.
                  </small>
                </button>
                <button
                  type="button"
                  aria-label="Selecionar tema escuro"
                  onClick={() => setTheme("dark")}
                  className={`rounded-lg border p-4 text-left transition-shadow ${theme === "dark" ? "border-public-600 ring-2 ring-public-100 dark:ring-public-950" : "hover:shadow-sm"}`}
                >
                  <span className="mb-4 block h-12 rounded bg-slate-900"></span>
                  <strong className="block text-sm">Tema escuro</strong>
                  <small className="mt-1 block text-xs text-slate-500">
                    Reduz o brilho em ambientes escuros.
                  </small>
                </button>
              </div>
              <div className="mt-6 flex flex-wrap items-end gap-4">
                <SettingField label="Cor de destaque">
                  <div className="flex items-center gap-3">
                    <Input
                      aria-label="Cor de destaque"
                      className="h-11 w-16 cursor-pointer p-1"
                      type="color"
                      value={appearance.accent}
                      onChange={(event) =>
                        setAppearance({
                          ...appearance,
                          accent: event.target.value,
                        })
                      }
                    />
                    <Input
                      className="w-32"
                      value={appearance.accent.toUpperCase()}
                      onChange={(event) =>
                        /^#[0-9A-Fa-f]{6}$/.test(event.target.value) &&
                        setAppearance({
                          ...appearance,
                          accent: event.target.value,
                        })
                      }
                    />
                  </div>
                </SettingField>
                {["#17628b", "#0f766e", "#9a3412", "#7e22ce"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Usar cor ${color}`}
                    onClick={() =>
                      setAppearance({ ...appearance, accent: color })
                    }
                    className={`size-9 rounded-full border-4 transition-transform hover:scale-110 ${appearance.accent === color ? "border-slate-400" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
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
                  onClick={() =>
                    setAppearance({
                      accent: "#17628b",
                      font: "inter",
                      zoom: 100,
                      sidebar: "expanded",
                    })
                  }
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
