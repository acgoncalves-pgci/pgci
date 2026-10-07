import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const assetRoot = `${import.meta.env.BASE_URL}pdf-assets/`
export const pdfAssetOptions = {
  cMapUrl: `${assetRoot}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${assetRoot}standard_fonts/`,
  wasmUrl: `${assetRoot}wasm/`,
  iccUrl: `${assetRoot}iccs/`,
}

let runtime: Promise<typeof import('pdfjs-dist')> | undefined
export function loadPdfRuntime() {
  return runtime ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjs
  }).catch((error) => { runtime = undefined; throw error })
}
