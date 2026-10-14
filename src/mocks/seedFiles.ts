import { jsPDF } from 'jspdf'
import type { Attachment, Database } from '../domain/model'

// Reserved keys allow the demo to recreate its files after a reload without
// replacing files uploaded by the user. Bytes and metadata use the same builder.
export function seedAttachmentBlob(attachment: Attachment, db: Database): Blob | undefined {
  if (attachment.blobKey === 'seed-comprovante') {
    return new Blob(['Comprovante fictício disponível para visualização.'], { type: 'text/plain' })
  }
  if (attachment.blobKey !== `seed-v2:${attachment.id}`) return undefined
  const protocol = db.protocols.find((item) => item.id === attachment.protocolId)
  const movement = db.events.find((item) => item.id === attachment.movementEventId)
  const phase = db.phases.find((item) => item.id === movement?.phaseId)
  const author = db.users.find((item) => item.id === attachment.uploadedById)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.setCreationDate(new Date(attachment.createdAt))
  pdf.setFileId('00000000000000000000000000000002')
  pdf.setProperties({ title: attachment.filename, author: author?.name ?? 'PGCI', subject: 'Demonstração — dados fictícios' })
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text(db.organization.name, 105, 24, { align: 'center' })
  pdf.setFontSize(12)
  pdf.text('DOCUMENTO DE DEMONSTRAÇÃO', 105, 35, { align: 'center' })
  pdf.setFillColor(240, 242, 245)
  pdf.rect(20, 47, 170, 11, 'F')
  pdf.setFontSize(10)
  pdf.text(`PROCESSO Nº ${protocol?.number ?? 'AVULSO'}`, 105, 54, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  const lines = [
    `ASSUNTO: ${protocol?.subject.toLocaleUpperCase('pt-BR') ?? attachment.filename.toLocaleUpperCase('pt-BR')}`,
    `FASE: ${phase?.name.toLocaleUpperCase('pt-BR') ?? 'DOCUMENTAÇÃO INICIAL'}`,
    `RESPONSÁVEL: ${author?.name.toLocaleUpperCase('pt-BR') ?? 'NÃO DESIGNADO'}`,
    '',
    attachment.description ?? 'Comprovante utilizado para demonstração do processo eletrônico.',
    '',
    'Este arquivo contém somente dados fictícios para apresentação do sistema. Não possui validade administrativa, fiscal ou jurídica.',
  ]
  let y = 68
  for (const line of lines) {
    const wrapped: string[] = pdf.splitTextToSize(line, 164)
    pdf.text(wrapped, 23, y)
    y += Math.max(wrapped.length, 1) * 6 + 4
  }
  pdf.setFontSize(9)
  pdf.text('SEM ASSINATURA — utilize Assinar para testar a simulação.', 105, 275, { align: 'center' })
  return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
}
