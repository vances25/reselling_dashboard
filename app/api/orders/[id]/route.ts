export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { Order } from '@/lib/models/Order'
import { authOptions } from '@/lib/auth'

const updateSchema = z.object({
  platform: z.enum(['eBay', 'Depop', 'Facebook', 'Other']).optional(),
  productName: z.string().min(1).max(200).optional(),
  condition: z.enum(['New', 'Like New', 'Very Good', 'Good', 'Fair', 'Poor']).optional(),
  purchaseCost: z.number().min(0).max(1_000_000).optional(),
  sourceDate: z.string().optional(),
  sourceLocation: z.string().max(200).optional(),
  listPrice: z.number().min(0).max(1_000_000).optional(),
  soldPrice: z.number().min(0).max(1_000_000).optional(),
  shippingCost: z.number().min(0).max(10_000).optional(),
  buyerPaysShipping: z.boolean().optional(),
  platformFees: z.number().min(0).max(1_000_000).optional(),
  status: z.enum(['Sourced', 'Listed', 'Sold', 'Archived']).optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  trackingNumber: z.string().max(100).optional(),
  buyerUsername: z.string().max(100).optional(),
})

function validateId(id: string) {
  return mongoose.isValidObjectId(id)
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Auth required
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!validateId(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await connectDB()
  const order = await Order.findById(params.id).populate('owner', 'name email').lean({ virtuals: true })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!validateId(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await connectDB()
  const order = await Order.findById(params.id)
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = (session.user as { id: string }).id
  if (order.owner.toString() !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updates = { ...parsed.data }
  if (updates.sourceDate) (updates as Record<string, unknown>).sourceDate = new Date(updates.sourceDate)

  Object.assign(order, updates)
  await order.save()

  return NextResponse.json(order.toJSON())
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!validateId(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await connectDB()
  const order = await Order.findById(params.id)
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = (session.user as { id: string }).id
  if (order.owner.toString() !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  order.deletedAt = new Date()
  await order.save()

  return NextResponse.json({ success: true })
}
