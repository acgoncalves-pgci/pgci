import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ListPagination, paginateItems } from './ListPagination'

function PaginatedList({ items }: { items: string[] }) {
  const [page, setPage] = useState(1)
  const paginated = paginateItems(items, page)

  return <>
    <ul>{paginated.items.map((item) => <li key={item}>{item}</li>)}</ul>
    <ListPagination page={paginated.page} total={paginated.total} onPage={setPage} label="itens"/>
  </>
}

describe('paginação de listagens', () => {
  it('navega em blocos de 10 e ajusta a página quando a lista diminui', () => {
    const items = Array.from({ length: 21 }, (_, index) => `Item ${index + 1}`)
    const { rerender } = render(<PaginatedList items={items}/>)

    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByText('Item 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Anterior' }).hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(screen.getByText('Item 11')).toBeTruthy()
    expect(screen.queryByText('Item 1')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Item 21')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Próxima' }).hasAttribute('disabled')).toBe(true)

    rerender(<PaginatedList items={items.slice(0, 3)}/>)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Item 1')).toBeTruthy()
    expect(screen.getByText('1 / 1')).toBeTruthy()
  })
})
