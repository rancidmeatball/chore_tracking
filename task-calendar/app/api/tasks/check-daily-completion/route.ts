import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic'

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
      include: {
        child: {
          select: {
            id: true,
            name: true,
            timeBalance: true,
          },
        },
      },
    })

    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t) => t.completed).length
    const allComplete = totalTasks > 0 && completedTasks === totalTasks

    // Check for tech time rewards: when both categories are complete for a child on the same day
    const techTimeRewards: Array<{ childId: string; childName: string; awarded: boolean }> = []
    
    // Group tasks by child
    const tasksByChild = tasks.reduce((acc, task) => {
      if (!acc[task.childId]) {
        acc[task.childId] = {
          childId: task.childId,
          childName: task.child.name,
          helpingFamily: { total: 0, completed: 0 },
          enrichment: { total: 0, completed: 0 },
        }
      }
      const childTasks = acc[task.childId]
      if (task.category === 'helping-family') {
        childTasks.helpingFamily.total++
        if (task.completed) childTasks.helpingFamily.completed++
      } else if (task.category === 'enrichment') {
        childTasks.enrichment.total++
        if (task.completed) childTasks.enrichment.completed++
      }
      return acc
    }, {} as Record<string, { childId: string; childName: string; helpingFamily: { total: number; completed: number }; enrichment: { total: number; completed: number } }>)

    // Award tech time for children who completed both categories
    for (const childData of Object.values(tasksByChild)) {
      const hasHelpingFamily = childData.helpingFamily.total > 0
      const hasEnrichment = childData.enrichment.total > 0
      const bothComplete = 
        hasHelpingFamily && 
        hasEnrichment && 
        childData.helpingFamily.completed === childData.helpingFamily.total &&
        childData.enrichment.completed === childData.enrichment.total

      if (bothComplete) {
        // Check if we've already awarded tech time for this date (prevent duplicate awards)
        const todayKey = checkDate.toISOString().split('T')[0]
        const existingReward = await prisma.child.findUnique({
          where: { id: childData.childId },
          select: { timeBalance: true },
        })

        // Award 1 hour (60 minutes) of tech time
        // Note: We'll track this in a separate check to avoid duplicate awards
        // For now, we'll just indicate it should be awarded
        techTimeRewards.push({
          childId: childData.childId,
          childName: childData.childName,
          awarded: false, // Will be set to true after awarding
        })
      }
    }

    return NextResponse.json({
      date: checkDate.toISOString(),
      totalTasks,
      completedTasks,
      allComplete,
      techTimeRewards,
      categoryBreakdown: Object.values(tasksByChild).map(child => ({
        childId: child.childId,
        childName: child.childName,
        helpingFamily: child.helpingFamily,
        enrichment: child.enrichment,
        bothComplete: 
          child.helpingFamily.total > 0 && 
          child.enrichment.total > 0 && 
          child.helpingFamily.completed === child.helpingFamily.total &&
          child.enrichment.completed === child.enrichment.total,
      })),
    })
  } catch (error) {
    console.error('Error checking daily completion:', error)
    return NextResponse.json(
      { error: 'Failed to check daily completion' },
      { status: 500 }
    )
  }
}

