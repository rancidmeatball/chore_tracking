import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Dedicated endpoint for tracking task completion
 * Provides detailed logging and tracking of when chores are completed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Get the task first to log details
    const task = await prisma.task.findUnique({
      where: { id },
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

    const body = await request.json()
    const { completed } = body

    // Calculate completion time relative to due date
    const now = new Date()
    const dueDate = new Date(task.dueDate)
    const timeDifference = now.getTime() - dueDate.getTime()
    const hoursDifference = Math.round(timeDifference / (1000 * 60 * 60))
    const isOnTime = timeDifference <= 0 // Completed on or before due date
    const isLate = timeDifference > 0

    // Update the task
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        completed: completed === true,
        completedAt: completed === true ? now : null,
      },
      include: {
        child: true,
        recurrenceTemplate: true,
      },
    })

    // Log completion details
    if (completed) {
      console.log('='.repeat(60))
      console.log('TASK COMPLETION TRACKED')
      console.log('='.repeat(60))
      console.log(`Task ID: ${task.id}`)
      console.log(`Task Title: ${task.title}`)
      console.log(`Child: ${task.child.name}`)
      console.log(`Due Date: ${dueDate.toLocaleString()}`)
      console.log(`Completed At: ${now.toLocaleString()}`)
      console.log(`Status: ${isOnTime ? '✅ ON TIME' : `⚠️ LATE by ${hoursDifference} hours`}`)
      if (task.recurrenceTemplate) {
        console.log(`Recurring: Yes (${task.recurrenceTemplate.frequency})`)
      }
      console.log('='.repeat(60))
    } else {
      console.log(`Task "${task.title}" marked as incomplete`)
    }

    return NextResponse.json({
      ...updatedTask,
      completionDetails: completed ? {
        completedAt: now.toISOString(),
        isOnTime,
        isLate,
        hoursDifference: isLate ? hoursDifference : 0,
        dueDate: dueDate.toISOString(),
      } : null,
    })
  } catch (error) {
    console.error('Error tracking task completion:', error)
    return NextResponse.json(
      { error: 'Failed to track task completion' },
      { status: 500 }
    )
  }
}

