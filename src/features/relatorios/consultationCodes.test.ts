import { afterEach, expect, it, vi } from 'vitest'
import JsBarcode from 'jsbarcode'
import { consultationBarcode } from './consultationCodes'

vi.mock('jsbarcode', () => ({ default: vi.fn() }))
afterEach(() => vi.restoreAllMocks())

it('codifica o link da consulta no CODE128, com margem para a leitura', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,barcode')
  const url = 'https://sistema.gov.br/saomateusdomaranhao/consulta?numero=2026.10.13.0001'
  expect(consultationBarcode(url)).toBe('data:image/png;base64,barcode')
  expect(JsBarcode).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), url, expect.objectContaining({ format: 'CODE128', margin: 12, displayValue: false }))
})
