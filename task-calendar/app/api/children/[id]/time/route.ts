import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { minutes } = body

    if (typeof minutes !== 'number') {
      return NextResponse.json(
        { error: 'Minutes must be a number' },
        { status: 400 }
      )
    }

    // Get current child to calculate new balance
    const child = await prisma.child.findUnique({
      where: { id },
      select: {
        id: true,
        timeBalance: true,
      },
    })

    if (!child) {
      return NextResponse.json(
        { error: 'Child not found' },
        { status: 404 }
      )
    }

    // Update time balance (can be positive or negative)
    // Handle case where timeBalance might be null/undefined (defaults to 0)
    const currentBalance = child.timeBalance ?? 0
    const newBalance = currentBalance + minutes

    const updatedChild = await prisma.child.update({
      where: { id },
      data: {
        timeBalance: newBalance,
      },
    })

    return NextResponse.json(updatedChild)
  } catch (error) {
    console.error('Error updating child time:', error)
    return NextResponse.json(
      { error: 'Failed to update child time' },
      { status: 500 }
    )
  }
}

