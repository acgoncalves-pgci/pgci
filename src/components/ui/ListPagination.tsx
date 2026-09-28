export const LIST_PAGE_SIZE = 10

export function paginateItems<T>(items: T[], page: number, pageSize = LIST_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  return {
    items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    page: currentPage,
    total: items.length,
    pageSize,
  }
}

export function ListPagination({ page, total, pageSize = LIST_PAGE_SIZE, onPage, label }: {
  page: number
  total: number
  pageSize?: number
  onPage: (page: number) => void
  label: string
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return <nav aria-label={`Paginação de ${label}`} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3 text-sm">
    <span className="text-muted-foreground">{total} registro{total === 1 ? '' : 's'}</span>
    <div className="flex items-center gap-2">
      <button type="button" className="btn-secondary !py-1" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
      <span aria-live="polite">{page} / {pageCount}</span>
      <button type="button" className="btn-secondary !py-1" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Próxima</button>
    </div>
  </nav>
}
