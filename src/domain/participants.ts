import type { Database, PersonRole } from "./model";

export type ParticipantOption = {
  id: string;
  name: string;
  source: "person" | "user";
};

export const participantName = (db: Database, participantId?: string) =>
  db.people.find((person) => person.id === participantId)?.name ??
  db.users.find((user) => user.id === participantId)?.name;

export const participantOptions = (
  db: Database,
  role: Extract<PersonRole, "INTERESSADO" | "CREDOR">,
): ParticipantOption[] =>
  [
    ...db.people
      .filter((person) => person.active && person.roles.includes(role))
      .map((person) => ({
        id: person.id,
        name: person.name,
        source: "person" as const,
      })),
    ...db.users
      .filter((user) => user.active)
      .map((user) => ({
        id: user.id,
        name: user.name,
        source: "user" as const,
      })),
  ].sort(
    (left, right) =>
      left.name.localeCompare(right.name, "pt-BR") ||
      left.source.localeCompare(right.source),
  );

export const isActiveParticipant = (
  db: Database,
  participantId: string,
  role: Extract<PersonRole, "INTERESSADO" | "CREDOR">,
) =>
  db.people.some(
    (person) =>
      person.id === participantId &&
      person.active &&
      person.roles.includes(role),
  ) || db.users.some((user) => user.id === participantId && user.active);
