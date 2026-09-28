import type { ParticipantOption } from "../../domain/participants";
import type { PersonRole } from "../../domain/model";

const roleLabels: Record<PersonRole, string> = {
  INTERESSADO: "Interessado",
  CREDOR: "Credor",
  RESPONSAVEL: "Responsável",
};

export function ParticipantOptionContent({
  participant,
}: {
  participant: ParticipantOption;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span>{participant.name} ·</span>
      {participant.roles.length ? (
        participant.roles.map((role) => (
          <span
            key={role}
            className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium leading-4 text-foreground"
          >
            {roleLabels[role]}
          </span>
        ))
      ) : (
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium leading-4 text-muted-foreground">
          Sem papel definido
        </span>
      )}
    </span>
  );
}
