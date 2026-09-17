import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { MouseEvent, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ClipboardList,
  FileText,
  Home,
  Landmark,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  Settings,
  Settings2,
  Sun,
  Users,
} from "lucide-react";
import { Select } from "../../components/ui/Select";
import { resetDb } from "../../storage/database";
import { invalidateAll, useDb } from "../queries";
import { useSession } from "../session";
import { ROUTE_LOADING_EVENT, navigateWithLoading } from "../routeLoading";
type OrganizationHeaderDetails = {
  organizationName?: string;
  city?: string;
  state?: string;
  cnpj?: string;
};
const readOrganizationHeaderDetails = (): OrganizationHeaderDetails => {
  try {
    return JSON.parse(localStorage.getItem("fluxo-publico:settings-general") ?? "{}") as OrganizationHeaderDetails;
  } catch {
    return {};
  }
};
function RouteLoadingIndicator() {
  const location = useLocation();
  const previousLocationKey = useRef(location.key);
  const dismissTimer = useRef<number>();
  const [visible, setVisible] = useState(false);
  const show = useCallback(() => {
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    setVisible(true);
  }, []);
  useEffect(() => {
    window.addEventListener(ROUTE_LOADING_EVENT, show);
    return () => window.removeEventListener(ROUTE_LOADING_EVENT, show);
  }, [show]);
  useLayoutEffect(() => {
    if (previousLocationKey.current === location.key) return;
    previousLocationKey.current = location.key;
    show();
    dismissTimer.current = window.setTimeout(() => setVisible(false), 900);
    return () => {
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    };
  }, [location.key, show]);
  if (!visible) return null;
  return (
    <div
      className="route-loading-overlay"
      role="status"
      aria-label="Carregando tela"
      aria-live="polite"
    >
      <div className="route-loading-indicator">
        <img
          className="route-loading-icon"
          src="/assets/file-sync.svg"
          alt=""
        />
        <span className="sr-only">Carregando tela</span>
      </div>
    </div>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    users,
    setUserId,
    activeUnitId,
    setActiveUnitId,
    theme,
    toggleTheme,
    appearance,
    setAppearance,
  } = useSession();
  const { data: sessionDb } = useDb();
  const compactSidebar = appearance.sidebar === 'compact';
  const [mobile, setMobile] = useState(false);
  const [organizationDetails, setOrganizationDetails] = useState<OrganizationHeaderDetails>(readOrganizationHeaderDetails);
  const [resetting, setResetting] = useState(false);
  const queryClient = useQueryClient();
  useEffect(() => {
    const syncOrganizationDetails = () => setOrganizationDetails(readOrganizationHeaderDetails());
    window.addEventListener("fluxo-publico:settings-general", syncOrganizationDetails);
    window.addEventListener("storage", syncOrganizationDetails);
    return () => {
      window.removeEventListener("fluxo-publico:settings-general", syncOrganizationDetails);
      window.removeEventListener("storage", syncOrganizationDetails);
    };
  }, []);
  const nav = [
    {
      group: "Trabalho",
      items: [
        ["/dashboard", "Visão geral", Home],
        ["/protocolos", "Protocolos", ClipboardList],
        ["/documentos", "Documentos", FileText],
      ],
    },
    {
      group: "Cadastros",
      items: [
        ["/pessoas", "Pessoas", Users],
        ["/estrutura", "Estrutura", Landmark],
        ["/tipos-protocolo", "Tipos de protocolo", Settings2],
        ["/tipos-documento", "Tipos de documento", FileText],
        ["/usuarios", "Usuários", Users],
        ["/configuracoes", "Configurações", Settings],
      ],
    },
  ];
  const initials =
    user?.name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() ?? "US";
  const handleInternalNavigation = (event: MouseEvent<HTMLElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.defaultPrevented
    )
      return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a[href]") as HTMLAnchorElement | null;
    if (
      !link ||
      link.hasAttribute("download") ||
      (link.target && link.target !== "_self")
    )
      return;
    const destination = new URL(link.href, window.location.href);
    const current = new URL(window.location.href);
    if (
      destination.origin !== current.origin ||
      `${destination.pathname}${destination.search}${destination.hash}` ===
        `${current.pathname}${current.search}${current.hash}`
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    if (link.closest("#mobile-navigation")) setMobile(false);
    navigateWithLoading(
      navigate,
      `${destination.pathname}${destination.search}${destination.hash}`,
    );
  };
  const sidebar = (
    <aside
      aria-label="Navegação principal"
      className={`pgci-sidebar ${compactSidebar ? "pgci-sidebar-compact" : ""} flex h-full w-[240px] flex-col bg-[#ededed] text-[#474747] dark:bg-slate-900 dark:text-slate-200`}
    >
      <Link
        to="/dashboard"
        className="sidebar-brand flex h-[72px] items-center gap-3 border-b border-slate-300 px-6 dark:border-slate-700"
      >
        <span className="grid h-[43px] w-[35px]">
          <img
            src="/assets/pgci-logo.svg"
            alt=""
            className="pgci-logo h-full w-full"
          />
        </span>
        <strong className="sidebar-brand-label text-[2.5rem] font-black tracking-[-.1em] text-black dark:text-white">
          PGCI
        </strong>
      </Link>
      <nav className="sidebar-navigation px-6 py-7">
        {nav.map((group, index) => (
          <section
            key={group.group ?? `principal-${index}`}
            className={index ? "mt-6" : ""}
          >
            {group.group && (
              <p className="sidebar-group-label mb-2 mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {group.group}
              </p>
            )}
            {group.items.map(([path, label, Icon]) => (
              <NavLink
                key={`${group.group ?? "principal"}-${label as string}`}
                to={path as string}
                title={compactSidebar ? label as string : undefined}
                onClick={(event) => {
                  event.currentTarget.blur();
                  setMobile(false);
                  if (location.pathname === path) event.preventDefault();
                }}
                className={({ isActive }) =>
                  `pgci-nav-link ${isActive ? "pgci-nav-link-active" : ""}`
                }
              >
                <Icon size={16} />
                <span className="sidebar-label">{label as string}</span>
              </NavLink>
            ))}
          </section>
        ))}
      </nav>
      <div className="mt-auto border-t border-slate-300 px-6 py-5 dark:border-slate-700">
        <button
          className="pgci-nav-link w-full text-left"
          onClick={async () => {
            if (!confirm("Restaurar todos os dados fictícios da demonstração?"))
              return;
            setResetting(true);
            await resetDb();
            await invalidateAll(queryClient);
            setResetting(false);
            navigateWithLoading(navigate, "/dashboard");
          }}
          disabled={resetting}
        >
          <RefreshCcw size={16} />
          <span className="sidebar-label">{resetting ? "Restaurando…" : "Restaurar demonstração"}</span>
        </button>
      </div>
    </aside>
  );
  const isDashboard = location.pathname === "/dashboard";
  return (
    <>
      <div
        className={`min-h-[calc(100dvh-3.5rem)] lg:grid ${compactSidebar ? "lg:grid-cols-[72px_1fr]" : "lg:grid-cols-[240px_1fr]"}`}
        onClickCapture={handleInternalNavigation}
      >
        <div className={`hidden lg:block ${compactSidebar ? "w-[72px]" : "w-[240px]"}`}>{sidebar}</div>
        {mobile && (
          <div id="mobile-navigation" className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-950/50"
              onClick={() => setMobile(false)}
            />
            <div className="pgci-mobile-sidebar relative h-full w-72">{sidebar}</div>
          </div>
        )}
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo
        </a>
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 bg-white dark:bg-slate-950"
        >
          <header className="no-print sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-300 bg-[#ededed] px-4 dark:border-slate-700 dark:bg-slate-900 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Abrir menu"
                aria-controls="mobile-navigation"
                aria-expanded={mobile}
                className="header-icon-button lg:hidden"
                onClick={() => setMobile(true)}
              >
                <Menu size={18} />
              </button>
              <button
                type="button"
                className="header-sidebar-toggle header-icon-button hidden lg:inline-grid"
                aria-label={compactSidebar ? "Manter sidebar expandido" : "Minimizar sidebar"}
                aria-pressed={!compactSidebar}
                title={compactSidebar ? "Manter sidebar expandido" : "Minimizar sidebar"}
                onClick={() => setAppearance({ ...appearance, sidebar: compactSidebar ? "expanded" : "compact" })}
              >
                {compactSidebar ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
              <div className="min-w-0 leading-tight">
                <strong className="block truncate text-base font-semibold text-slate-900 dark:text-white sm:text-xl">
                  {organizationDetails.organizationName || sessionDb?.organization.name || "Prefeitura Municipal"}
                </strong>
                {Boolean(organizationDetails.city || organizationDetails.cnpj) && (
                  <small className="mt-1 block truncate text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:text-[11px]">
                    {[
                      organizationDetails.city && [organizationDetails.city, organizationDetails.state].filter(Boolean).join(" - "),
                      organizationDetails.cnpj && `CNPJ ${organizationDetails.cnpj}`,
                    ].filter(Boolean).join(" · ")}
                  </small>
                )}
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-1 sm:gap-2">
              <span
                className="header-icon-button hidden sm:!grid"
                aria-hidden="true"
              >
                <Bell size={18} />
              </span>
              <span
                className="header-icon-button hidden sm:!grid"
                aria-hidden="true"
              >
                <MessageSquare size={18} />
              </span>
              <span
                className="hidden h-6 w-px bg-slate-300 sm:block dark:bg-slate-700"
                aria-hidden="true"
              />

              <button
                type="button"
                className="header-icon-button"
                aria-label={
                  theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
                }
                onClick={toggleTheme}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <span
                className="hidden h-6 w-px bg-slate-300 sm:block dark:bg-slate-700"
                aria-hidden="true"
              />
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-100">
                {initials}
              </span>
              <div className="hidden min-w-0 sm:block">
                <label className="sr-only" htmlFor="demo-user">
                  Usuário de demonstração
                </label>
                <Select
                  id="demo-user"
                  className="pgci-user-select !mt-0 !min-h-9 !w-[145px] !border-0 !bg-transparent !px-1 !py-0 text-xs font-bold"
                  value={user?.id ?? ""}
                  onChange={(event) => {
                    setUserId(event.target.value);
                    invalidateAll(queryClient);
                  }}
                >
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <small className="-mt-1 block truncate px-1 text-[9px] font-bold uppercase text-slate-500">
                  {user?.role === "ADMIN" ? "Administrador geral" : "Operador"}
                </small>
              </div>
              {user?.role === "ADMIN" && sessionDb && (
                <div className="sr-only">
                  <label htmlFor="active-unit">Unidade ativa</label>
                  <Select
                    id="active-unit"
                    value={activeUnitId}
                    onChange={(event) => {
                      setActiveUnitId(event.target.value);
                      invalidateAll(queryClient);
                    }}
                  >
                    {sessionDb.units
                      .filter((unit) => unit.active)
                      .map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.abbreviation} · {unit.name}
                        </option>
                      ))}
                  </Select>
                </div>
              )}
            </div>
          </header>
          <div className="relative min-h-[calc(100dvh-8rem)]">
            <RouteLoadingIndicator />
            <div className={isDashboard ? "" : "mx-auto max-w-7xl p-4 sm:p-7"}>
              {children}
            </div>
          </div>
        </main>
      </div>
      <footer className="pgci-footer no-print">
        <span>
          Programa de Governança, Compliance
          <br />e Integridade - PGCI
        </span>
        <span>v. 16.9.26</span>
      </footer>
    </>
  );
}
