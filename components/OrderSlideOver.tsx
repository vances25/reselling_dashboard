'use client'

import { X } from 'lucide-react'
import { Order } from '@/lib/types'
import { StatusBadge } from './StatusBadge'
import { PlatformBadge } from './PlatformBadge'
import { OwnerAvatar } from './OwnerAvatar'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  order: Order | null
  onClose: () => void
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-800">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-sm text-white">{value ?? '—'}</span>
    </div>
  )
}

export function OrderSlideOver({ order, onClose }: Props) {
  if (!order) return null

  const profit = order.profit
  const projected = order.projectedProfit

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-gray-900 border-l border-gray-800 z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <p className="text-xs text-gray-500">{order.orderId}</p>
            <h2 className="text-white font-semibold text-base leading-tight">{order.productName}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          <Row label="Status" value={<StatusBadge status={order.status} />} />
          <Row label="Platform" value={<PlatformBadge platform={order.platform} />} />
          <Row label="Owner" value={
            <span className="flex items-center gap-2">
              <OwnerAvatar name={order.owner?.name ?? '?'} />
              {order.owner?.name ?? '—'}
            </span>
          } />
          <Row label="Source Date" value={formatDate(order.sourceDate)} />
          <Row label="Source Location" value={order.sourceLocation} />
          <Row label="Location" value={order.location} />
          <Row label="Purchase Cost" value={formatCurrency(order.purchaseCost)} />
          <Row label="List Price" value={formatCurrency(order.listPrice)} />
          <Row label="Sold Price" value={formatCurrency(order.soldPrice)} />
          <Row label="Shipping Cost" value={formatCurrency(order.shippingCost)} />
          <Row label="Platform Fees" value={formatCurrency(order.platformFees ?? (order.soldPrice != null ? order.soldPrice * 0.13 : undefined))} />
          <Row
            label="Profit"
            value={
              profit != null ? (
                <span className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatCurrency(profit)}
                </span>
              ) : projected != null ? (
                <span className="text-blue-400">~{formatCurrency(projected)} projected</span>
              ) : '—'}
          />
          <Row label="Buyer" value={order.buyerUsername} />
          <Row label="Tracking" value={order.trackingNumber} />
          <Row label="Notes" value={order.notes} />
          <Row label="Created" value={formatDate(order.createdAt)} />
          {order.deletedAt && <Row label="Deleted" value={formatDate(order.deletedAt)} />}
        </div>
      </div>
    </>
  )
}
