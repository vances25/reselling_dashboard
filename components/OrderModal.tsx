'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Order, OrderPlatform, OrderStatus } from '@/lib/types'

interface Props {
  order?: Order | null
  onClose: () => void
  onSave: () => void
}

const PLATFORMS: OrderPlatform[] = ['eBay', 'Depop', 'Facebook', 'Other']
const STATUSES: OrderStatus[] = ['Sourced', 'Listed', 'Sold', 'Archived']

export function OrderModal({ order, onClose, onSave }: Props) {
  const isEdit = !!order
  const [form, setForm] = useState({
    platform: order?.platform ?? 'eBay',
    productName: order?.productName ?? '',
    purchaseCost: order?.purchaseCost?.toString() ?? '',
    sourceDate: order?.sourceDate ? order.sourceDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    sourceLocation: order?.sourceLocation ?? '',
    listPrice: order?.listPrice?.toString() ?? '',
    soldPrice: order?.soldPrice?.toString() ?? '',
    shippingCost: order?.shippingCost?.toString() ?? '0',
    platformFees: order?.platformFees?.toString() ?? '',
    status: order?.status ?? 'Sourced',
    location: order?.location ?? '',
    notes: order?.notes ?? '',
    trackingNumber: order?.trackingNumber ?? '',
    buyerUsername: order?.buyerUsername ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const body = {
      platform: form.platform,
      productName: form.productName,
      purchaseCost: parseFloat(form.purchaseCost) || 0,
      sourceDate: form.sourceDate,
      sourceLocation: form.sourceLocation || undefined,
      listPrice: form.listPrice ? parseFloat(form.listPrice) : undefined,
      soldPrice: form.soldPrice ? parseFloat(form.soldPrice) : undefined,
      shippingCost: parseFloat(form.shippingCost) || 0,
      platformFees: form.platformFees ? parseFloat(form.platformFees) : undefined,
      status: form.status,
      location: form.location || undefined,
      notes: form.notes || undefined,
      trackingNumber: form.trackingNumber || undefined,
      buyerUsername: form.buyerUsername || undefined,
    }

    const url = isEdit ? `/api/orders/${order!._id}` : '/api/orders'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error?.message ?? 'Something went wrong')
      setSaving(false)
      return
    }

    onSave()
  }

  function field(label: string, children: React.ReactNode) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
        {children}
      </div>
    )
  }

  const input = (key: string, type = 'text', placeholder = '') => (
    <input
      type={type}
      value={form[key as keyof typeof form]}
      onChange={(e) => set(key, e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  )

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">{isEdit ? 'Edit Order' : 'Add Order'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              {field('Product Name *',
                <input
                  required
                  type="text"
                  value={form.productName}
                  onChange={(e) => set('productName', e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}

              {field('Platform',
                <select
                  value={form.platform}
                  onChange={(e) => set('platform', e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                </select>
              )}

              {field('Status',
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              )}

              {field('Source Date', input('sourceDate', 'date'))}
              {field('Purchase Cost ($) *',
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.purchaseCost}
                  onChange={(e) => set('purchaseCost', e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
              {field('Shipping Cost ($)', input('shippingCost', 'number'))}
              {field('List Price ($)', input('listPrice', 'number'))}
              {field('Sold Price ($)', input('soldPrice', 'number'))}
              {field('Platform Fees ($)', input('platformFees', 'number', 'auto (13%)'))}
              {field('Source Location', input('sourceLocation', 'text', 'e.g. Goodwill'))}
              {field('Storage Location', input('location', 'text', 'e.g. Shelf A3'))}
              {field('Buyer Username', input('buyerUsername'))}
              {field('Tracking Number', input('trackingNumber'))}
            </div>

            <div className="mt-3">
              {field('Notes',
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              )}
            </div>

            {error && (
              <div className="mt-3 text-red-400 text-sm bg-red-950 border border-red-800 rounded px-3 py-2">
                {error}
              </div>
            )}
          </form>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                const form = e.currentTarget.closest('.fixed')?.querySelector('form')
                form?.requestSubmit()
              }}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Order'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
