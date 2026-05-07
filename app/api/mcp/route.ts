export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { getConfig } from '@/lib/models/Config'
import { EBAY_FEE_RATE } from '@/lib/utils'

// ── auth helper ──────────────────────────────────────────────────────────────

async function authenticate(req: NextRequest): Promise<boolean> {
  const enabled = await getConfig('mcpEnabled', false)
  if (!enabled) return false

  const stored = await getConfig('mcpApiToken', '')
  if (!stored) return false

  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  return bearer === stored
}

// ── JSON-RPC response helpers ─────────────────────────────────────────────────

function ok(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}

function err(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })
}

// ── tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_analytics',
    description: 'Returns total profit, revenue, amount spent, orders by status, orders by platform, and profit trend for the last 12 weeks.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_orders',
    description: 'Returns a list of orders. Optionally filter by status or platform.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['Sourced', 'Listed', 'Sold', 'Archived'],
          description: 'Filter by order status',
        },
        platform: {
          type: 'string',
          enum: ['eBay', 'Depop', 'Facebook', 'Other'],
          description: 'Filter by platform',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 50, max 200)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_user_stats',
    description: 'Returns per-user breakdown: order count, total spent, revenue, profit, and sell-through rate for each seller.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_listings',
    description: 'Returns all active inventory (Sourced + Listed orders) with location and pricing info.',
    inputSchema: {
      type: 'object',
      properties: {
        owner_name: {
          type: 'string',
          description: 'Filter by seller name (e.g. "Me" or "Friend")',
        },
      },
      required: [],
    },
  },
]

