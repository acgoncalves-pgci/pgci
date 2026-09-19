import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  Clock3,
  EyeOff,
  FileText,
  Inbox,
  Search,
  TriangleAlert,
  Users,
} from "lucide-react";
import { isActive } from "../../domain/model";
import { dateOnly } from "../../lib/format";
import { api } from "../../services/api";
import { useSession } from "../../app/session";
import { useDb } from "../../app/queries";
import { navigateWithLoading } from "../../app/routeLoading";
import { ErrorBox, Loading } from "../../components/ui/Feedback";
import { Input } from "../../components/ui/Input";
export function Dashboard() {
  const navigate = useNavigate();
  const ctx = useSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", ctx.userId, ctx.activeUnitId],
    queryFn: () => api.dashboard(ctx),
  });
  const { data: db } = useDb();
  const [search, setSearch] = useState("");
  if (isLoading || !db) return <Loading variant="dashboard" />;
  if (error) return <ErrorBox error={error} />;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const unacknowledgedCount = db.protocols.filter(
    (item) =>
      item.currentAssigneeId === ctx.userId &&
      isActive(item) &&
      db.assignments.some(
        (assignment) =>
          assignment.id === item.currentAssignmentId && !assignment.receivedAt,
      ),
  ).length;
  const cards = [
    {
      label: "Na minha caixa",
      count: data!.counts.mine,
      icon: Inbox,
      query: "tab=mine",
    },
    {
      label: "Prazo vencido",
      count: data!.counts.overdue,
      icon: TriangleAlert,
      query: "tab=unit&shortcut=overdue",
      tone: "overdue",
    },
    {
      label: "Vence em 24h",
      count: data!.counts.soon,
      icon: Clock3,
      query: "tab=unit&shortcut=soon",
      tone: "soon",
    },
    {
      label: "Sem ciência",
      count: unacknowledgedCount,
      icon: EyeOff,
      query: "tab=mine&shortcut=unacknowledged",
      tone: "unacknowledged",
    },
  ];
  const shortcuts = [
    {
      label: "Processos",
      tone: "protocols",
      detail: "Acompanhe, movimente e dê andamento aos processos do sistema.",
      to: "/processos",
      icon: ClipboardList,
    },
    {
      label: "Documentos",
      tone: "documents",
      detail:
        "Controle ofícios e arquivos diretamente vinculados aos processos.",
      to: "/documentos",
      icon: FileText,
    },
    {
      label: "Pessoas",
      tone: "people",
      detail: "Administre credores, requerentes e partes interessadas.",
      to: "/pessoas",
      icon: Users,
    },
    {
      label: "Usuários",
      tone: "users",
      detail: "Defina acessos, perfis e permissões da equipe municipal.",
      to: "/usuarios",
      icon: Users,
    },
  ];
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigateWithLoading(
      navigate,
      `/processos?search=${encodeURIComponent(search)}`,
    );
  };
  return (
    <div className="overview-page pgci-dashboard relative mx-auto max-w-7xl px-4 lg:px-0 overflow-hidden pb-14 pt-14 sm:pt-28">
      <div aria-hidden="true" className="pgci-dashboard-shapes">
        <span className="pgci-dashboard-shape pgci-dashboard-shape-left" />
        <span className="pgci-dashboard-shape pgci-dashboard-shape-right-primary" />
        <span className="pgci-dashboard-shape pgci-dashboard-shape-right-secondary" />
      </div>
      <section className="relative mx-auto max-w-3xl text-center">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-black dark:text-white sm:text-[2.5rem]">
          {greeting},{" "}
          <span className="dashboard-greeting-name">
            {ctx.user?.name.split(" ")[0] ?? "usuário"}!
          </span>
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          {db.organization.name} · {today}
        </p>
        <form
          className="relative mx-auto mt-8 max-w-xl"
          onSubmit={submitSearch}
        >
          <label className="sr-only" htmlFor="overview-search">
            Buscar processo
          </label>
          <Input
            id="overview-search"
            className="overview-search !mt-0 pr-14"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar processo pelo número ou assunto"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-black transition-colors hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
            aria-label="Buscar processo"
          >
            <Search size={25} />
          </button>
        </form>
      </section>
      <section className="relative mt-24">
        <header className="mb-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-black dark:text-white">
            <ClipboardList size={20} />
            Meus Processos
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Processos sob sua responsabilidade e seus prazos.
          </p>
        </header>
        <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() =>
                navigateWithLoading(navigate, `/processos?${card.query}`)
              }
              className="overview-metric text-left"
            >
              <span
                className={`overview-metric-icon ${card.tone ? `overview-metric-icon--${card.tone}` : ""}`}
              >
                <card.icon size={22} />
              </span>
              <strong className="min-w-[2.3rem] text-3xl font-bold tabular-nums text-black dark:text-white">
                {String(card.count).padStart(2, "0")}
              </strong>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {card.label}
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="relative mt-5 rounded-2xl bg-[#f1f1f1] p-2 dark:bg-slate-900">
        {data!.priorities.length ? (
          <div className="space-y-3">
            {data!.priorities.slice(0, 3).map((protocol) => (
              <button
                key={protocol.id}
                type="button"
                onClick={() =>
                  navigateWithLoading(navigate, `/processos/${protocol.id}`)
                }
                className="overview-protocol-row"
              >
                <span className="grid min-w-24 place-items-center rounded-xl bg-white px-3 py-2 text-xl font-bold text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  {protocol.number}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <small className="block font-mono text-[10px] text-slate-600 dark:text-slate-400">
                    {protocol.number}
                  </small>
                  <strong className="mt-0.5 block truncate text-sm text-slate-900 dark:text-slate-100">
                    {protocol.subject}
                  </strong>
                </span>
                <span className="hidden min-w-48 text-left lg:block">
                  <small className="block text-[10px] text-slate-500">
                    Origem
                  </small>
                  <strong className="block truncate text-sm text-slate-800 dark:text-slate-100">
                    {db.units.find((unit) => unit.id === protocol.currentUnitId)
                      ?.name ?? "Unidade não informada"}
                  </strong>
                </span>
                <strong className="hidden text-sm text-slate-800 dark:text-slate-100 sm:block">
                  {protocol.dueAt ? dateOnly(protocol.dueAt) : "Sem prazo"}
                </strong>
              </button>
            ))}
          </div>
        ) : (
          <div className="overview-protocol-row cursor-default">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Nenhum processo pendente no momento.
            </span>
          </div>
        )}
      </section>
      <section className="relative mt-8">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-black dark:text-white">
          <ArrowRight size={22} />
          Acesso rápido
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {shortcuts.map(({ label, detail, to, tone, icon: Icon }) => (
            <Link
              key={label}
              to={to}
              className={`overview-quick-link overview-quick-link--${tone}`}
            >
              <Icon className="shrink-0" size={42} />
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
