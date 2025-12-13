import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        child: true,
        recurrenceTemplate: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    })
    return NextResponse.json(tasks)
  } catch (error: any) {
    console.error('Error fetching tasks:', error)
    // Check if it's a database schema error
    if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database not initialized. Please restart the add-on.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch tasks', details: error?.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, dueDate, childId, recurrenceTemplateId } = body

    if (!title || !dueDate || !childId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        dueDate: new Date(dueDate),
        childId,
        recurrenceTemplateId: recurrenceTemplateId || null,
      },
      include: {
        child: true,
        recurrenceTemplate: true,
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    )
  }
}

