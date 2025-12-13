import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        child: true,
        recurrenceTemplate: true,
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json(
      { error: 'Failed to fetch task' },
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
    const { title, description, dueDate, childId, recurrenceTemplateId } = body

    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(childId && { childId }),
        ...(recurrenceTemplateId !== undefined && {
          recurrenceTemplateId: recurrenceTemplateId || null,
        }),
      },
      include: {
        child: true,
        recurrenceTemplate: true,
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { completed } = body

    // Get task first for logging
    const existingTask = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        child: true,
      },
    })

    const now = new Date()
    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        completed: completed === true,
        completedAt: completed === true ? now : null,
      },
      include: {
        child: true,
        recurrenceTemplate: true,
      },
    })

    // Log completion tracking
    if (completed && existingTask) {
      const dueDate = new Date(existingTask.dueDate)
      const isOnTime = now <= dueDate
      const hoursLate = isOnTime ? 0 : Math.round((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60))
      
      console.log(`[COMPLETION] Task "${task.title}" completed by ${task.child.name} - ${isOnTime ? 'ON TIME' : `${hoursLate}h LATE`}`)
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the task first to check if it's part of a recurring series
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        recurrenceTemplateId: true,
        dueDate: true,
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Check if user wants to delete the whole series
    const { searchParams } = new URL(request.url)
    const deleteSeries = searchParams.get('deleteSeries') === 'true'

    if (deleteSeries && task.recurrenceTemplateId) {
      // Delete all future tasks from this recurrence template (including the current one)
      const deletedCount = await prisma.task.deleteMany({
        where: {
          recurrenceTemplateId: task.recurrenceTemplateId,
          dueDate: {
            gte: task.dueDate, // Delete this task and all future ones
          },
        },
      })

      console.log(`Deleted ${deletedCount.count} tasks from recurring series`)
      return NextResponse.json({ 
        message: `Deleted ${deletedCount.count} task(s) from recurring series`,
        deletedCount: deletedCount.count,
      })
    } else {
      // Delete just this one task
      await prisma.task.delete({
        where: { id: params.id },
      })

      return NextResponse.json({ message: 'Task deleted successfully' })
    }
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    )
  }
}

