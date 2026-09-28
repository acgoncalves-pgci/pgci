import type { Database, PersonRole } from "./model";

export type ParticipantOption = {
  id: string;
  name: string;
  source: "person";
  roles: PersonRole[];
};

const roleLabels: Record<PersonRole, string> = {
  INTERESSADO: "Interessado",
  CREDOR: "Credor",
  RESPONSAVEL: "Responsável",
};

export const participantOptionLabel = (participant: ParticipantOption) =>
  `${participant.name} · ${participant.roles.length
    ? participant.roles.map((role) => roleLabels[role]).join(", ")
    : "Sem papel definido"}`;

export const participantName = (db: Database, participantId?: string) =>
  db.people.find((person) => person.id === participantId)?.name ??
  db.users.find((user) => user.id === participantId)?.name;

export const participantOptions = (
  db: Database,
  role: PersonRole,
): ParticipantOption[] =>
  db.people
    .filter(
      (person) =>
        person.active &&
        (person.roles.length === 0 || person.roles.includes(role)),
    )
    .map((person) => ({
      id: person.id,
      name: person.name,
      source: "person" as const,
      roles: person.roles,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

export const isActiveParticipant = (
  db: Database,
  participantId: string,
  role: PersonRole,
) =>
  db.people.some(
    (person) =>
      person.id === participantId &&
      person.active &&
      (person.roles.length === 0 || person.roles.includes(role)),
  );
