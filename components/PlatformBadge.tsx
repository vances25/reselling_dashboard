import { OrderPlatform } from '@/lib/types'
import { cn } from '@/lib/utils'

const styles: Record<OrderPlatform, string> = {
  eBay: 'bg-blue-900 text-blue-300',
  Depop: 'bg-pink-900 text-pink-300',
  Facebook: 'bg-teal-900 text-teal-300',
  Other: 'bg-gray-700 text-gray-300',
}

export function PlatformBadge({ platform }: { platform: OrderPlatform }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', styles[platform])}>
      {platform}
    </span>
  )
}
