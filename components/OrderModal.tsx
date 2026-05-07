'use client'

import { useState } from 'react'
import { X, Info } from 'lucide-react'
import { Order, OrderPlatform, OrderStatus, ItemCondition } from '@/lib/types'
import { EBAY_FEE_RATE } from '@/lib/utils'

interface Props {
  order?: Order | null
  onClose: () => void
  onSave: () => void
}

const PLATFORMS: OrderPlatform[] = ['eBay', 'Depop', 'Facebook', 'Other']
const STATUSES: OrderStatus[] = ['Sourced', 'Listed', 'Sold', 'Archived']
const CONDITIONS: ItemCondition[] = ['New', 'Like New', 'Very Good', 'Good', 'Fair', 'Poor']

// eBay condition descriptions to help the user pick accurately
const CONDITION_HINTS: Record<ItemCondition, string> = {
  'New': 'Brand new, unused, unopened, undamaged',
  'Like New': 'Worn once or twice, no visible flaws',
  'Very Good': 'Minimal signs of wear, fully functional',
  'Good': 'Some signs of wear, no major defects',
  'Fair': 'Noticeable wear, minor defects, still works',
  'Poor': 'Heavy wear or damage — price accordingly',
}

const inputClass =
  'w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
const labelClass = 'block text-xs font-medium text-gray-400 mb-1'

