import JsBarcode from 'jsbarcode'

export function consultationBarcode(url: string) {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, url, { format: 'CODE128', displayValue: false, height: 48, width: 2, margin: 12 })
  return canvas.toDataURL('image/png')
}
