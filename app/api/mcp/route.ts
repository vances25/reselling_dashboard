export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { connectDB } from '@/lib/db'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { getConfig } from '@/lib/models/Config'
import { EBAY_FEE_RATE } from '@/lib/utils'

// ── auth ──────────────────────────────────────────────────────────────────────

async function authenticate(req: NextRequest): Promise<boolean> {
  const enabled = await getConfig('mcpEnabled', false)
  if (!enabled) return false

  const stored = String(await getConfig('mcpApiToken', ''))
  if (!stored) return false

  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!bearer) return false

  // Timing-safe comparison — prevents token brute-force via timing oracle
  try {
    const a = Buffer.from(bearer.padEnd(stored.length, '\0'))
    const b = Buffer.from(stored.padEnd(bearer.length, '\0'))
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b) && bearer.length === stored.length
  } catch {
    return false
  }
}

function unauthorized() {
  return NextResponse.json(
    { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized.' } },
    { status: 401 }
  )
}

// ── JSON-RPC helpers ──────────────────────────────────────────────────────────

function ok(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })
}

// ── tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_analytics',
    description: 'Returns total profit, revenue, amount spent, orders by status/platform, and 12-week profit trend.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_orders',
    description: 'Returns a list of orders, optionally filtered by status or platform.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['Sourced', 'Listed', 'Sold', 'Archived'] },
        platform: { type: 'string', enum: ['eBay', 'Depop', 'Facebook', 'Other'] },
        limit: { type: 'number', description: 'Max results (default 50, max 200)' },
      },
      required: [],
    },
  },
  {
    name: 'get_user_stats',
    description: 'Per-seller breakdown: order count, spent, revenue, profit, sell-through rate.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_listings',
    description: 'Active inventory (Sourced + Listed), optionally filtered by owner name.',
    inputSchema: {
      type: 'object',
      properties: {
        owner_name: { type: 'string', description: 'Filter by seller name' },
      },
      required: [],
    },
  },
]

// ── validated arg schemas ─────────────────────────────────────────────────────

const VALID_STATUSES = new Set(['Sourced', 'Listed', 'Sold', 'Archived'])
const VALID_PLATFORMS = new Set(['eBay', 'Depop', 'Facebook', 'Other'])

// ── tool execution ────────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  await connectDB()
  const validOwnerIds = await User.distinct('_id')

  if (name === 'get_analytics') {
    const orders = await Order.find({ owner: { $in: validOwnerIds }, deletedAt: null }).lean({ virtuals: true })
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

    const now = new Date()
    const weekTrend = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (11 - i) * 7)
      return { week: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), profit: 0, revenue: 0 }
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
    }
  }

  if (name === 'get_orders') {
    const limit = Math.min(200, Math.max(1, Number(args.limit ?? 50)))

    // Strict enum validation — prevent operator injection
    const statusArg = typeof args.status === 'string' ? args.status : undefined
    const platformArg = typeof args.platform === 'string' ? args.platform : undefined
    if (statusArg && !VALID_STATUSES.has(statusArg)) throw new Error('Invalid status value.')
    if (platformArg && !VALID_PLATFORMS.has(platformArg)) throw new Error('Invalid platform value.')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { owner: { $in: validOwnerIds }, deletedAt: null }
    if (statusArg) filter.status = statusArg
    if (platformArg) filter.platform = platformArg

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
    const ownerNameArg = typeof args.owner_name === 'string' ? args.owner_name.slice(0, 100) : undefined

    const listings = await Order.find({
      owner: { $in: validOwnerIds },
      deletedAt: null,
      status: { $in: ['Sourced', 'Listed'] },
    })
      .populate('owner', 'name')
      .sort({ sourceDate: -1 })
      .lean({ virtuals: true })

    const filtered = ownerNameArg
      ? listings.filter((o) =>
          ((o.owner as { name?: string })?.name ?? '').toLowerCase().includes(ownerNameArg.toLowerCase())
        )
      : listings

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

  throw new Error('Unknown tool.')
}

// ── handlers ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  await connectDB()
  if (!(await authenticate(req))) return unauthorized()

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown }
  try {
    body = await req.json()
  } catch {
    return rpcError(null, -32700, 'Parse error.')
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
      return ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] })
    } catch (e) {
      // Return safe error message — never expose internal DB/stack details
      const msg = e instanceof Error && !e.message.includes('at ') ? e.message : 'Internal error.'
      return rpcError(id, -32603, msg)
    }
  }

  return rpcError(id, -32601, 'Method not found.')
}

// GET requires valid token — no unauthenticated capability discovery
export async function GET(req: NextRequest) {
  await connectDB()
  if (!(await authenticate(req))) return unauthorized()
  return NextResponse.json({
    name: 'Reselling Dashboard MCP Server',
    version: '1.0.0',
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  })
}
