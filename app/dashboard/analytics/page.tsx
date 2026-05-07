'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface UserStat {
  userId: string
  name: string
  orderCount: number
  totalSpent: number
  totalRevenue: number
  totalProfit: number
  sellThroughRate: number
}

interface AnalyticsData {
  totalProfit: number
  totalRevenue: number
  totalSpent: number
  ordersByStatus: Record<string, number>
  ordersByPlatform: Record<string, number>
  profitByWeek: { week: string; profit: number; revenue: number }[]
  userStats: UserStat[]
}

const PLATFORM_COLORS: Record<string, string> = {
  eBay: '#3b82f6',
  Depop: '#ec4899',
  Facebook: '#14b8a6',
  Other: '#6b7280',
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartMode, setChartMode] = useState<'profit' | 'revenue'>('profit')
  const [topItems, setTopItems] = useState<{ productName: string; profit: number }[]>([])
  const [topLocations, setTopLocations] = useState<{ location: string; avgProfit: number; count: number }[]>([])

  useEffect(() => {
    fetch('/api/analytics').then((r) => r.json()).then(setData).finally(() => setLoading(false))
    // Top items + locations from all sold orders
    fetch('/api/orders?status=Sold&limit=200').then((r) => r.json()).then((json) => {
      const orders = json.orders as {
        productName: string; profit?: number; soldPrice?: number; purchaseCost?: number;
        shippingCost?: number; platformFees?: number; sourceLocation?: string
      }[]

      const sorted = [...orders]
        .map((o) => ({
          productName: o.productName,
          profit: o.profit ?? (o.soldPrice != null
            ? o.soldPrice - (o.purchaseCost ?? 0) - (o.shippingCost ?? 0) - (o.platformFees ?? o.soldPrice * 0.13)
            : 0),
        }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5)

      setTopItems(sorted)

      const locMap: Record<string, { total: number; count: number }> = {}
      for (const o of orders) {
        const loc = o.sourceLocation ?? 'Unknown'
        const profit = o.profit ?? (o.soldPrice != null
          ? o.soldPrice - (o.purchaseCost ?? 0) - (o.shippingCost ?? 0) - (o.platformFees ?? o.soldPrice * 0.13)
          : 0)
        if (!locMap[loc]) locMap[loc] = { total: 0, count: 0 }
        locMap[loc].total += profit
        locMap[loc].count++
      }
      const locs = Object.entries(locMap)
        .map(([location, { total, count }]) => ({ location, avgProfit: total / count, count }))
        .sort((a, b) => b.avgProfit - a.avgProfit)
      setTopLocations(locs)
    })
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>
  }
  if (!data) return null

  const platformData = Object.entries(data.ordersByPlatform).map(([name, value]) => ({ name, value }))
  const statusData = Object.entries(data.ordersByStatus).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Revenue" value={formatCurrency(data.totalRevenue)} />
        <SummaryCard label="Total Spent" value={formatCurrency(data.totalSpent)} />
        <SummaryCard
          label="Total Profit"
          value={formatCurrency(data.totalProfit)}
          valueClass={data.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {/* Profit over time */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-medium">Profit Over Time (Last 12 Weeks)</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setChartMode('profit')}
              className={`text-xs px-3 py-1 rounded ${chartMode === 'profit' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Profit
            </button>
            <button
              onClick={() => setChartMode('revenue')}
              className={`text-xs px-3 py-1 rounded ${chartMode === 'revenue' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Revenue
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.profitByWeek}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(v) => [formatCurrency(v as number), chartMode === 'profit' ? 'Profit' : 'Revenue']}
            />
            <Line
              type="monotone"
              dataKey={chartMode}
              stroke={chartMode === 'profit' ? '#34d399' : '#60a5fa'}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-medium mb-4">Orders by Platform</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={platformData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                {platformData.map((entry) => (
                  <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name] ?? '#6b7280'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status bar chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-medium mb-4">Orders by Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Me vs Friend */}
      {data.userStats.length >= 2 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-medium mb-4">Me vs Friend</h2>
          <div className="grid grid-cols-2 gap-4">
            {data.userStats.map((u) => (
              <div key={u.userId} className="bg-gray-800 rounded-lg p-4 space-y-2">
                <p className="text-white font-semibold">{u.name}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Orders" value={String(u.orderCount)} />
                  <Stat label="Sell-through" value={`${(u.sellThroughRate * 100).toFixed(0)}%`} />
                  <Stat label="Spent" value={formatCurrency(u.totalSpent)} />
                  <Stat label="Revenue" value={formatCurrency(u.totalRevenue)} />
                  <Stat
                    label="Profit"
                    value={formatCurrency(u.totalProfit)}
                    valueClass={u.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 most profitable */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-medium mb-3">Top 5 Most Profitable Items</h2>
          <div className="space-y-2">
            {topItems.length === 0 && <p className="text-gray-500 text-sm">No sold orders yet</p>}
            {topItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span className="text-sm text-gray-300 truncate max-w-[220px]">{item.productName}</span>
                <span className={`text-sm font-medium ${item.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(item.profit)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Best sourcing locations */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-medium mb-3">Best Sourcing Locations</h2>
          <div className="space-y-2">
            {topLocations.length === 0 && <p className="text-gray-500 text-sm">No sold orders yet</p>}
            {topLocations.map((loc, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span className="text-sm text-gray-300">{loc.location}</span>
                <div className="text-right">
                  <span className={`text-sm font-medium ${loc.avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(loc.avgProfit)} avg
                  </span>
                  <span className="text-xs text-gray-500 ml-2">({loc.count} sold)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}

function Stat({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm font-medium ${valueClass}`}>{value}</p>
    </div>
  )
}
