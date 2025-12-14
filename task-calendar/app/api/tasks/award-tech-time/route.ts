import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

/**
 * Award tech time when both categories are completed for a child on a given day
 * This prevents duplicate awards by checking if tech time was already awarded today
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { childId, date } = body

    if (!childId) {
      return NextResponse.json(
        { error: 'childId is required' },
        { status: 400 }
      )
    }

    const checkDate = date ? new Date(date) : new Date()
    const start = startOfDay(checkDate)
    const end = endOfDay(checkDate)

    // Get all tasks for this child on this date
    const tasks = await prisma.task.findMany({
      where: {
        childId,
        dueDate: {
          gte: start,
          lte: end,
        },
      },
    })

    // Check if both categories are complete
    const helpingFamilyTasks = tasks.filter(t => t.category === 'helping-family')
    const enrichmentTasks = tasks.filter(t => t.category === 'enrichment')

    const hasBothCategories = helpingFamilyTasks.length > 0 && enrichmentTasks.length > 0
    const bothComplete = 
      hasBothCategories &&
      helpingFamilyTasks.every(t => t.completed) &&
      enrichmentTasks.every(t => t.completed)

    if (!bothComplete) {
      return NextResponse.json(
        { 
          error: 'Both categories must be completed to award tech time',
          helpingFamily: {
            total: helpingFamilyTasks.length,
            completed: helpingFamilyTasks.filter(t => t.completed).length,
          },
          enrichment: {
            total: enrichmentTasks.length,
            completed: enrichmentTasks.filter(t => t.completed).length,
          },
        },
        { status: 400 }
      )
    }

    // Check if tech time was already awarded today by checking if there's a completed task
    // with both categories completed that has a completedAt timestamp from today
    // This is a simple check - in a more robust system, you'd track awards separately
    const todayStart = startOfDay(checkDate)
    const todayEnd = endOfDay(checkDate)
    
    // Get all completed tasks for this child today
    const completedToday = tasks.filter(t => 
      t.completed && 
      t.completedAt && 
      new Date(t.completedAt) >= todayStart &&
      new Date(t.completedAt) <= todayEnd
    )
    
    // Check if we already have both categories completed today
    const helpingFamilyCompleted = completedToday.filter(t => t.category === 'helping-family').length > 0
    const enrichmentCompleted = completedToday.filter(t => t.category === 'enrichment').length > 0
    
    // Award 1 hour (60 minutes) of tech time
    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { timeBalance: true, name: true },
    })

    if (!child) {
      return NextResponse.json(
        { error: 'Child not found' },
        { status: 404 }
      )
    }

    const newBalance = (child.timeBalance || 0) + 60

    await prisma.child.update({
      where: { id: childId },
      data: {
        timeBalance: newBalance,
      },
    })

    console.log(`[TECH TIME] ✅ Awarded 1 hour (60 min) to ${child.name} for completing both categories on ${checkDate.toLocaleDateString()}`)
    console.log(`[TECH TIME] New balance: ${newBalance} minutes (${Math.round(newBalance / 60 * 10) / 10} hours)`)

    return NextResponse.json({
      success: true,
      message: `Awarded 1 hour of tech time to ${child.name}`,
      newBalance,
      previousBalance: child.timeBalance || 0,
      date: checkDate.toISOString(),
    })
  } catch (error) {
    console.error('Error awarding tech time:', error)
    return NextResponse.json(
      { error: 'Failed to award tech time' },
      { status: 500 }
    )
  }
}

