import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const templates = await prisma.recurrenceTemplate.findMany({
      orderBy: {
        name: 'asc',
      },
    })
    return NextResponse.json(templates)
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
    const { name, description, frequency, dayOfWeek, dayOfMonth } = body

    if (!name || !frequency) {
      return NextResponse.json(
        { error: 'Name and frequency are required' },
        { status: 400 }
      )
    }

    if (frequency === 'weekly' && dayOfWeek === undefined) {
      return NextResponse.json(
        { error: 'dayOfWeek is required for weekly frequency' },
        { status: 400 }
      )
    }

    if (frequency === 'monthly' && dayOfMonth === undefined) {
      return NextResponse.json(
        { error: 'dayOfMonth is required for monthly frequency' },
        { status: 400 }
      )
    }

    const template = await prisma.recurrenceTemplate.create({
      data: {
        name,
        description: description || null,
        frequency,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : null,
        dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating recurrence template:', error)
    return NextResponse.json(
      { error: 'Failed to create recurrence template' },
      { status: 500 }
    )
  }
}

