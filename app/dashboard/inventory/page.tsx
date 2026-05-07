'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle } from 'lucide-react'
import { OrdersResponse } from '@/lib/types'
import { OrdersTable } from '@/components/OrdersTable'

export default function InventoryPage() {
  const { data: session } = useSession()
  const userId = (session?.user as { id?: string })?.id

  const [data, setData] = useState<OrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [deathPileCount, setDeathPileCount] = useState(0)

  const fetchOrders = useCallback(async (p: number) => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(p), limit: '25', sortBy: 'date', sortDir: 'asc' })
    // Inventory = Sourced + Listed; we'll fetch both and merge
    const [sourcedRes, listedRes] = await Promise.all([
      fetch(`/api/orders?${q}&status=Sourced`),
      fetch(`/api/orders?${q}&status=Listed`),
    ])
    const [sourced, listed] = await Promise.all([sourcedRes.json(), listedRes.json()])

    // Merge and deduplicate (simple concat, paginate sourced)
    setData({
      orders: [...sourced.orders, ...listed.orders],
      total: sourced.total + listed.total,
      page: p,
      pages: Math.max(sourced.pages, listed.pages),
    })
    setLoading(false)
  }, [])

  const fetchDeathPile = useCallback(async () => {
    if (!userId) return
    const res = await fetch(`/api/orders?status=Sourced&owner=${userId}&limit=100`)
    const json = await res.json()
    setDeathPileCount(json.total)
  }, [userId])

  useEffect(() => {
    fetchOrders(page)
  }, [page, fetchOrders])

  useEffect(() => {
    fetchDeathPile()
  }, [fetchDeathPile])

  function refresh() {
    fetchOrders(page)
    fetchDeathPile()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Inventory</h1>
        <span className="text-sm text-gray-400">{data?.total ?? 0} active items</span>
      </div>

      {deathPileCount >= 10 && (
        <div className="flex items-start gap-3 bg-amber-900/30 border border-amber-700 rounded-lg px-4 py-3">
          <AlertTriangle className="text-amber-400 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-amber-300 font-medium text-sm">Death pile warning</p>
            <p className="text-amber-400/80 text-sm">
              You have {deathPileCount} unlisted items — clear your death pile before sourcing more.
            </p>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center h-48 text-gray-500">Loading…</div>
      ) : (
        <OrdersTable
          orders={data?.orders ?? []}
          total={data?.total ?? 0}
          page={data?.page ?? 1}
          pages={data?.pages ?? 1}
          onPageChange={(p) => setPage(p)}
          onRefresh={refresh}
          groupByLocation
        />
      )}
    </div>
  )
}
