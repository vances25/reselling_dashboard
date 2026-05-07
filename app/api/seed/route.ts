import { NextResponse } from 'next/server'

// Seed endpoint disabled in production
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }
  return NextResponse.json({ message: 'Run npm run seed from the CLI instead' })
}
