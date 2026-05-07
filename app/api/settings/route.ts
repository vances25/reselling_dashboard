export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getConfig, setConfig } from '@/lib/models/Config'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const registrationOpen = await getConfig('registrationOpen', true)
  return NextResponse.json({ registrationOpen })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json()

  if (typeof body.registrationOpen === 'boolean') {
    await setConfig('registrationOpen', body.registrationOpen)
  }
  if (typeof body.mcpEnabled === 'boolean') {
    await setConfig('mcpEnabled', body.mcpEnabled)
  }

  const registrationOpen = await getConfig('registrationOpen', true)
  const mcpEnabled = await getConfig('mcpEnabled', false)
  return NextResponse.json({ registrationOpen, mcpEnabled })
}