// ── tool execution ────────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  await connectDB()
  const validOwnerIds = await User.distinct('_id')

  if (name === 'get_analytics') {
    const orders = await Order.find({ owner: { $in: validOwnerIds }, deletedAt: null }).lean({ virtuals: true })
    const users = await User.find({}).lean()

    let totalRevenue = 0, totalSpent = 0, totalProfit = 0
    const statusCounts: Record<string, number> = {}
    const platformCounts: Record<string, number> = {}

    for (const o of orders) {
      totalSpent += o.purchaseCost ?? 0
      if (o.status) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1
      if (o.platform) platformCounts[o.platform] = (platformCounts[o.platform] ?? 0) + 1
      if (o.soldPrice != null) {
        const fees = o.platformFees ?? o.soldPrice * EBAY_FEE_RATE
        const shipping = o.buyerPaysShipping ? 0 : (o.shippingCost ?? 0)
        totalRevenue += o.soldPrice
        totalProfit += o.soldPrice - (o.purchaseCost ?? 0) - shipping - fees
      }
    }

    // 12-week profit trend
    const now = new Date()
    const weekTrend = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (11 - i) * 7)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { week: label, profit: 0, revenue: 0 }
    })
    for (const o of orders) {
      if (o.soldPrice == null || !o.updatedAt) continue
      const weeksAgo = Math.floor((now.getTime() - new Date(o.updatedAt).getTime()) / (7 * 86400000))
      if (weeksAgo < 0 || weeksAgo > 11) continue
      const bucket = weekTrend[11 - weeksAgo]
      if (!bucket) continue
      const fees = o.platformFees ?? o.soldPrice * EBAY_FEE_RATE
      const shipping = o.buyerPaysShipping ? 0 : (o.shippingCost ?? 0)
      bucket.profit += o.soldPrice - (o.purchaseCost ?? 0) - shipping - fees
      bucket.revenue += o.soldPrice
    }

    return {
      totalRevenue: +totalRevenue.toFixed(2),
      totalSpent: +totalSpent.toFixed(2),
      totalProfit: +totalProfit.toFixed(2),
      totalOrders: orders.length,
      soldOrders: orders.filter((o) => o.soldPrice != null).length,
      ordersByStatus: statusCounts,
      ordersByPlatform: platformCounts,
      profitTrend: weekTrend,
      sellers: users.map((u) => u.name),
    }
  }

  if (name === 'get_orders') {
    const limit = Math.min(200, Number(args.limit ?? 50))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { owner: { $in: validOwnerIds }, deletedAt: null }
    if (args.status) filter.status = args.status
    if (args.platform) filter.platform = args.platform

    const orders = await Order.find(filter)
      .populate('owner', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean({ virtuals: true })

    return orders.map((o) => ({
      orderId: o.orderId,
      productName: o.productName,
      platform: o.platform,
      condition: o.condition,
      status: o.status,
      owner: (o.owner as { name?: string })?.name ?? 'Unknown',
      purchaseCost: o.purchaseCost,
      listPrice: o.listPrice,
      soldPrice: o.soldPrice,
      shippingCost: o.buyerPaysShipping ? 0 : o.shippingCost,
      buyerPaysShipping: o.buyerPaysShipping,
      profit: o.profit != null ? +o.profit.toFixed(2) : null,
      projectedProfit: o.projectedProfit != null ? +o.projectedProfit.toFixed(2) : null,
      sourceLocation: o.sourceLocation,
      location: o.location,
      sourceDate: o.sourceDate,
      trackingNumber: o.trackingNumber,
      buyerUsername: o.buyerUsername,
    }))
  }

  if (name === 'get_user_stats') {
    const users = await User.find({}).lean()
    const orders = await Order.find({ owner: { $in: validOwnerIds }, deletedAt: null }).lean({ virtuals: true })

    return users.map((u) => {
      const userOrders = orders.filter((o) => o.owner?.toString() === u._id.toString())
      const sold = userOrders.filter((o) => o.soldPrice != null)
      const listed = userOrders.filter((o) => ['Listed', 'Sold'].includes(o.status))

      let revenue = 0, spent = 0, profit = 0
      for (const o of userOrders) {
        spent += o.purchaseCost ?? 0
        if (o.soldPrice != null) {
          const fees = o.platformFees ?? o.soldPrice * EBAY_FEE_RATE
          const shipping = o.buyerPaysShipping ? 0 : (o.shippingCost ?? 0)
          revenue += o.soldPrice
          profit += o.soldPrice - (o.purchaseCost ?? 0) - shipping - fees
        }
      }

      return {
        name: u.name,
        email: u.email,
        totalOrders: userOrders.length,
        soldOrders: sold.length,
        activeOrders: userOrders.filter((o) => ['Sourced', 'Listed'].includes(o.status)).length,
        totalSpent: +spent.toFixed(2),
        totalRevenue: +revenue.toFixed(2),
        totalProfit: +profit.toFixed(2),
        sellThroughRate: listed.length > 0 ? +((sold.length / listed.length) * 100).toFixed(1) : 0,
      }
    })
  }

  if (name === 'get_listings') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {
      owner: { $in: validOwnerIds },
      deletedAt: null,
      status: { $in: ['Sourced', 'Listed'] },
    }

    const listings = await Order.find(filter)
      .populate('owner', 'name')
      .sort({ sourceDate: -1 })
      .lean({ virtuals: true })

    let filtered = listings
    if (args.owner_name) {
      const name = String(args.owner_name).toLowerCase()
      filtered = listings.filter((o) =>
        ((o.owner as { name?: string })?.name ?? '').toLowerCase().includes(name)
      )
    }

    return filtered.map((o) => ({
      orderId: o.orderId,
      productName: o.productName,
      platform: o.platform,
      condition: o.condition,
      status: o.status,
      owner: (o.owner as { name?: string })?.name ?? 'Unknown',
      purchaseCost: o.purchaseCost,
      listPrice: o.listPrice,
      projectedProfit: o.projectedProfit != null ? +o.projectedProfit.toFixed(2) : null,
      sourceLocation: o.sourceLocation,
      location: o.location,
      sourceDate: o.sourceDate,
      notes: o.notes,
    }))
  }

  throw new Error(`Unknown tool: ${name}`)
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  await connectDB()

  const authed = await authenticate(req)
  if (!authed) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized — MCP server disabled or invalid token.' } },
      { status: 401 }
    )
  }

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown }
  try {
    body = await req.json()
  } catch {
    return err(null, -32700, 'Parse error')
  }

  const { id, method, params } = body

  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'Reselling Dashboard', version: '1.0.0' },
    })
  }

  if (method === 'notifications/initialized') {
    return new NextResponse(null, { status: 204 })
  }

  if (method === 'tools/list') {
    return ok(id, { tools: TOOLS })
  }

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params as { name: string; arguments?: Record<string, unknown> }
    try {
      const result = await callTool(name, args)
      return ok(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      })
    } catch (e) {
      return err(id, -32603, e instanceof Error ? e.message : 'Internal error')
    }
  }

  return err(id, -32601, `Method not found: ${method}`)
}

// MCP servers should also respond to GET for capability discovery
export async function GET() {
  return NextResponse.json({
    name: 'Reselling Dashboard MCP Server',
    version: '1.0.0',
    description: 'Read-only access to orders, analytics, listings, and per-user stats.',
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  })
}
