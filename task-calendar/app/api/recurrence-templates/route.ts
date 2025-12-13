import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const templates = await prisma.recurrenceTemplate.findMany({
      include: {
        child: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })
    // Parse daysOfWeek JSON strings to arrays
    const parsedTemplates = templates.map(template => ({
      ...template,
      daysOfWeek: template.daysOfWeek ? JSON.parse(template.daysOfWeek) : null,
    }))
    return NextResponse.json(parsedTemplates)
  } catch (error) {
    console.error('Error fetching recurrence templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recurrence templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, frequency, daysOfWeek, dayOfMonth, dueDate, childId } = body

    if (!name || !frequency || !childId) {
      return NextResponse.json(
        { error: 'Name, frequency, and child are required' },
        { status: 400 }
      )
    }

    if (frequency === 'weekly' && (!daysOfWeek || daysOfWeek.length === 0)) {
      return NextResponse.json(
        { error: 'At least one day of week is required for weekly frequency' },
        { status: 400 }
      )
    }

    if (frequency === 'monthly' && (dayOfMonth === undefined || dayOfMonth < 1 || dayOfMonth > 31)) {
      return NextResponse.json(
        { error: 'dayOfMonth is required for monthly frequency (must be 1-31)' },
        { status: 400 }
      )
    }

    if (frequency === 'one-time' && !dueDate) {
      return NextResponse.json(
        { error: 'dueDate is required for one-time frequency' },
        { status: 400 }
      )
    }

    const template = await prisma.recurrenceTemplate.create({
      data: {
        name,
        description: description || null,
        frequency,
        daysOfWeek: frequency === 'weekly' ? JSON.stringify(daysOfWeek) : null,
        dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
        dueDate: frequency === 'one-time' && dueDate ? new Date(dueDate) : null,
        childId: childId || null,
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

    return NextResponse.json(response, { status: 201 })
  } catch (error: any) {
    console.error('Error creating recurrence template:', error)
    // Return more specific error message
    const errorMessage = error?.message || 'Failed to create recurrence template'
    return NextResponse.json(
      { error: errorMessage, details: error?.code || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

