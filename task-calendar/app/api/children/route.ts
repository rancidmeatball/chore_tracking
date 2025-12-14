import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const children = await prisma.child.findMany({
      orderBy: {
        name: 'asc',
      },
    })
    return NextResponse.json(children)
  } catch (error: any) {
    console.error('Error fetching children:', error)
    // Check if it's a database schema error
    if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database not initialized. Please restart the add-on.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch children', details: error?.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, color, inputBoolean } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const child = await prisma.child.create({
      data: { 
        name,
        color: color || null,
        inputBoolean: inputBoolean || null,
      },
    })

    return NextResponse.json(child, { status: 201 })
  } catch (error) {
    console.error('Error creating child:', error)
    return NextResponse.json(
      { error: 'Failed to create child' },
      { status: 500 }
    )
  }
}

