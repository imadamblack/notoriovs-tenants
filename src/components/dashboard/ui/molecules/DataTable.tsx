import type { ReactNode } from 'react'

export type DataTableColumn<T> = {
  key: string
  header: string
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
}

type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  emptyMessage?: string
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = 'Sin datos',
}: DataTableProps<T>) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="text-left text-neutral-500 -ft-4 uppercase tracking-wide">
          {columns.map((col) => (
            <th key={col.key} className={`py-2 px-3 font-medium ${col.align === 'right' ? 'text-right' : ''}`}>
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
                  className={`py-2.5 px-3 -ft-4 text-neutral-400 ${col.align === 'right' ? 'text-right' : ''}`}
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
