import type { ReactNode } from 'react'

export type DataTableColumn<T> = {
  key: string
  header: ReactNode
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
}

type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  emptyMessage?: string
  stickyHeader?: boolean
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = 'Sin datos',
  stickyHeader = false,
}: DataTableProps<T>) {
  const stickyClass = stickyHeader
    ? 'sticky top-0 z-[1] bg-neutral-800 shadow-[inset_0_-1px_0_theme(colors.gray.500)]'
    : ''

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="text-left text-neutral-400 -ft-4 uppercase tracking-wide border-b border-gray-500">
          {columns.map((col) => (
            <th key={col.key} className={`py-2 px-3 font-medium ${stickyClass} ${col.align === 'right' ? 'text-right' : ''}`}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="py-8 text-center -ft-3 text-neutral-600">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-t border-neutral-800 ${onRowClick ? 'cursor-pointer hover:bg-neutral-900/60' : ''}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-2.5 px-3 -ft-4 text-neutral-200 ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
