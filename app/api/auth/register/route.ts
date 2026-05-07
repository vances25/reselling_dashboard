export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models/User'
import { getConfig } from '@/lib/models/Config'
import { checkRateLimit } from '@/lib/rateLimit'

const schema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email().max(200),
  password: z.string().min(8).max(128),
})

export async function POST(req: NextRequest) {
  // Rate limit: 5 attempts per IP per minute
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const { allowed } = checkRateLimit(`register:${ip}`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  await connectDB()

  // Default is false — admin must explicitly enable registration
  const registrationOpen = await getConfig('registrationOpen', false)
  if (!registrationOpen) {
    return NextResponse.json({ error: 'Registration is currently disabled.' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { name, email, password } = parsed.data
  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await User.create({ name, email: email.toLowerCase(), passwordHash })

  return NextResponse.json({ success: true }, { status: 201 })
}

export async function GET() {
  await connectDB()
  // Default false — registration closed unless explicitly enabled
  const registrationOpen = await getConfig('registrationOpen', false)
  return NextResponse.json({ registrationOpen })
}
