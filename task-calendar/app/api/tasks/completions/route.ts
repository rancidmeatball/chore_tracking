import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, subDays } from 'date-fns'

/**
 * Get completion statistics and history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const childId = searchParams.get('childId')
    const startDate = subDays(new Date(), days)

    // Build where clause
    const where: any = {
      completed: true,
      completedAt: {
        gte: startDate,
      },
    }

    if (childId) {
      where.childId = childId
    }

    // Get completed tasks
    const completedTasks = await prisma.task.findMany({
      where,
      include: {
        child: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
    })

    // Calculate statistics
    const totalCompleted = completedTasks.length
    const onTimeCount = completedTasks.filter(task => {
      if (!task.completedAt) return false
      return new Date(task.completedAt) <= new Date(task.dueDate)
    }).length
    const lateCount = totalCompleted - onTimeCount

    // Group by child
    const byChild = completedTasks.reduce((acc, task) => {
      const childName = task.child.name
      if (!acc[childName]) {
        acc[childName] = {
          childId: task.child.id,
          childName,
          childColor: task.child.color,
          count: 0,
          onTime: 0,
          late: 0,
        }
      }
      acc[childName].count++
      if (task.completedAt && new Date(task.completedAt) <= new Date(task.dueDate)) {
        acc[childName].onTime++
      } else {
        acc[childName].late++
      }
      return acc
    }, {} as Record<string, { childId: string; childName: string; childColor: string | null; count: number; onTime: number; late: number }>)

    // Group by date
    const byDate = completedTasks.reduce((acc, task) => {
      if (!task.completedAt) return acc
      const dateKey = new Date(task.completedAt).toISOString().split('T')[0]
      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push({
        id: task.id,
        title: task.title,
        childName: task.child.name,
        completedAt: task.completedAt,
        dueDate: task.dueDate,
        isOnTime: new Date(task.completedAt) <= new Date(task.dueDate),
      })
      return acc
    }, {} as Record<string, any[]>)

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        days,
      },
      statistics: {
        totalCompleted,
        onTimeCount,
        lateCount,
        onTimePercentage: totalCompleted > 0 ? Math.round((onTimeCount / totalCompleted) * 100) : 0,
      },
      byChild: Object.values(byChild),
      byDate,
      recentCompletions: completedTasks.slice(0, 20), // Last 20 completions
    })
  } catch (error) {
    console.error('Error fetching completion statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch completion statistics' },
      { status: 500 }
    )
  }
}

