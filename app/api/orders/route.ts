export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import { Order } from '@/lib/models/Order'
import { authOptions } from '@/lib/auth'

const createSchema = z.object({
  platform: z.enum(['eBay', 'Depop', 'Facebook', 'Other']),
  productName: z.string().min(1),
  condition: z.enum(['New', 'Like New', 'Very Good', 'Good', 'Fair', 'Poor']).optional(),
  purchaseCost: z.number().min(0),
  sourceDate: z.string().optional(),
  sourceLocation: z.string().optional(),
  listPrice: z.number().optional(),
  soldPrice: z.number().optional(),
  shippingCost: z.number().min(0).optional(),
  buyerPaysShipping: z.boolean().optional(),
  platformFees: z.number().optional(),
  status: z.enum(['Sourced', 'Listed', 'Sold', 'Archived']).default('Sourced'),
  location: z.string().optional(),
  notes: z.string().optional(),
  trackingNumber: z.string().optional(),
  buyerUsername: z.string().optional(),
})

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = req.nextUrl

  const status = searchParams.get('status')
  const platform = searchParams.get('platform')
  const owner = searchParams.get('owner')
  const search = searchParams.get('search')
  const showDeleted = searchParams.get('showDeleted') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25')))
  const sortBy = searchParams.get('sortBy') ?? 'createdAt'
  const sortDir = searchParams.get('sortDir') === 'asc' ? 1 : -1

  const sortMap: Record<string, string> = {
    date: 'sourceDate',
    profit: 'soldPrice',
    price: 'listPrice',
    status: 'status',
    createdAt: 'createdAt',
  }
  const sortField = sortMap[sortBy] ?? 'createdAt'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {}
  if (!showDeleted) filter.deletedAt = null
  if (status) filter.status = status
  if (platform) filter.platform = platform
  if (owner) filter.owner = owner
  if (search) {
    filter.$or = [
      { productName: { $regex: search, $options: 'i' } },
      { buyerUsername: { $regex: search, $options: 'i' } },
      { notes: { $regex: search, $options: 'i' } },
    ]
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('owner', 'name email')
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean({ virtuals: true }),
    Order.countDocuments(filter),
  ])

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const count = await Order.countDocuments()
  const orderId = `ORD-${String(count + 1).padStart(4, '0')}`

  const order = await Order.create({
    ...parsed.data,
    orderId,
    owner: (session.user as { id: string }).id,
    sourceDate: parsed.data.sourceDate ? new Date(parsed.data.sourceDate) : new Date(),
  })

  return NextResponse.json(order, { status: 201 })
}
