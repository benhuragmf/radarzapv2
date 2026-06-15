import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type TableOptions,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/shadcn/table'
import { themeClasses } from '../theme'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  loading?: boolean
  error?: { message: string; onRetry?: () => void }
  empty?: { title: string; description?: string }
  /** Conteúdo acima da tabela (ex.: FilterBar) */
  toolbar?: React.ReactNode
  /** Rodapé opcional — paginação, totais, etc. */
  footer?: React.ReactNode
  className?: string
  tableOptions?: Partial<Omit<TableOptions<TData>, 'data' | 'columns' | 'getCoreRowModel'>>
}

/** Tabela base preparada para TanStack Table — use em listagens futuras sem refatorar páginas existentes. */
export function DataTable<TData>({
  columns,
  data,
  loading,
  error,
  empty,
  toolbar,
  footer,
  className,
  tableOptions,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableOptions,
  })

  return (
    <div className={cn('space-y-3', className)}>
      {toolbar}
      <div className={cn(themeClasses.card, 'overflow-hidden p-0')}>
        {loading ? (
          <div className="p-5">
            <LoadingState rows={5} />
          </div>
        ) : error ? (
          <div className="p-5">
            <ErrorState message={error.message} onRetry={error.onRetry} />
          </div>
        ) : data.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={empty?.title ?? 'Nenhum registro'}
              description={empty?.description}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id}>
                  {hg.headers.map(header => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {footer ? (
          <div className="border-t border-[var(--rz-border)] px-4 py-3 text-sm text-[var(--rz-text-secondary)]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
