export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomBytes } from 'crypto'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getConfig, setConfig } from '@/lib/models/Config'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const token = await getConfig('mcpApiToken', '')
  const enabled = await getConfig('mcpEnabled', false)
  return NextResponse.json({ token, enabled })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const token = randomBytes(32).toString('hex')
  await setConfig('mcpApiToken', token)
  return NextResponse.json({ token })
}
