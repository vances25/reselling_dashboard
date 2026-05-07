export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'

export async function GET() {
  await connectDB()

  const allOrders = await Order.find({}).lean({ virtuals: true })
  const activeOrders = allOrders.filter((o) => !o.deletedAt)

  // Totals (include all, even deleted)
  let totalRevenue = 0
  let totalSpent = 0
  let totalProfit = 0

  for (const o of allOrders) {
    totalSpent += o.purchaseCost ?? 0
    if (o.soldPrice != null) {
      totalRevenue += o.soldPrice
      const fees = o.platformFees ?? o.soldPrice * 0.13
      totalProfit += o.soldPrice - (o.purchaseCost ?? 0) - (o.shippingCost ?? 0) - fees
    }
  }

  // Orders by status (active only)
  const statusCounts: Record<string, number> = {}
  const platformCounts: Record<string, number> = {}
  for (const o of activeOrders) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1
    platformCounts[o.platform] = (platformCounts[o.platform] ?? 0) + 1
  }

  // Profit by week (last 12 weeks, all orders)
  const now = new Date()
  const weekBuckets: Record<number, { week: string; profit: number; revenue: number }> = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const weekKey = getWeekKey(d)
    weekBuckets[i] = { week: weekKey, profit: 0, revenue: 0 }
  }

  for (const o of allOrders) {
    if (o.soldPrice == null || !o.sourceDate) continue
    const orderDate = new Date(o.sourceDate)
    const msAgo = now.getTime() - orderDate.getTime()
    const weeksAgo = Math.floor(msAgo / (7 * 86400000))
    if (weeksAgo < 0 || weeksAgo > 11) continue
    const bucket = weekBuckets[11 - weeksAgo]
    if (!bucket) continue
    const fees = o.platformFees ?? o.soldPrice * 0.13
    const profit = o.soldPrice - (o.purchaseCost ?? 0) - (o.shippingCost ?? 0) - fees
    bucket.profit += profit
    bucket.revenue += o.soldPrice
  }
  const profitByWeek = Object.values(weekBuckets)

  // Per-user stats
  const users = await User.find({}).lean()
  const userStats = users.map((u) => {
    const userOrders = allOrders.filter((o) => o.owner?.toString() === u._id.toString())
    const sold = userOrders.filter((o) => o.soldPrice != null)
    const listed = userOrders.filter((o) => ['Listed', 'Sold'].includes(o.status))

    let uRevenue = 0
    let uSpent = 0
    let uProfit = 0
    for (const o of userOrders) {
      uSpent += o.purchaseCost ?? 0
      if (o.soldPrice != null) {
        uRevenue += o.soldPrice
        const fees = o.platformFees ?? o.soldPrice * 0.13
        uProfit += o.soldPrice - (o.purchaseCost ?? 0) - (o.shippingCost ?? 0) - fees
      }
    }

    return {
      userId: u._id.toString(),
      name: u.name,
      orderCount: userOrders.length,
      totalSpent: uSpent,
      totalRevenue: uRevenue,
      totalProfit: uProfit,
      sellThroughRate: listed.length > 0 ? sold.length / listed.length : 0,
    }
  })

  return NextResponse.json({
    totalProfit,
    totalRevenue,
    totalSpent,
    ordersByStatus: statusCounts,
    ordersByPlatform: platformCounts,
    profitByWeek,
    userStats,
  })
}

function getWeekKey(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
