import { isMovementEvent, type ChecklistQuestion, type Database, type Protocol, type ProtocolEvent } from "./model";

const attachmentTypeLabel: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "text/plain": "TXT",
};

export function phaseChecklistMovement(
  db: Database,
  protocol: Protocol,
  latestMovement: ProtocolEvent,
): ProtocolEvent {
  const movements = db.events.filter((event) =>
    event.protocolId === protocol.id && isMovementEvent(event)
  );
  for (const movement of movements.reverse()) {
    if (movement.phaseId && movement.phaseId !== protocol.currentPhaseId) break;
    if (movement.checklist?.length) return movement;
  }
  return latestMovement;
}

export function forwardPendingIssues(
  db: Database,
  protocol: Protocol,
  movement: ProtocolEvent,
): string[] {
  // A fase escolhida em fluxo livre só identifica a movimentação. Suas regras
  // de checklist e anexos valem apenas quando um fluxo foi aplicado ao processo.
  const phase = protocol.flowSnapshot?.phases.find(
    (item) => item.phaseId === protocol.currentPhaseId,
  );
  if (!phase) return [];

  const questions: ChecklistQuestion[] = phase.checklistQuestions?.length
    ? phase.checklistQuestions
    : phase.checklistItems.map((text, index) => ({
        id: `legacy-${index}`,
        text,
        order: index + 1,
        required: true,
        requiresAttachment: false,
        requiresDate: false,
        requiresObservation: false,
      }));
  const answers = phaseChecklistMovement(db, protocol, movement).checklist ?? [];
  const issues: string[] = [];

  for (const question of questions) {
    const answer = answers.find((item) => item.questionId === question.id);
    if (question.required && !answer?.checked) {
      issues.push(`Conclua o item do checklist: ${question.text}.`);
      continue;
    }
    if (!answer?.checked) continue;
    if (question.requiresDate && !answer.date)
      issues.push(`Informe a data do item: ${question.text}.`);
    if (question.requiresObservation && !answer.observation?.trim())
      issues.push(`Informe a observação do item: ${question.text}.`);
  }

  const attachments = db.attachments.filter((item) => item.protocolId === protocol.id);
  if ((('requiresAttachment' in phase && phase.requiresAttachment) || questions.some((question) =>
    question.requiresAttachment && answers.some((answer) => answer.questionId === question.id && answer.checked)
  )) && attachments.length === 0)
    issues.push("Anexe o arquivo exigido pela fase atual.");

  for (const mimeType of phase.requiredAttachmentTypes ?? []) {
    if (!attachments.some((item) => item.mimeType === mimeType))
      issues.push(`Anexe um arquivo ${attachmentTypeLabel[mimeType] ?? mimeType} exigido pela fase atual.`);
  }

  return issues;
}
