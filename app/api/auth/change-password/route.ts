export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models/User'
import { checkRateLimit } from '@/lib/rateLimit'

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 5 attempts per user per 5 minutes
  const userId = (session.user as { id: string }).id
  const { allowed } = checkRateLimit(`change-pw:${userId}`, 5, 300_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again in 5 minutes.' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'New password must be 8–128 characters.' }, { status: 400 })
  }

  await connectDB()
  const user = await User.findById(userId)
  if (!user) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  // Uniform error regardless of whether the user doesn't exist vs wrong password
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })

  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10)
  await user.save()

  return NextResponse.json({ success: true })
}
