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

    // If there's a recurrence template, generate multiple tasks
    if (recurrenceTemplateId) {
      const template = await prisma.recurrenceTemplate.findUnique({
        where: { id: recurrenceTemplateId },
      })

      if (!template) {
        return NextResponse.json(
          { error: 'Recurrence template not found' },
          { status: 404 }
        )
      }

      const tasks = []
      // For recurring tasks, start from today (not the dueDate which might be far future)
      const startDate = new Date()
      startDate.setHours(0, 0, 0, 0) // Start of today
      const endDate = new Date(startDate)
      endDate.setFullYear(endDate.getFullYear() + 1) // Generate tasks for 1 year

      if (template.frequency === 'weekly' && template.daysOfWeek) {
        const daysOfWeek = JSON.parse(template.daysOfWeek) as number[]
        let currentDate = new Date(startDate)
        
        // Generate tasks for each matching day of week for 1 year
        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay()
          if (daysOfWeek.includes(dayOfWeek)) {
            // Normalize date to midnight to avoid timezone issues
            const taskDate = new Date(currentDate)
            taskDate.setHours(0, 0, 0, 0)
            tasks.push({
              title,
              description: description || null,
              dueDate: taskDate,
              childId,
              recurrenceTemplateId,
            })
          }
          currentDate.setDate(currentDate.getDate() + 1)
        }
      } else if (template.frequency === 'monthly' && template.dayOfMonth) {
        // Start from today, find the next occurrence of the day of month
        let currentDate = new Date(startDate)
        const today = currentDate.getDate()
        
        // If we haven't passed the day this month, use this month
        if (today <= template.dayOfMonth) {
          currentDate.setDate(template.dayOfMonth)
        } else {
          // Otherwise, start next month
          currentDate.setMonth(currentDate.getMonth() + 1)
          currentDate.setDate(template.dayOfMonth)
        }
        
        // Generate tasks for 12 months
        for (let i = 0; i < 12 && currentDate <= endDate; i++) {
          // Ensure the date is valid (e.g., Feb 31 becomes Feb 28/29)
          const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
          const dayToUse = Math.min(template.dayOfMonth, lastDayOfMonth)
          const taskDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayToUse)
          
          if (taskDate >= startDate && taskDate <= endDate) {
            // Normalize date to midnight to avoid timezone issues
            taskDate.setHours(0, 0, 0, 0)
            tasks.push({
              title,
              description: description || null,
              dueDate: taskDate,
              childId,
              recurrenceTemplateId,
            })
          }
          
          // Move to next month
          currentDate.setMonth(currentDate.getMonth() + 1)
          currentDate.setDate(dayToUse)
        }
      } else {
        // One-time task - normalize to midnight
        const oneTimeDate = new Date(dueDate)
        oneTimeDate.setHours(0, 0, 0, 0)
        tasks.push({
          title,
          description: description || null,
          dueDate: oneTimeDate,
          childId,
          recurrenceTemplateId,
        })
      }

      // Only create tasks if we have any
      if (tasks.length === 0) {
        return NextResponse.json(
          { error: 'No tasks generated from recurrence template' },
          { status: 400 }
        )
      }

      const createdTasks = await prisma.task.createMany({
        data: tasks,
      })

      console.log(`Created ${createdTasks.count} recurring tasks from template ${recurrenceTemplateId}`)

      // Fetch the created tasks with relations - use a longer time window to ensure we get them
      const taskIds = await prisma.task.findMany({
        where: {
          childId,
          recurrenceTemplateId,
          title,
          createdAt: {
            gte: new Date(Date.now() - 5000), // Created in the last 5 seconds
          },
        },
        include: {
          child: true,
          recurrenceTemplate: true,
        },
        orderBy: {
          dueDate: 'asc',
        },
      })

      return NextResponse.json(taskIds, { status: 201 })
    } else {
      // No recurrence template - create single task
      const task = await prisma.task.create({
        data: {
          title,
          description: description || null,
          dueDate: new Date(dueDate),
          childId,
          recurrenceTemplateId: null,
        },
        include: {
          child: true,
          recurrenceTemplate: true,
        },
      })

      return NextResponse.json(task, { status: 201 })
    }
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    )
  }
}

