import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Health check route works!',
    timestamp: new Date().toISOString()
  })
}
