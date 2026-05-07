import { OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const styles: Record<OrderStatus, string> = {
  Sourced: 'bg-gray-700 text-gray-300',
  Listed: 'bg-blue-900 text-blue-300',
  Sold: 'bg-green-900 text-green-300',
  Archived: 'bg-amber-900 text-amber-300',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', styles[status])}>
      {status}
    </span>
  )
}
