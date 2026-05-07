export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { EBAY_FEE_RATE } from '@/lib/utils'

export async function GET(req: Request) {
  const { getServerSession } = await import('next-auth')
  const { authOptions } = await import('@/lib/auth')
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  // Only include orders from real users (excludes orphaned seed data)
  const validOwnerIds = await User.distinct('_id')
  const allOrders = await Order.find({ owner: { $in: validOwnerIds } }).lean({ virtuals: true })
  const activeOrders = allOrders.filter((o) => !o.deletedAt)

  // Financial totals — all non-deleted orders
  let totalRevenue = 0
  let totalSpent = 0
  let totalProfit = 0

  for (const o of activeOrders) {
    totalSpent += o.purchaseCost ?? 0
    if (o.soldPrice != null) {
      const fees = o.platformFees ?? o.soldPrice * EBAY_FEE_RATE
      const shipping = o.buyerPaysShipping ? 0 : (o.shippingCost ?? 0)
      totalRevenue += o.soldPrice
      totalProfit += o.soldPrice - (o.purchaseCost ?? 0) - shipping - fees
    }
  }

  // Orders by status + platform (active, non-deleted)
  const statusCounts: Record<string, number> = {}
  const platformCounts: Record<string, number> = {}
  for (const o of activeOrders) {
    if (o.status) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1
    if (o.platform) platformCounts[o.platform] = (platformCounts[o.platform] ?? 0) + 1
  }

  // Profit by week — last 12 weeks, oldest→newest (left→right on chart)
  const now = new Date()
  const profitByWeek: { week: string; profit: number; revenue: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    profitByWeek.push({ week: getWeekKey(d), profit: 0, revenue: 0 })
  }

  for (const o of activeOrders) {
    if (o.soldPrice == null || !o.updatedAt) continue
    const orderDate = new Date(o.updatedAt)
    const msAgo = now.getTime() - orderDate.getTime()
    const weeksAgo = Math.floor(msAgo / (7 * 86400000))
    if (weeksAgo < 0 || weeksAgo > 11) continue
    const bucket = profitByWeek[11 - weeksAgo]
    if (!bucket) continue
    const fees = o.platformFees ?? o.soldPrice * EBAY_FEE_RATE
    const shipping = o.buyerPaysShipping ? 0 : (o.shippingCost ?? 0)
    bucket.profit += o.soldPrice - (o.purchaseCost ?? 0) - shipping - fees
    bucket.revenue += o.soldPrice
  }

  // Per-user stats
  const users = await User.find({}).lean()
  const userStats = users.map((u) => {
    const userOrders = activeOrders.filter((o) => o.owner?.toString() === u._id.toString())
    const sold = userOrders.filter((o) => o.soldPrice != null)
    const listed = userOrders.filter((o) => ['Listed', 'Sold'].includes(o.status))

    let uRevenue = 0, uSpent = 0, uProfit = 0
    for (const o of userOrders) {
      uSpent += o.purchaseCost ?? 0
      if (o.soldPrice != null) {
        const fees = o.platformFees ?? o.soldPrice * EBAY_FEE_RATE
        const shipping = o.buyerPaysShipping ? 0 : (o.shippingCost ?? 0)
        uRevenue += o.soldPrice
        uProfit += o.soldPrice - (o.purchaseCost ?? 0) - shipping - fees
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
