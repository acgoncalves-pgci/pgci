import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  LogOut,
  Mail,
  Settings,
  User,
  UserCog,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import type { Role } from "../../domain/model";
import { invalidateAll, useDb } from "../queries";
import { navigateWithLoading } from "../routeLoading";
import { useSession } from "../session";
import { unitPath } from '../../domain/units';

type ProfilePanel = "menu" | "profile" | "switch-user";

const roleLabel: Record<Role, string> = {
  ADMIN: "Administrador geral",
  GESTOR: "Gestor",
  OPERADOR: "Operador",
  LEITOR: "Leitor",
};

const getInitials = (name?: string) =>
  name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() ?? "US";

export function ProfileMenu() {
  const {
    user,
    users,
    setUserId,
    activeUnitId,
  } = useSession();
  const { data: sessionDb } = useDb();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<ProfilePanel>("menu");

  const close = useCallback(() => {
    setOpen(false);
    setPanel("menu");
  }, []);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [close, open]);

  useEffect(() => {
    close();
  }, [close, location.pathname]);

  const structureLabel = (unitId?: string) =>
    sessionDb && unitId ? unitPath(sessionDb.units, unitId) : "Estrutura não definida";

  const currentStructure = structureLabel(activeUnitId);
  const currentMembership = sessionDb?.memberships.find(
    (membership) =>
      membership.userId === user?.id &&
      membership.unitId === activeUnitId &&
      membership.active,
  );
  const currentRole =
    currentMembership?.title ??
    (user ? roleLabel[user.role] : "Perfil não definido");
  const initials = getInitials(user?.name);

  const switchUser = async (userId: string) => {
    const selected = users.find((item) => item.id === userId);
    setUserId(userId);
    await invalidateAll(queryClient);
    close();
    window.dispatchEvent(
      new CustomEvent("fluxo-publico:toast", {
        detail: {
          message:
            "Usuário alterado para " +
            (selected?.name ?? "o perfil selecionado") +
            ".",
        },
      }),
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex min-h-12 max-w-[250px] items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]"
        aria-label="Abrir menu do perfil"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          if (open) setPanel("menu");
        }}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-[var(--ui-accent)] bg-white text-xs font-extrabold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-100">
          {initials}
        </span>
        <span className="hidden min-w-0 flex-1 sm:block">
          <span className="block truncate text-xs font-bold">
            {user?.name ?? "Usuário"}
          </span>
          <span className="mt-0.5 block truncate text-[10px] opacity-75">
            {currentStructure}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={
            "hidden shrink-0 transition-transform sm:block " +
            (open ? "rotate-180" : "")
          }
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Menu do perfil"
          className="absolute right-0 top-[calc(100%+.5rem)] z-[90] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-[var(--ui-accent)] bg-slate-50 text-xs font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-100">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {user?.name ?? "Usuário"}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                <Mail size={12} className="shrink-0" aria-hidden="true" />
                {user?.email ?? "E-mail não informado"}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <Building2 size={12} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{currentStructure}</span>
              </p>
            </div>
          </div>

          {panel === "menu" && (
            <div className="p-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setPanel("profile")}
              >
                <User size={17} aria-hidden="true" /> Meu perfil
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  close();
                  if (location.pathname !== "/configuracoes") {
                    navigateWithLoading(navigate, "/configuracoes");
                  }
                }}
              >
                <Settings size={17} aria-hidden="true" /> Configurações
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setPanel("switch-user")}
              >
                <UserCog size={17} aria-hidden="true" /> Trocar usuário
              </button>
              <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600 hover:!bg-red-50 dark:text-red-400 dark:hover:!bg-red-950/40"
                onClick={() => {
                  close();
                  window.dispatchEvent(
                    new CustomEvent("fluxo-publico:toast", {
                      detail: {
                        message:
                          "A saída será habilitada com a autenticação definitiva.",
                      },
                    }),
                  );
                }}
              >
                <LogOut size={17} aria-hidden="true" /> Sair
              </button>
            </div>
          )}

          {panel === "profile" && (
            <div className="p-3">
              <BackButton onClick={() => setPanel("menu")} />
              <h2 className="px-2 text-sm font-bold">Meu perfil</h2>
              <dl className="mt-3 grid gap-2 px-2 pb-2 text-sm">
                <ProfileField label="Nome" value={user?.name ?? "Não informado"} />
                <ProfileField label="E-mail" value={user?.email ?? "Não informado"} />
                <ProfileField label="Estrutura" value={currentStructure} />
                <ProfileField label="Vínculo" value={currentRole} />
              </dl>
            </div>
          )}

          {panel === "switch-user" && (
            <div className="p-3">
              <BackButton onClick={() => setPanel("menu")} />
              <div className="px-2">
                <h2 className="text-sm font-bold">Trocar usuário</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Selecione o usuário e confira sua estrutura.
                </p>
              </div>
              <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
                {users.map((item) => {
                  const selected = item.id === user?.id;
                  const itemStructure = structureLabel(item.unitId);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={
                        "Trocar para " +
                        item.name +
                        " — " +
                        itemStructure
                      }
                      aria-current={selected ? "true" : undefined}
                      className={
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors " +
                        (selected
                          ? "border-[var(--ui-accent)] bg-slate-50 dark:bg-slate-800"
                          : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800")
                      }
                      onClick={() =>
                        selected ? close() : void switchUser(item.id)
                      }
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-extrabold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                        {getInitials(item.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {item.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                          {itemStructure}
                        </span>
                      </span>
                      {selected && (
                        <Check
                          size={17}
                          className="shrink-0 text-[var(--ui-accent)]"
                          aria-label="Usuário atual"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="mb-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      onClick={onClick}
    >
      <ArrowLeft size={15} aria-hidden="true" /> Voltar
    </button>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}


