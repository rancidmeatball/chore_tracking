import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const checkDate = dateParam ? new Date(dateParam) : new Date()

    const start = startOfDay(checkDate)
    const end = endOfDay(checkDate)

    const tasks = await prisma.task.findMany({
      where: {
        dueDate: {
          gte: start,
          lte: end,
        },
      },
    })

    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t) => t.completed).length
    const allComplete = totalTasks > 0 && completedTasks === totalTasks

    return NextResponse.json({
      date: checkDate.toISOString(),
      totalTasks,
      completedTasks,
      allComplete,
    })
  } catch (error) {
    console.error('Error checking daily completion:', error)
    return NextResponse.json(
      { error: 'Failed to check daily completion' },
      { status: 500 }
    )
  }
}