export function OrderModal({ order, onClose, onSave }: Props) {
  const isEdit = !!order
  const [form, setForm] = useState({
    platform: order?.platform ?? 'eBay',
    productName: order?.productName ?? '',
    condition: order?.condition ?? '',
    purchaseCost: order?.purchaseCost?.toString() ?? '',
    sourceDate: order?.sourceDate ? order.sourceDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    sourceLocation: order?.sourceLocation ?? '',
    listPrice: order?.listPrice?.toString() ?? '',
    soldPrice: order?.soldPrice?.toString() ?? '',
    shippingCost: order?.shippingCost?.toString() ?? '0',
    buyerPaysShipping: order?.buyerPaysShipping ?? false,
    platformFees: order?.platformFees?.toString() ?? '',
    status: order?.status ?? 'Sourced',
    location: order?.location ?? '',
    notes: order?.notes ?? '',
    trackingNumber: order?.trackingNumber ?? '',
    buyerUsername: order?.buyerUsername ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  // Live profit preview
  const soldPrice = parseFloat(form.soldPrice) || 0
  const listPrice = parseFloat(form.listPrice) || 0
  const cost = parseFloat(form.purchaseCost) || 0
  const shipping = form.buyerPaysShipping ? 0 : (parseFloat(form.shippingCost) || 0)
  const feeRate = EBAY_FEE_RATE
  const customFees = form.platformFees ? parseFloat(form.platformFees) : null

  const actualProfit = soldPrice > 0
    ? soldPrice - cost - shipping - (customFees ?? soldPrice * feeRate)
    : null
  const projectedProfit = listPrice > 0 && soldPrice === 0
    ? listPrice - cost - (form.buyerPaysShipping ? 0 : shipping) - (customFees ?? listPrice * feeRate)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const body = {
      platform: form.platform,
      productName: form.productName,
      condition: form.condition || undefined,
      purchaseCost: parseFloat(form.purchaseCost) || 0,
      sourceDate: form.sourceDate,
      sourceLocation: form.sourceLocation || undefined,
      listPrice: form.listPrice ? parseFloat(form.listPrice) : undefined,
      soldPrice: form.soldPrice ? parseFloat(form.soldPrice) : undefined,
      shippingCost: parseFloat(form.shippingCost) || 0,
      buyerPaysShipping: form.buyerPaysShipping,
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
      setError(typeof data.error === 'string' ? data.error : 'Something went wrong')
      setSaving(false)
      return
    }

    onSave()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl shadow-2xl flex flex-col max-h-[92vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">{isEdit ? 'Edit Order' : 'Add Order'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

            {/* Section: Item Info */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Item</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Product Name *</label>
                  <input
                    required
                    type="text"
                    value={form.productName}
                    onChange={(e) => set('productName', e.target.value)}
                    placeholder="e.g. Nike Air Jordan 1 Retro High OG Chicago"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Platform</label>
                  <select value={form.platform} onChange={(e) => set('platform', e.target.value)} className={inputClass}>
                    {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Condition</label>
                  <select value={form.condition} onChange={(e) => set('condition', e.target.value)} className={inputClass}>
                    <option value="">— Select condition —</option>
                    {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  {form.condition && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Info size={11} />
                      {CONDITION_HINTS[form.condition as ItemCondition]}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Status</label>
                  <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Source Date</label>
                  <input type="date" value={form.sourceDate} onChange={(e) => set('sourceDate', e.target.value)} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Source Location</label>
                  <input type="text" value={form.sourceLocation} onChange={(e) => set('sourceLocation', e.target.value)} placeholder="e.g. Goodwill, Facebook Marketplace" className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Storage Location</label>
                  <input type="text" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Shelf A3, Bin 2" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Section: Pricing */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pricing</p>
              <div className="grid grid-cols-2 gap-3">
                {/* Row 1: Purchase Cost | List Price */}
                <div>
                  <label className={labelClass}>Purchase Cost ($) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.purchaseCost}
                    onChange={(e) => set('purchaseCost', e.target.value)}
                    placeholder="What you paid to source it"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>List Price ($)</label>
                  <input type="number" step="0.01" min="0" value={form.listPrice} onChange={(e) => set('listPrice', e.target.value)} placeholder="Your asking price on eBay" className={inputClass} />
                </div>

                {/* Row 2: Sold Price | Platform Fees */}
                <div>
                  <label className={labelClass}>Sold Price ($)</label>
                  <input type="number" step="0.01" min="0" value={form.soldPrice} onChange={(e) => set('soldPrice', e.target.value)} placeholder="Final sale price (after any offers)" className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Platform Fees ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.platformFees}
                    onChange={(e) => set('platformFees', e.target.value)}
                    placeholder={`auto (${(EBAY_FEE_RATE * 100).toFixed(2)}% eBay FVF)`}
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    eBay charges 13.25% final value fee. Leave blank to auto-calculate.
                  </p>
                </div>

                {/* Row 3: Shipping — two columns, checkbox left, input right */}
                <div>
                  <label className={labelClass}>Your Shipping Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={form.buyerPaysShipping}
                    value={form.buyerPaysShipping ? '' : form.shippingCost}
                    onChange={(e) => set('shippingCost', e.target.value)}
                    placeholder={form.buyerPaysShipping ? 'N/A — buyer pays' : '0.00'}
                    className={`${inputClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Cost of the label you printed</p>
                </div>

                <div className="flex flex-col justify-center">
                  <label className={labelClass}>Shipping paid by</label>
                  <label className="flex items-center gap-3 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:border-gray-600 transition-colors">
                    <input
                      type="checkbox"
                      className="accent-blue-500 w-4 h-4 shrink-0"
                      checked={form.buyerPaysShipping}
                      onChange={(e) => set('buyerPaysShipping', e.target.checked)}
                    />
                    <div>
                      <p className="text-sm text-white leading-tight">Buyer pays shipping</p>
                      <p className="text-xs text-gray-500 leading-tight mt-0.5">
                        {form.buyerPaysShipping ? 'Excluded from your costs' : 'Check if buyer paid shipping'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Live profit preview */}
              {(actualProfit !== null || projectedProfit !== null) && (
                <div className={`mt-3 rounded-lg px-4 py-2.5 text-sm flex items-center justify-between border ${
                  (actualProfit ?? projectedProfit ?? 0) >= 0
                    ? 'bg-green-950 border-green-800'
                    : 'bg-red-950 border-red-800'
                }`}>
                  <span className="text-gray-400">
                    {actualProfit !== null ? 'Profit' : 'Projected profit'}
                  </span>
                  <span className={`font-semibold ${
                    (actualProfit ?? projectedProfit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    ${(actualProfit ?? projectedProfit ?? 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Section: Sale Details */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sale Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Buyer Username</label>
                  <input type="text" value={form.buyerUsername} onChange={(e) => set('buyerUsername', e.target.value)} placeholder="eBay buyer ID" className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Tracking Number</label>
                  <input type="text" value={form.trackingNumber} onChange={(e) => set('trackingNumber', e.target.value)} placeholder="USPS / UPS / FedEx tracking #" className={inputClass} />
                </div>
              </div>

              <div className="mt-3">
                <label className={labelClass}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                  placeholder="Any details worth remembering (flaws, size, brand details…)"
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-950 border border-red-800 rounded px-3 py-2">
                {error}
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                const formEl = (e.currentTarget.closest('.fixed') as HTMLElement)?.querySelector('form')
                formEl?.requestSubmit()
              }}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Order'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
