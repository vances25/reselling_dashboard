'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Order, OrderStatus } from '@/lib/types'
import { StatusBadge } from './StatusBadge'
import { PlatformBadge } from './PlatformBadge'
import { OwnerAvatar } from './OwnerAvatar'
import { formatCurrency, formatDate } from '@/lib/utils'
import { OrderSlideOver } from './OrderSlideOver'
import { OrderModal } from './OrderModal'

interface Props {
  orders: Order[]
  total: number
  page: number
  pages: number
  onPageChange: (p: number) => void
  onRefresh: () => void
  groupByLocation?: boolean
}

const STATUSES: OrderStatus[] = ['Sourced', 'Listed', 'Sold', 'Archived']

export function OrdersTable({ orders, total, page, pages, onPageChange, onRefresh, groupByLocation }: Props) {
  const { data: session } = useSession()
  const userId = (session?.user as { id?: string })?.id

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [slideOver, setSlideOver] = useState<Order | null>(null)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: string; value: string } | null>(null)
  const inlineRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  useEffect(() => {
    inlineRef.current?.focus()
  }, [inlineEdit])

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === orders.length) setSelected(new Set())
    else setSelected(new Set(orders.map((o) => o._id)))
  }

  async function deleteOrder(id: string) {
    if (!confirm('Soft-delete this order?')) return
    await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  async function bulkAction(action: 'sold' | 'archived' | 'delete') {
    const ids = Array.from(selected)
    if (action === 'delete') {
      if (!confirm(`Delete ${ids.length} order(s)?`)) return
      await Promise.all(ids.map((id) => fetch(`/api/orders/${id}`, { method: 'DELETE' })))
    } else {
      const status = action === 'sold' ? 'Sold' : 'Archived'
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          })
        )
      )
    }
    setSelected(new Set())
    onRefresh()
  }

  async function saveInline() {
    if (!inlineEdit) return
    const { id, field, value } = inlineEdit
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: field === 'soldPrice' ? parseFloat(value) || undefined : value }),
    })
    setInlineEdit(null)
    onRefresh()
  }

  const rows = groupByLocation ? groupOrdersByLocation(orders) : orders

  return (
    <div className="flex flex-col gap-3">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2">
          <span className="text-sm text-gray-300">{selected.size} selected</span>
          <button onClick={() => bulkAction('sold')} className="text-xs px-3 py-1 bg-green-700 hover:bg-green-600 text-white rounded">Mark Sold</button>
          <button onClick={() => bulkAction('archived')} className="text-xs px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded">Archive</button>
          <button onClick={() => bulkAction('delete')} className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded">Delete</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-400 hover:text-white">Clear</button>
        </div>
      )}

      <div className="rounded-lg border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    className="accent-blue-500"
                    checked={selected.size === orders.length && orders.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Owner</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Product</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Platform</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Cost</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">List</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Sold</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Profit</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Location</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupByLocation
                ? renderGrouped(rows as GroupedRows, {
                    userId, selected, toggleSelect, setSlideOver, setEditOrder, setInlineEdit,
                    inlineEdit, inlineRef, saveInline, deleteOrder,
                  })
                : (orders as Order[]).map((order, i) => (
                    <OrderRow
                      key={order._id}
                      order={order}
                      idx={i}
                      userId={userId}
                      selected={selected}
                      toggleSelect={toggleSelect}
                      setSlideOver={setSlideOver}
                      setEditOrder={setEditOrder}
                      setInlineEdit={setInlineEdit}
                      inlineEdit={inlineEdit}
                      inlineRef={inlineRef}
                      saveInline={saveInline}
                      deleteOrder={deleteOrder}
                    />
                  ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-gray-500 text-sm">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{total} orders</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-1 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <span>Page {page} of {pages}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === pages}
              className="p-1 hover:text-white disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {slideOver && <OrderSlideOver order={slideOver} onClose={() => setSlideOver(null)} />}
      {editOrder && (
        <OrderModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSave={() => { setEditOrder(null); onRefresh() }}
        />
      )}
    </div>
  )
}

type GroupedRows = Record<string, Order[]>

function groupOrdersByLocation(orders: Order[]): GroupedRows {
  const groups: GroupedRows = {}
  for (const o of orders) {
    const loc = o.location ?? 'No Location'
    if (!groups[loc]) groups[loc] = []
    groups[loc].push(o)
  }
  return groups
}

interface RowProps {
  order: Order
  idx: number
  userId?: string
  selected: Set<string>
  toggleSelect: (id: string) => void
  setSlideOver: (o: Order) => void
  setEditOrder: (o: Order) => void
  setInlineEdit: (v: { id: string; field: string; value: string } | null) => void
  inlineEdit: { id: string; field: string; value: string } | null
  inlineRef: React.MutableRefObject<HTMLInputElement | HTMLSelectElement | null>
  saveInline: () => void
  deleteOrder: (id: string) => void
}

function OrderRow({ order, idx, userId, selected, toggleSelect, setSlideOver, setEditOrder, setInlineEdit, inlineEdit, inlineRef, saveInline, deleteOrder }: RowProps) {
  const isOwner = order.owner?._id === userId
  const isSelected = selected.has(order._id)
  const profit = order.profit
  const projected = order.projectedProfit

  const isInlineField = (field: string) =>
    inlineEdit?.id === order._id && inlineEdit?.field === field

  return (
    <tr
      className={`border-b border-gray-800 cursor-pointer h-[44px] ${idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/60'} hover:bg-gray-800/60 transition-colors ${isSelected ? 'ring-1 ring-inset ring-blue-500' : ''}`}
      onClick={() => setSlideOver(order)}
    >
      <td className="px-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="accent-blue-500"
          checked={isSelected}
          onChange={() => toggleSelect(order._id)}
        />
      </td>
      <td className="px-3 text-gray-400 whitespace-nowrap text-xs">{formatDate(order.sourceDate)}</td>
      <td className="px-3">
        <OwnerAvatar name={order.owner?.name ?? '?'} />
      </td>
      <td className="px-3 text-white max-w-[180px] truncate font-medium text-xs">{order.productName}</td>
      <td className="px-3"><PlatformBadge platform={order.platform} /></td>
      <td className="px-3 text-right text-gray-300 text-xs">{formatCurrency(order.purchaseCost)}</td>
      <td className="px-3 text-right text-gray-300 text-xs">{formatCurrency(order.listPrice)}</td>

      {/* Inline-editable: sold price */}
      <td
        className="px-3 text-right text-xs"
        onDoubleClick={(e) => {
          e.stopPropagation()
          if (isOwner) setInlineEdit({ id: order._id, field: 'soldPrice', value: order.soldPrice?.toString() ?? '' })
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isInlineField('soldPrice') ? (
          <input
            ref={(el) => { inlineRef.current = el }}
            type="number"
            step="0.01"
            value={inlineEdit!.value}
            onChange={(e) => setInlineEdit({ ...inlineEdit!, value: e.target.value })}
            onBlur={saveInline}
            onKeyDown={(e) => { if (e.key === 'Enter') saveInline(); if (e.key === 'Escape') setInlineEdit(null) }}
            className="w-20 text-right bg-gray-700 border border-blue-500 rounded px-1 py-0 text-white text-xs"
          />
        ) : (
          <span className="cursor-text" title={isOwner ? 'Double-click to edit' : ''}>
            {formatCurrency(order.soldPrice)}
          </span>
        )}
      </td>

      {/* Profit */}
      <td className="px-3 text-right text-xs">
        {profit != null ? (
          <span className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(profit)}</span>
        ) : projected != null ? (
          <span className="text-blue-400 opacity-70">~{formatCurrency(projected)}</span>
        ) : <span className="text-gray-600">—</span>}
      </td>

      {/* Inline-editable: status */}
      <td
        className="px-3"
        onDoubleClick={(e) => {
          e.stopPropagation()
          if (isOwner) setInlineEdit({ id: order._id, field: 'status', value: order.status })
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isInlineField('status') ? (
          <select
            ref={(el) => { inlineRef.current = el }}
            value={inlineEdit!.value}
            onChange={(e) => setInlineEdit({ ...inlineEdit!, value: e.target.value })}
            onBlur={saveInline}
            onKeyDown={(e) => { if (e.key === 'Enter') saveInline(); if (e.key === 'Escape') setInlineEdit(null) }}
            className="bg-gray-700 border border-blue-500 rounded px-1 py-0 text-white text-xs"
          >
            {['Sourced', 'Listed', 'Sold', 'Archived'].map((s) => <option key={s}>{s}</option>)}
          </select>
        ) : (
          <span title={isOwner ? 'Double-click to edit' : ''} className={isOwner ? 'cursor-text' : ''}>
            <StatusBadge status={order.status} />
          </span>
        )}
      </td>

      <td className="px-3 text-gray-400 text-xs max-w-[100px] truncate">{order.location ?? '—'}</td>

      {/* Actions */}
      <td className="px-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {isOwner && (
            <>
              <button
                onClick={() => setEditOrder(order)}
                className="text-gray-500 hover:text-blue-400 transition-colors"
                title="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => deleteOrder(order._id)}
                className="text-gray-500 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function renderGrouped(groups: GroupedRows, props: Omit<RowProps, 'order' | 'idx'>) {
  const rows: React.ReactNode[] = []
  let globalIdx = 0
  for (const [loc, groupOrders] of Object.entries(groups)) {
    rows.push(
      <tr key={`group-${loc}`} className="bg-gray-800/80">
        <td colSpan={12} className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {loc} ({groupOrders.length})
        </td>
      </tr>
    )
    for (const order of groupOrders) {
      rows.push(
        <OrderRow key={order._id} order={order} idx={globalIdx++} {...props} />
      )
    }
  }
  return rows
}

export type { GroupedRows }
