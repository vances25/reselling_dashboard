export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { authOptions } from '@/lib/auth'

const createSchema = z.object({
  platform: z.enum(['eBay', 'Depop', 'Facebook', 'Other']),
  productName: z.string().min(1).max(200),
  condition: z.enum(['New', 'Like New', 'Very Good', 'Good', 'Fair', 'Poor']).optional(),
  purchaseCost: z.number().min(0).max(1_000_000),
  sourceDate: z.string().optional(),
  sourceLocation: z.string().max(200).optional(),
  listPrice: z.number().min(0).max(1_000_000).optional(),
  soldPrice: z.number().min(0).max(1_000_000).optional(),
  shippingCost: z.number().min(0).max(10_000).optional(),
  buyerPaysShipping: z.boolean().optional(),
  platformFees: z.number().min(0).max(1_000_000).optional(),
  status: z.enum(['Sourced', 'Listed', 'Sold', 'Archived']).default('Sourced'),
  location: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  trackingNumber: z.string().max(100).optional(),
  buyerUsername: z.string().max(100).optional(),
})

// Escape regex metacharacters to prevent ReDoS
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function GET(req: NextRequest) {
  // Auth required — all order data is private
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { searchParams } = req.nextUrl

  const status = searchParams.get('status')
  const platform = searchParams.get('platform')
  const ownerParam = searchParams.get('owner')
  const searchRaw = searchParams.get('search')
  const showDeleted = searchParams.get('showDeleted') === 'true'
  const excludeArchived = searchParams.get('excludeArchived') === 'true'
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
  else if (excludeArchived) filter.status = { $ne: 'Archived' }
  if (platform) filter.platform = platform

  // Validate owner param as ObjectId before using in query
  if (ownerParam) {
    if (!mongoose.isValidObjectId(ownerParam)) {
      return NextResponse.json({ error: 'Invalid owner id' }, { status: 400 })
    }
    filter.owner = ownerParam
  } else {
    const validOwnerIds = await User.distinct('_id')
    filter.owner = { $in: validOwnerIds }
  }

  // Sanitize search: escape metacharacters + enforce length cap
  if (searchRaw) {
    const search = escapeRegex(searchRaw.slice(0, 100))
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

  // Atomic counter for orderId — avoids race condition from countDocuments + 1
  const { Config } = await import('@/lib/models/Config')
  const counter = await Config.findOneAndUpdate(
    { key: 'orderCounter' },
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  )
  const orderId = `ORD-${String(counter.value).padStart(4, '0')}`

  const order = await Order.create({
    ...parsed.data,
    orderId,
    owner: (session.user as { id: string }).id,
    sourceDate: parsed.data.sourceDate ? new Date(parsed.data.sourceDate) : new Date(),
  })

  return NextResponse.json(order, { status: 201 })
}
