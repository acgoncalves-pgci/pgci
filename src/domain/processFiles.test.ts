import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../services/api'
import { loadDb, saveDb } from '../storage/database'
import { seedDatabase } from '../mocks/seed'
import { normalizeProcessFileType, processFileAccept, validateProcessFiles } from './processFiles'

// Blob persistence is exercised in the browser tests; jsdom has no IndexedDB.
vi.mock('../storage/database', async (importOriginal) => ({
  ...await importOriginal<typeof import('../storage/database')>(),
  putBlob: vi.fn(async () => undefined),
  cleanupOrphanedBlobs: vi.fn(async () => undefined),
}))

const admin = { userId: 'usr-admin', activeUnitId: 'u-prot' }
const actor = { userId: 'usr-clara', activeUnitId: 'u-prot' }
const input = { name: 'Comprovante de residência', extensions: ['pdf', 'docx'], retentionYears: null, observation: 'Documento atualizado.', color: '#3498DB', icon: 'Paperclip' }

describe('tipos de arquivo permitidos no processo', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()) })
  it('cadastra, edita e exclui definições sem gravar uploads nem remover anexos', async () => {
    const before = loadDb()
    const typeId = before.protocols[0].typeId
    const created = await api.saveProcessFileType(admin, typeId, input)
    expect(loadDb().protocolTypes.find((type) => type.id === typeId)?.fileTypes).toEqual([created])
    expect(loadDb().attachments).toEqual(before.attachments)
    const updated = await api.saveProcessFileType(admin, typeId, { ...input, extensions: ['zip'], retentionYears: 2 }, created.id)
    expect(updated).toMatchObject({ id: created.id, extensions: ['zip'], retentionYears: 2 })
    await api.deleteProcessFileType(admin, typeId, created.id)
    expect(loadDb().protocolTypes.find((type) => type.id === typeId)?.fileTypes).toEqual([])
    expect(loadDb().attachments).toEqual(before.attachments)
  })
  it('valida nome, extensões e retenção, recusa duplicados e respeita permissões', async () => {
    const typeId = loadDb().protocols[0].typeId
    await expect(api.saveProcessFileType(actor, typeId, input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(api.saveProcessFileType(admin, typeId, { ...input, extensions: [] })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.saveProcessFileType(admin, typeId, { ...input, extensions: ['exe'] })).rejects.toMatchObject({ code: 'VALIDATION' })
    await api.saveProcessFileType(admin, typeId, input)
    await expect(api.saveProcessFileType(admin, typeId, { ...input, name: input.name.toUpperCase() })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(() => normalizeProcessFileType({ ...input, retentionYears: 5 as 1 })).toThrow()
  })
  it('aceita DOCX configurado, bloqueia extensão não configurada e mantém o limite de tamanho', async () => {
    const protocol = loadDb().protocols.find((item) => item.id === 'pr-1')!
    await api.saveProcessFileType(admin, protocol.typeId, { ...input, extensions: ['docx', 'zip'] })
    const definition = loadDb().protocolTypes.find((type) => type.id === protocol.typeId)!
    expect(processFileAccept(definition)).toBe('.docx,.zip')
    const docx = new File(['conteúdo de teste'], 'COMPROVANTE.DOCX')
    const [attached] = await api.addAttachments(actor, protocol.id, protocol.version, [docx])
    expect(attached.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    await expect(api.addAttachments(actor, protocol.id, protocol.version + 1, [new File(['x'], 'imagem.png', { type: 'image/png' })])).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(() => validateProcessFiles(definition, [{ name: 'grande.docx', size: 6 * 1024 * 1024 }])).toThrow('5 MB')
  })
  it('aplica as mesmas regras aos anexos enviados na abertura', async () => {
    const type = loadDb().protocolTypes.find((item) => item.id === 'pt-admin')!
    await api.saveProcessFileType(admin, type.id, { ...input, extensions: ['zip'] })
    const create = { typeId: type.id, subject: 'Processo com anexos definidos', description: 'Validação das extensões na abertura.', interestedPersonId: 'p-1' }
    await expect(api.createProtocol(actor, { ...create, files: [new File(['x'], 'arquivo.pdf', { type: 'application/pdf' })] })).rejects.toMatchObject({ code: 'VALIDATION' })
    const protocol = await api.createProtocol(actor, { ...create, files: [new File(['x'], 'arquivo.zip', { type: 'application/zip' })] })
    expect(loadDb().attachments.find((item) => item.protocolId === protocol.id)?.filename).toBe('arquivo.zip')
  })
  it('preserva os formatos anteriores quando não existem definições e combina múltiplos tipos', () => {
    expect(processFileAccept({})).toBe('.pdf,.png,.jpg,.jpeg,.txt')
    expect(processFileAccept({ fileTypes: [{ ...input, id: 'a' }, { ...input, id: 'b', extensions: ['pdf', 'xls'] }] })).toBe('.pdf,.docx,.xls')
    expect(() => validateProcessFiles({}, [new File(['x'], 'arquivo.exe')])).toThrow()
  })
})
