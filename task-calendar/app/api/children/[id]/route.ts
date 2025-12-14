import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const child = await prisma.child.findUnique({
      where: { id },
    })

    if (!child) {
      return NextResponse.json(
        { error: 'Child not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(child)
  } catch (error) {
    console.error('Error fetching child:', error)
    return NextResponse.json(
      { error: 'Failed to fetch child' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, color, inputBoolean } = body

    const child = await prisma.child.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color: color || null }),
        ...(inputBoolean !== undefined && { inputBoolean: inputBoolean || null }),
      },
    })

    return NextResponse.json(child)
  } catch (error) {
    console.error('Error updating child:', error)
    return NextResponse.json(
      { error: 'Failed to update child' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.child.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Child deleted successfully' })
  } catch (error) {
    console.error('Error deleting child:', error)
    return NextResponse.json(
      { error: 'Failed to delete child' },
      { status: 500 }
    )
  }
}

