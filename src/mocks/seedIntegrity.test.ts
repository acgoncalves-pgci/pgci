import { beforeEach, describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { seedDatabase } from './seed'
import { seedAttachmentBlob } from './seedFiles'
import { effectivePermissions, hasPermission } from '../domain/permissions'
import { allowedProcessExtensions } from '../domain/processFiles'
import { recommendedFlowPhase } from '../domain/flows'
import { validateTemplateContent } from '../lib/documentTemplate'
import { auditActionLabel } from '../lib/audit'

beforeEach(() => localStorage.clear())

describe('integridade dos novos cenários da demonstração', () => {
  it('mantém hierarquia sem ciclos, perfis válidos e permissões independentes por unidade', () => {
    const db = seedDatabase()
    for (const unit of db.units) {
      const ancestors = new Set([unit.id])
      let parentId = unit.parentId
      while (parentId) {
        expect(ancestors.has(parentId)).toBe(false)
        ancestors.add(parentId)
        const parent = db.units.find((item) => item.id === parentId)!
        expect(parent).toBeDefined()
        parentId = parent.parentId
      }
      expect(unit.color).toMatch(/^#[\da-f]{6}$/i)
      expect(unit.icon).toBeTruthy()
    }
    for (const membership of db.memberships) {
      expect(db.users.some((user) => user.id === membership.userId)).toBe(true)
      expect(db.units.some((unit) => unit.id === membership.unitId)).toBe(true)
      expect(db.profiles.some((profile) => profile.id === membership.profileId)).toBe(true)
      expect(membership.permissions).toBeDefined()
    }
    expect(db.memberships.some((item) => item.role === 'ADMIN' && item.active && db.users.some((user) => user.id === item.userId && user.active))).toBe(true)
    const reception = { userId: 'usr-helena', activeUnitId: 'u-prot' }
    const education = { ...reception, activeUnitId: 'u-edu' }
    expect(hasPermission(db, reception, 'processes.create')).toBe(true)
    expect(hasPermission(db, education, 'processes.create')).toBe(false)
    expect(hasPermission(db, reception, 'audit.view')).toBe(false)
    expect(hasPermission(db, education, 'audit.view')).toBe(true)
    const reader = db.memberships.find((item) => item.userId === 'usr-beatriz')!
    expect(effectivePermissions(reader)).not.toContain('processes.act')
    expect(effectivePermissions(reader)).not.toContain('documents.edit')
  })

  it('demonstra orientação com desvio livre, conclusão antecipada e correspondência sem roteiro', () => {
    const db = seedDatabase()
    const outside = db.protocols.find((item) => item.id === 'pr-21')!
    expect(outside.flowModeSnapshot).toBe('SUGGESTED')
    expect(outside.flowSnapshot!.phases.some((stage) => stage.phaseId === outside.currentPhaseId)).toBe(false)
    expect(recommendedFlowPhase(db, outside)?.phaseId).toBe('phase-sector-response')
    const early = db.protocols.find((item) => item.id === 'pr-22')!
    expect(early).toMatchObject({ status: 'CONCLUIDO', flowModeSnapshot: 'SUGGESTED', currentPhaseId: 'phase-citizen-screening' })
    expect(db.protocols.find((item) => item.id === 'pr-23')).toMatchObject({ flowModeSnapshot: 'NONE', flowSnapshot: undefined })
    expect(db.protocols.find((item) => item.id === 'pr-24')).toMatchObject({ status: 'CONCLUIDO', flowModeSnapshot: 'REQUIRED', currentPhaseId: 'phase-completion' })
  })

  it('preenche campos obrigatórios, usa códigos da categoria e fornece evidências reais nos checklists', () => {
    const db = seedDatabase({ variation: 202 })
    expect(new Set(db.protocolTypes.map((type) => type.code)).size).toBe(db.protocolTypes.length)
    for (const type of db.protocolTypes) {
      const category = db.processCategories.find((item) => item.id === type.categoryId)!
      expect(type.code).toMatch(new RegExp(`^${category.code}\\.\\d{3}$`))
      expect(type.fileTypes?.length).toBeGreaterThan(0)
    }
    for (const protocol of db.protocols) {
      if (protocol.typeConfigSnapshot.responsavel?.required) expect(db.people.find((person) => person.id === protocol.responsiblePersonId)?.roles).toContain('RESPONSAVEL')
      if (protocol.typeConfigSnapshot.arquivos?.required) {
        const opening = db.events.find((event) => event.protocolId === protocol.id && event.kind === 'ABERTURA')!
        expect(db.attachments.some((attachment) => attachment.movementEventId === opening.id)).toBe(true)
      }
    }
    for (const event of db.events.filter((item) => item.checklist?.some((answer) => answer.attachmentProvided))) expect(db.attachments.some((attachment) => attachment.movementEventId === event.id)).toBe(true)
    for (const attachment of db.attachments) {
      const type = db.protocolTypes.find((item) => item.id === db.protocols.find((protocol) => protocol.id === attachment.protocolId)!.typeId)!
      expect(allowedProcessExtensions(type)).toContain(attachment.filename.split('.').at(-1))
      expect(db.events.find((event) => event.id === attachment.movementEventId)?.protocolId).toBe(attachment.protocolId)
    }
  })

  it('mantém datas ordenadas, destinos obrigatórios e autores com vínculo na unidade', () => {
    const db = seedDatabase()
    for (const event of db.events) {
      const protocol = db.protocols.find((item) => item.id === event.protocolId)!
      expect(event.createdAt >= protocol.createdAt, event.id).toBe(true)
      expect(Date.parse(event.createdAt), event.id).toBeLessThanOrEqual(Date.now())
      expect(db.memberships.some((item) => item.userId === event.actorUserId && item.unitId === event.actorUnitId && item.active), event.id).toBe(true)
      if (protocol.completedAt && event.kind !== 'ARQUIVAMENTO') expect(event.createdAt <= protocol.completedAt, event.id).toBe(true)
      const stage = protocol.flowSnapshot?.phases.find((item) => item.phaseId === event.phaseId)
      if (protocol.flowModeSnapshot === 'REQUIRED' && event.kind === 'TRAMITACAO' && stage?.destinationUnitId) expect(event.toUnitId).toBe(stage.destinationUnitId)
    }
    for (const assignment of db.assignments) {
      if (assignment.endedAt) expect(assignment.endedAt >= assignment.startedAt).toBe(true)
      if (assignment.receivedAt) expect(assignment.receivedAt >= assignment.startedAt).toBe(true)
    }
    for (const document of db.documents) expect(db.memberships.some((item) => item.userId === document.authorUserId && item.unitId === document.unitId && item.active)).toBe(true)
    for (const template of db.documentTemplates) expect(validateTemplateContent(template.subject, template.body)).toBeUndefined()
    for (const audit of db.auditEvents) expect(auditActionLabel(audit.action)).not.toBe('Ação registrada')
    expect(db.auditEvents.some((item) => item.action === 'USER_MEMBERSHIP_CREATED')).toBe(true)
  })

  it('gera bytes de PDFs válidos com tamanho correto para cada prefeitura', async () => {
    const db = seedDatabase({ organization: { id: 'tenant-test', name: 'Prefeitura Municipal de Demonstração', abbreviation: 'PMD' } })
    for (const attachment of db.attachments) {
      const blob = seedAttachmentBlob(attachment, db)!
      expect(blob.size).toBe(attachment.sizeBytes)
      expect(blob.type).toBe(attachment.mimeType)
      if (blob.type !== 'application/pdf') continue
      const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = reject
        reader.readAsArrayBuffer(blob)
      })
      const pdf = await PDFDocument.load(bytes)
      expect(pdf.getPageCount()).toBe(1)
      expect(pdf.getTitle()).toBe(attachment.filename)
    }
  })
})
