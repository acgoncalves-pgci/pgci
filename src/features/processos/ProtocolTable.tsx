import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, Paperclip, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import type { Database, Protocol, ProtocolStatus } from "../../domain/model";
import { eventLabel, statusLabel } from "../../domain/model";
import { currentProtocolSituation } from "../../domain/situations";
import { IconGlyph } from "../../components/ui/IconSelect";
import { OverflowMarquee } from "../../components/ui/OverflowMarquee";
import { Tooltip } from "../../components/ui/Tooltip";
import { dateTime } from "../../lib/format";

export const Name = ({ db, userId }: { db: Database; userId?: string }) => (
  <>{db.users.find((user) => user.id === userId)?.name ?? "—"}</>
);
export const UnitName = ({ db, unitId }: { db: Database; unitId?: string }) => (
  <>{db.units.find((unit) => unit.id === unitId)?.abbreviation ?? "—"}</>
);

export function StatusBadge({ status, situation }: { status: ProtocolStatus; situation?: ReturnType<typeof currentProtocolSituation> }) {
  const fallbackStyles: Record<ProtocolStatus, string> = {
    CADASTRADO: "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
    EM_ANDAMENTO: "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    CONCLUIDO: "border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    ARQUIVADO: "border-slate-300 bg-slate-200 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100",
  };
  const label = situation?.name ?? statusLabel[status];
  return <Tooltip
    content={label}
    className={"process-status-badge inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " + (situation ? "" : fallbackStyles[status])}
    style={situation ? { backgroundColor: situation.color + "18", borderColor: situation.color + "55", color: situation.color } : undefined}
  >
    {situation && <IconGlyph name={situation.icon} size={11}/>}
    <OverflowMarquee text={label}/>
  </Tooltip>;
}
function ProcessCard({ db, process }: { db: Database; process: Protocol }) {
  const [printOpen, setPrintOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!printOpen) return;
    const close = (event: MouseEvent) => {
      if (!printRef.current?.contains(event.target as Node))
        setPrintOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPrintOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [printOpen]);
  const type = db.protocolTypes.find((item) => item.id === process.typeId);
  const situation = currentProtocolSituation(db, process);
  const events = db.events
    .filter((event) => event.protocolId === process.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = events[0];

  const unit = db.units.find((item) => item.id === process.currentUnitId);
  const attachmentCount = db.attachments.filter(
    (attachment) => attachment.protocolId === process.id,
  ).length;
  const print = async (action: "cover" | "receipt" | "label" | "details") => {
    setPrintOpen(false);
    setPrintError("");
    setPrinting(true);
    try {
      const pdf = await import("../relatorios/reportPdf");
      if (action === "cover") await pdf.downloadCover(db, process);
      if (action === "receipt")
        await pdf.downloadProtocolReceipt(db, process);
      if (action === "label") await pdf.downloadProcessLabel(db, process);
      if (action === "details") await pdf.downloadProcessDetails(db, process);
    } catch (error) {
      setPrintError(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o PDF.",
      );
    } finally {
      setPrinting(false);
    }
  };
  const actions = [
    ["cover", "Imprimir capa"],
    ["receipt", "Imprimir comprovante"],
    ["label", "Imprimir etiqueta"],
    ["details", "Imprimir detalhamento"],
  ] as const;
  return (
    <article className="process-card" data-status={process.status} data-situation={situation?.id}>
      <Link
        className="process-card-content"
        to={`/processos/${process.id}`}
        aria-label={`Abrir processo ${process.number}: ${process.subject}`}
      >
        <div className="process-card-reference">
          <strong className="process-card-number">{process.number}</strong>
          <div className="process-card-state">
            <StatusBadge status={process.status} situation={situation} />
            <span title={`${attachmentCount} anexo(s)`}>
              <Paperclip size={11} />
              {String(attachmentCount).padStart(2, "0")}
            </span>
          </div>
        </div>
        <div className="process-card-summary">
          <span
            className="process-type-marker"
            style={{ backgroundColor: type?.color ?? "var(--ui-accent)" }}
          />
          <div className="min-w-0">
            <p className="process-card-type">{type?.name ?? "Processo"}</p>
            <h2>{process.subject}</h2>
            <Tooltip content={process.description} className="process-card-description">{process.description}</Tooltip>
          </div>
        </div>
        <dl className="process-card-movement">
          <div>
            <dt>Última movimentação em:</dt>
            <dd>{dateTime(latest?.createdAt ?? process.updatedAt)}</dd>
          </div>
          <div>
            <dt>Está em:</dt>
            <dd>{unit?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Assunto do andamento:</dt>
            <dd>
              {latest?.message ||
                (latest ? eventLabel[latest.kind] : "Processo cadastrado")}
            </dd>
          </div>
        </dl>
      </Link>
      <div className="process-card-actions">
        <div className="relative" ref={printRef}>
          <button
            type="button"
            className="process-card-action-button"
            aria-label={`Imprimir processo ${process.number}`}
            aria-haspopup="menu"
            aria-expanded={printOpen}
            disabled={printing}
            onClick={() => setPrintOpen((value) => !value)}
          >
            <Printer size={16} />
          </button>
          {printOpen && (
            <div className="process-print-menu" role="menu">
              <p>Impressão</p>
              {actions.map(([action, label]) => (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  onClick={() => void print(action)}
                >
                  <Printer size={15} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Link
          className="process-card-action-button"
          aria-label={`Visualizar processo ${process.number}`}
          to={`/processos/${process.id}`}
        >
          <Eye size={16} />
        </Link>
        {printError && (
          <span role="alert" className="process-print-error">
            {printError}
          </span>
        )}
      </div>
      <ArrowRight className="process-card-arrow" aria-hidden="true" size={16} />
    </article>
  );
}

export function ProtocolTable({
  db,
  protocols,
}: {
  db: Database;
  protocols: Protocol[];
}) {
  return (
    <div className="process-card-list">
      {protocols.map((process) => (
        <ProcessCard key={process.id} db={db} process={process} />
      ))}
    </div>
  );
}
