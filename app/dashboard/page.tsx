'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Plus } from 'lucide-react'
import { Order, OrdersResponse, OrderStatus, OrderPlatform } from '@/lib/types'
import { OrdersTable } from '@/components/OrdersTable'
import { OrderModal } from '@/components/OrderModal'
import { formatCurrency } from '@/lib/utils'

const PLATFORMS: OrderPlatform[] = ['eBay', 'Depop', 'Facebook', 'Other']
const STATUSES: OrderStatus[] = ['Sourced', 'Listed', 'Sold', 'Archived']

const PLATFORM_COLORS: Record<OrderPlatform, string> = {
  eBay: 'bg-blue-900/60 text-blue-300 border-blue-800',
  Depop: 'bg-pink-900/60 text-pink-300 border-pink-800',
  Facebook: 'bg-teal-900/60 text-teal-300 border-teal-800',
  Other: 'bg-gray-700/60 text-gray-300 border-gray-600',
}

export default function DashboardPage() {
  const { data: session } = useSession()

  const [data, setData] = useState<OrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [platform, setPlatform] = useState('')
  const [owner, setOwner] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showModal, setShowModal] = useState(false)

  const [stats, setStats] = useState<{
    todayRevenue: number
    weekRevenue: number
    monthRevenue: number
    activeCount: number
    allTimeProfit: number
    platformCounts: Record<string, number>
  } | null>(null)

  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const fetchOrders = useCallback(async (params: {
    page: number; search: string; status: string; platform: string; owner: string; sortBy: string; sortDir: string
  }) => {
    setLoading(true)
    const q = new URLSearchParams()
    q.set('page', String(params.page))
    q.set('limit', '25')
    q.set('sortBy', params.sortBy)
    q.set('sortDir', params.sortDir)
    if (params.search) q.set('search', params.search)
    if (params.status) q.set('status', params.status)
    if (params.platform) q.set('platform', params.platform)
    if (params.owner) q.set('owner', params.owner)

    const res = await fetch(`/api/orders?${q}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [])

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/analytics')
    const json = await res.json()
    const now = new Date()
    const today = now.toDateString()
    const weekAgo = new Date(now.getTime() - 7 * 86400000)
    const monthAgo = new Date(now.getTime() - 30 * 86400000)

    // We'd need all orders for this — use analytics data
    setStats({
      todayRevenue: 0, // placeholder; real calculation needs all-orders fetch
      weekRevenue: 0,
      monthRevenue: 0,
      activeCount: Object.values(json.ordersByStatus as Record<string, number>).reduce((a: number, b: number) => a + b, 0),
      allTimeProfit: json.totalProfit,
      platformCounts: json.ordersByPlatform,
    })
    // suppress unused warnings
    void today; void weekAgo; void monthAgo
  }, [])

  // Fetch all sold orders for revenue stats
  const fetchRevenueStats = useCallback(async () => {
    const res = await fetch('/api/orders?limit=1000&status=Sold')
    const json = await res.json()
    const now = new Date()
    const todayStr = now.toDateString()
    const weekAgo = now.getTime() - 7 * 86400000
    const monthAgo = now.getTime() - 30 * 86400000

    let todayRev = 0, weekRev = 0, monthRev = 0
    for (const o of (json.orders as Order[])) {
      const d = new Date(o.updatedAt).getTime()
      if (o.soldPrice) {
        if (new Date(o.updatedAt).toDateString() === todayStr) todayRev += o.soldPrice
        if (d >= weekAgo) weekRev += o.soldPrice
        if (d >= monthAgo) monthRev += o.soldPrice
      }
    }

    setStats((s) => s ? { ...s, todayRevenue: todayRev, weekRevenue: weekRev, monthRevenue: monthRev } : s)
  }, [])

  useEffect(() => {
    fetchStats()
    fetchRevenueStats()
  }, [fetchStats, fetchRevenueStats])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchOrders({ page, search, status, platform, owner, sortBy, sortDir })
    }, search ? 300 : 0)
  }, [page, search, status, platform, owner, sortBy, sortDir, fetchOrders])

  function refresh() {
    fetchOrders({ page, search, status, platform, owner, sortBy, sortDir })
    fetchStats()
    fetchRevenueStats()
  }

  const userId = (session?.user as { id?: string })?.id

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Today's Revenue" value={formatCurrency(stats?.todayRevenue)} />
        <StatCard label="This Week" value={formatCurrency(stats?.weekRevenue)} />
        <StatCard label="This Month" value={formatCurrency(stats?.monthRevenue)} />
        <StatCard label="Active Orders" value={stats?.activeCount?.toString() ?? '—'} />
        <StatCard
          label="All-Time Profit"
          value={formatCurrency(stats?.allTimeProfit)}
          valueClass={stats?.allTimeProfit != null ? (stats.allTimeProfit >= 0 ? 'text-green-400' : 'text-red-400') : ''}
        />
      </div>

      {/* Platform pills */}
      {stats?.platformCounts && (
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const count = stats.platformCounts[p] ?? 0
            if (!count) return null
            return (
              <button
                key={p}
                onClick={() => setPlatform(platform === p ? '' : p)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${PLATFORM_COLORS[p]} ${platform === p ? 'ring-2 ring-white/30' : ''}`}
              >
                {p} · {count}
              </button>
            )
          })}
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search products, buyers, notes…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
        />

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <select
          value={platform}
          onChange={(e) => { setPlatform(e.target.value); setPage(1) }}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Platforms</option>
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </select>

        <select
          value={owner}
          onChange={(e) => { setOwner(e.target.value); setPage(1) }}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Owners</option>
          <option value={userId ?? ''}>Me</option>
        </select>

        <select
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [sb, sd] = e.target.value.split(':')
            setSortBy(sb)
            setSortDir(sd as 'asc' | 'desc')
          }}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="createdAt:desc">Newest First</option>
          <option value="createdAt:asc">Oldest First</option>
          <option value="date:desc">Source Date ↓</option>
          <option value="date:asc">Source Date ↑</option>
          <option value="profit:desc">Profit ↓</option>
          <option value="price:desc">List Price ↓</option>
          <option value="status:asc">Status</option>
        </select>

        <div className="ml-auto">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            Add Order
          </button>
        </div>
      </div>

      {/* Table */}
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
        />
      )}

      {showModal && (
        <OrderModal
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); refresh() }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${valueClass}`}>{value ?? '—'}</p>
    </div>
  )
}
