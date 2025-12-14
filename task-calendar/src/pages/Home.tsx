import { useState, useEffect } from 'react'
import Calendar from '@/components/Calendar'
import TaskForm from '@/components/TaskForm'
import RecurrenceTemplateManager from '@/components/RecurrenceTemplateManager'
import ChildManager from '@/components/ChildManager'
import TimeTracker from '@/components/TimeTracker'
import SettingsMenu from '@/components/SettingsMenu'
import CompletionTracker from '@/components/CompletionTracker'
import { Task, Child, RecurrenceTemplate } from '@/types'

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
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      })
      if (response.ok) {
        await fetchTasks()
        await fetchChildren() // Refresh children to get updated time balance
        
        // Check if all tasks for the day are complete
        const completionResponse = await fetch('/api/tasks/check-daily-completion')
        if (completionResponse.ok) {
          const data = await completionResponse.json()
          
          // Check for tech time rewards
          if (data.techTimeRewards && data.techTimeRewards.length > 0) {
            for (const reward of data.techTimeRewards) {
              if (!reward.awarded) {
                // Award tech time for this child
                const awardResponse = await fetch('/api/tasks/award-tech-time', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    childId: reward.childId,
                    date: new Date().toISOString(),
                  }),
                })
                
                if (awardResponse.ok) {
                  const awardData = await awardResponse.json()
                  alert(`🎉 ${reward.childName} completed both categories! Awarded 1 hour of tech time!`)
                  await fetchChildren() // Refresh to show new balance
                }
              }
            }
          }
          
          // Trigger Home Assistant input booleans for children who completed all their tasks
          if (data.childCompletions && data.childCompletions.length > 0) {
            for (const childCompletion of data.childCompletions) {
              if (childCompletion.allComplete && childCompletion.inputBoolean) {
                // Trigger child-specific input boolean
                await fetch('/api/home-assistant/trigger-child', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    inputBoolean: childCompletion.inputBoolean,
                    date: new Date().toISOString() 
                  }),
                })
              }
            }
          }
          
          // Trigger Home Assistant if all tasks complete (global)
          if (data.allComplete) {
            await fetch('/api/home-assistant/trigger', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: new Date().toISOString() }),
            })
          }
        }
      }
    } catch (error) {
      console.error('Error updating task:', error)
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

  const handleTaskSaved = () => {
    fetchTasks()
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
