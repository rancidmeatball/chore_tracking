import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const template = await prisma.recurrenceTemplate.findUnique({
      where: { id: params.id },
      include: {
        child: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Parse daysOfWeek JSON string to array
    const response = {
      ...template,
      daysOfWeek: template.daysOfWeek ? JSON.parse(template.daysOfWeek) : null,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, description, frequency, daysOfWeek, dayOfMonth, dueDate, childId } = body

    const template = await prisma.recurrenceTemplate.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(frequency && { frequency }),
        ...(daysOfWeek !== undefined && {
          daysOfWeek: frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0 
            ? JSON.stringify(daysOfWeek) 
            : null,
        }),
        ...(dayOfMonth !== undefined && {
          dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
        }),
        ...(dueDate !== undefined && {
          dueDate: frequency === 'one-time' && dueDate ? new Date(dueDate) : null,
        }),
        ...(childId !== undefined && { childId: childId || null }),
      },
      include: {
        child: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Parse daysOfWeek for response
    const response = {
      ...template,
      daysOfWeek: template.daysOfWeek ? JSON.parse(template.daysOfWeek) : null,
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error updating template:', error)
    const errorMessage = error?.message || 'Failed to update template'
    return NextResponse.json(
      { error: errorMessage, details: error?.code || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.recurrenceTemplate.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Template deleted successfully' })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}

