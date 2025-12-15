import { useState, useEffect } from 'react'
import Calendar from '@/components/Calendar'
import TaskForm from '@/components/TaskForm'
import RecurrenceTemplateManager from '@/components/RecurrenceTemplateManager'
import ChildManager from '@/components/ChildManager'
import TimeTracker from '@/components/TimeTracker'
import SettingsMenu from '@/components/SettingsMenu'
import CompletionTracker from '@/components/CompletionTracker'
import { Task, Child } from '@/types'

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showRecurrenceManager, setShowRecurrenceManager] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks()
    fetchChildren()
  }, [])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/tasks')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      const data = await response.json()
      setTasks(data)
      setLoading(false)
    } catch (error: any) {
      console.error('Error fetching tasks:', error)
      setError(`Failed to load tasks: ${error.message || error}`)
      setLoading(false)
    }
  }

  const fetchChildren = async () => {
    try {
      const response = await fetch('/api/children')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      const data = await response.json()
      setChildren(data)
    } catch (error: any) {
      console.error('Error fetching children:', error)
      setError(`Failed to load children: ${error.message || error}`)
    }
  }

  const handleTaskComplete = async (taskId: string, completed: boolean) => {
    // Capture the task context (date/child) so we can award/revoke for the correct day
    const targetTask = tasks.find((t) => t.id === taskId)
    if (!targetTask) {
      console.error('Task not found:', taskId)
      return
    }

    // Normalize the task's due date to local midnight for consistent date handling
    const taskDate = new Date(targetTask.dueDate)
    const year = taskDate.getFullYear()
    const month = taskDate.getMonth()
    const day = taskDate.getDate()
    const localMidnight = new Date(year, month, day, 0, 0, 0, 0)
    const taskDateIso = localMidnight.toISOString()

    console.log(`[COMPLETION] Toggling task ${taskId} to ${completed}, date: ${taskDateIso}`)

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to update task:', errorData)
        alert(`Failed to update task: ${errorData.error || 'Unknown error'}`)
        return
      }

      // Wait for the update to complete, then refresh tasks/children
      await fetchTasks()
      await fetchChildren() // Refresh children to get updated time balance
      
      // Small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 100))

      // If the task was just marked incomplete, attempt to revoke any tech time for that child/date
      if (!completed) {
        console.log('[COMPLETION] Task uncompleted, attempting to revoke tech time if previously awarded')
        try {
          const revokeResponse = await fetch('/api/tasks/revoke-tech-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              childId: targetTask.childId,
              date: taskDateIso,
            }),
          })

          if (revokeResponse.ok) {
            const revokeData = await revokeResponse.json()
            console.log('[COMPLETION] Tech time revoked:', revokeData)
            await fetchChildren()
          } else {
            const revokeError = await revokeResponse.json().catch(() => ({ error: 'Unknown error' }))
            // It's okay if there's nothing to revoke; just log it.
            console.log('[COMPLETION] No tech time to revoke or revoke failed:', revokeError)
          }
        } catch (revokeErr) {
          console.error('[COMPLETION] Error revoking tech time:', revokeErr)
        }
        return
      }
      
      // From here on, we're in the \"completed\" path.
      // Check if all tasks for the relevant day are complete
      console.log(`[COMPLETION] Checking daily completion for date: ${taskDateIso}`)
      const completionResponse = await fetch(`/api/tasks/check-daily-completion?date=${encodeURIComponent(taskDateIso)}`)
      
      if (completionResponse.ok) {
        const data = await completionResponse.json()
        console.log('[COMPLETION] Daily completion data:', data)
        
        // Check for tech time rewards
        if (data.techTimeRewards && data.techTimeRewards.length > 0) {
          for (const reward of data.techTimeRewards) {
            // Only award if not already awarded
            if (!reward.awarded) {
              console.log(`[COMPLETION] Awarding tech time to ${reward.childName} for date ${taskDateIso}`)
              const awardResponse = await fetch('/api/tasks/award-tech-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  childId: reward.childId,
                  date: taskDateIso,
                }),
              })
              
              if (awardResponse.ok) {
                const awardData = await awardResponse.json()
                console.log('[COMPLETION] Tech time awarded:', awardData)
                alert(`🎉 ${reward.childName} completed both categories! Awarded 1 hour of tech time!`)
                await fetchChildren() // Refresh to show new balance
              } else {
                const errorData = await awardResponse.json().catch(() => ({ error: 'Unknown error' }))
                console.error('[COMPLETION] Error awarding tech time:', errorData)
                // Only show error if it's not \"already awarded\"
                if (!errorData.error?.includes('already awarded')) {
                  alert(`Error awarding tech time: ${errorData.error || 'Unknown error'}`)
                }
              }
            } else {
              console.log(`[COMPLETION] Tech time already awarded to ${reward.childName} for this date`)
            }
          }
        }
        
        // Trigger Home Assistant input booleans for children who completed all their tasks
        if (data.childCompletions && data.childCompletions.length > 0) {
          for (const childCompletion of data.childCompletions) {
            if (childCompletion.allComplete && childCompletion.inputBoolean) {
              console.log(`[COMPLETION] Triggering input boolean ${childCompletion.inputBoolean} for ${childCompletion.childName}`)
              const triggerResponse = await fetch('/api/home-assistant/trigger-child', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  inputBoolean: childCompletion.inputBoolean,
                  date: taskDateIso, 
                }),
              })
              
              if (triggerResponse.ok) {
                console.log(`[COMPLETION] Successfully triggered ${childCompletion.inputBoolean}`)
              } else {
                const errorData = await triggerResponse.json().catch(() => ({ error: 'Unknown error' }))
                console.error('[COMPLETION] Error triggering input boolean:', errorData)
              }
            }
          }
        }
        
        // Trigger Home Assistant if all tasks complete (global)
        if (data.allComplete) {
          console.log('[COMPLETION] All tasks complete, triggering global input boolean')
          await fetch('/api/home-assistant/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: taskDateIso }),
          })
        }
      } else {
        const errorData = await completionResponse.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[COMPLETION] Error checking daily completion:', errorData)
      }
    } catch (error) {
      console.error('[COMPLETION] Error updating task:', error)
      alert(`Error updating task: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleTaskDelete = async (taskId: string, deleteSeries: boolean = false) => {
    try {
      const url = deleteSeries 
        ? `/api/tasks/${taskId}?deleteSeries=true`
        : `/api/tasks/${taskId}`
      
      const response = await fetch(url, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        if (result.deletedCount && result.deletedCount > 1) {
          console.log(`Deleted ${result.deletedCount} tasks from series`)
        }
        await fetchTasks()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to delete task'}`)
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }

  const handleTaskSaved = async () => {
    // Force a full refresh of tasks to ensure calendar updates
    await fetchTasks()
    await fetchChildren() // Also refresh children in case time balance changed
    setShowTaskForm(false)
    setSelectedTask(null)
  }

  const handleEditTask = (task: Task) => {
    setSelectedTask(task)
    setShowTaskForm(true)
  }

  const handleCacheCleared = () => {
    // Refresh data after cache is cleared
    fetchTasks()
    fetchChildren()
  }

  return (
    <main className="min-h-screen p-2 sm:p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Task Calendar
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Track chores and tasks for your children
            </p>
          </div>
          <SettingsMenu 
            childrenList={children || []} 
            onChildUpdated={fetchChildren}
            onCacheCleared={handleCacheCleared} 
          />
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <p className="font-bold">Error:</p>
            <p>{error}</p>
            <button
              onClick={() => {
                setError(null)
                fetchTasks()
                fetchChildren()
              }}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="mb-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded">
            Loading...
          </div>
        )}

        <ChildManager childrenList={children} onChildAdded={fetchChildren} />

        <TimeTracker childrenList={children} onTimeUpdated={fetchChildren} />

        <CompletionTracker childrenList={children} />

        <div className="mb-6 flex gap-4">
          <button
            onClick={() => {
              setSelectedTask(null)
              setShowTaskForm(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Add New Task
          </button>
          <button
            onClick={() => setShowRecurrenceManager(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Manage Recurrence Templates
          </button>
        </div>

        <Calendar
          tasks={tasks}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onTaskComplete={handleTaskComplete}
          onTaskEdit={handleEditTask}
          onTaskDelete={handleTaskDelete}
          children={children}
        />

        {showTaskForm && (
          <TaskForm
            task={selectedTask}
            childrenList={children}
            onSave={handleTaskSaved}
            onCancel={() => {
              setShowTaskForm(false)
              setSelectedTask(null)
            }}
            onDelete={handleTaskDelete}
          />
        )}

        {showRecurrenceManager && (
          <RecurrenceTemplateManager
            onClose={() => setShowRecurrenceManager(false)}
            childrenList={children}
          />
        )}
      </div>
    </main>
  )
}
