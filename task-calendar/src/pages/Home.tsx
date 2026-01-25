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

    // Normalize the task's due date to UTC date-only (midday) for consistent date handling
    // This matches how tasks are stored in the database (midday UTC)
    const taskDate = new Date(targetTask.dueDate)
    const year = taskDate.getUTCFullYear()
    const month = taskDate.getUTCMonth()
    const day = taskDate.getUTCDate()
    // Create a date at UTC midday (12:00 UTC) to represent "this calendar day"
    const utcMidday = new Date(Date.UTC(year, month, day, 12, 0, 0, 0))
    const taskDateIso = utcMidday.toISOString()

    console.log(`[COMPLETION] Toggling task ${taskId} (${targetTask.title}) to ${completed}`)
    console.log(`[COMPLETION] Task dueDate from DB: ${targetTask.dueDate}`)
    console.log(`[COMPLETION] Normalized date for check: ${taskDateIso} (UTC midday)`)

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

      // If the task was just marked incomplete, check if we need to revoke tech time
      // Only revoke if the child no longer has both categories complete
      if (!completed) {
        console.log('[COMPLETION] ===== TASK UNCOMPLETED =====')
        console.log('[COMPLETION] ⚠️⚠️⚠️ TASK UNCOMPLETED - CHECKING FOR REVOKE ⚠️⚠️⚠️')
        console.log('[COMPLETION] Task uncompleted, checking if tech time should be revoked')
        console.log('[COMPLETION] childId:', targetTask.childId)
        console.log('[COMPLETION] date:', taskDateIso)
        console.log('[COMPLETION] targetTask:', JSON.stringify({ id: targetTask.id, title: targetTask.title, childId: targetTask.childId, dueDate: targetTask.dueDate }))
        
        // Refresh tasks first to get current state
        await fetchTasks()
        
        // Check if child still has both categories complete after unchecking
        console.log(`[COMPLETION] taskDateIso for revoke check: ${taskDateIso} (type: ${typeof taskDateIso})`)
        
        // Ensure taskDateIso is a valid string
        if (!taskDateIso || taskDateIso === 'undefined' || taskDateIso === 'null') {
          console.error(`[COMPLETION] ERROR: Invalid taskDateIso for revoke: ${taskDateIso}`)
          return
        }
        
        // Use URLSearchParams to ensure proper encoding
        // IMPORTANT: Use relative URL to avoid CORS issues, but ensure query string is included
        const url = new URL('/api/tasks/check-daily-completion', window.location.origin)
        url.searchParams.set('date', taskDateIso)
        // Add timestamp to prevent caching
        url.searchParams.set('_t', Date.now().toString())
        // Use only the pathname + search to ensure query string is preserved
        const completionUrl = url.pathname + url.search
        
        console.log(`[COMPLETION] ===== FETCHING REVOKE CHECK =====`)
        console.log(`[COMPLETION] taskDateIso: ${taskDateIso}`)
        console.log(`[COMPLETION] Full URL: ${completionUrl}`)
        console.log(`[COMPLETION] URL search params: ${url.searchParams.toString()}`)
        console.log(`[COMPLETION] URL.search: ${url.search}`)
        console.log(`[COMPLETION] URL.href: ${url.href}`)
        
        const completionResponse = await fetch(completionUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
          cache: 'no-store', // Prevent caching
        })
        console.log(`[COMPLETION] Revoke check response status: ${completionResponse.status}`)
        if (completionResponse.ok) {
          const data = await completionResponse.json()
          console.log('[COMPLETION] Daily completion check after uncheck:', data)
          console.log('[COMPLETION] categoryBreakdown:', JSON.stringify(data.categoryBreakdown, null, 2))
          
          // Find this child in the category breakdown
          const childBreakdown = data.categoryBreakdown?.find((cb: any) => cb.childId === targetTask.childId)
          console.log('[COMPLETION] Found childBreakdown:', childBreakdown)
          const stillHasBothComplete = childBreakdown?.bothComplete === true
          
          console.log('[COMPLETION] Child still has both categories complete:', stillHasBothComplete)
          console.log('[COMPLETION] categoryBreakdown length:', data.categoryBreakdown?.length || 0)
          console.log('[COMPLETION] All categoryBreakdown children:', data.categoryBreakdown?.map((cb: any) => ({ childId: cb.childId, childName: cb.childName, bothComplete: cb.bothComplete })))
          
          // Only revoke if they no longer have both categories complete
          // Also check if childBreakdown exists - if not, they might have no tasks left, but we should still try to revoke if an award exists
          if (!stillHasBothComplete || !childBreakdown) {
            // Use the date from the response (same as award logic)
            const revokeDate = data.date || taskDateIso
            console.log(`[COMPLETION] ===== ATTEMPTING TO REVOKE =====`)
            console.log(`[COMPLETION] stillHasBothComplete: ${stillHasBothComplete}, childBreakdown exists: ${!!childBreakdown}`)
            console.log(`[COMPLETION] Using revoke date: ${revokeDate} (from response: ${!!data.date}, from taskDateIso: ${!data.date})`)
            
            try {
              console.log('[COMPLETION] ===== CALLING REVOKE ENDPOINT =====')
              console.log('[COMPLETION] Calling /api/tasks/revoke-tech-time...')
              console.log('[COMPLETION] Request body:', { childId: targetTask.childId, date: revokeDate })
              const revokeResponse = await fetch('/api/tasks/revoke-tech-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  childId: targetTask.childId,
                  date: revokeDate,
                }),
              })

              console.log('[COMPLETION] Revoke response status:', revokeResponse.status, revokeResponse.ok)
              if (revokeResponse.ok) {
                const revokeData = await revokeResponse.json()
                console.log('[COMPLETION] ✅ Tech time revoked successfully:', revokeData)
                // Refresh children to get updated balance
                await fetchChildren()
                alert(`⏰ Tech time revoked from ${revokeData.childName || 'child'}. New balance: ${Math.round(revokeData.newBalance / 60 * 10) / 10} hours`)
              } else {
                const revokeError = await revokeResponse.json().catch(() => ({ error: 'Unknown error' }))
                // It's okay if there's nothing to revoke; just log it.
                console.log('[COMPLETION] ⚠️ No tech time to revoke or revoke failed:', revokeError)
              }
            } catch (revokeErr) {
              console.error('[COMPLETION] ❌ Error revoking tech time:', revokeErr)
            }

            // Also turn OFF the child's input_boolean if configured
            const child = children.find((c) => c.id === targetTask.childId)
            if (child?.inputBoolean) {
              try {
                const resetResponse = await fetch('/api/home-assistant/reset-child', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    inputBoolean: child.inputBoolean,
                    date: taskDateIso,
                  }),
                })
                if (!resetResponse.ok) {
                  const resetError = await resetResponse.json().catch(() => ({ error: 'Unknown error' }))
                  console.error('[COMPLETION] Error turning OFF child input boolean:', resetError)
                }
              } catch (resetErr) {
                console.error('[COMPLETION] Error calling reset-child for Home Assistant:', resetErr)
              }
            }
          } else {
            console.log('[COMPLETION] Child still has both categories complete, no revocation needed')
          }
        }
        
        // Refresh after revoke attempt
        await fetchChildren()
        await fetchTasks() // Refresh tasks to update calendar
        // Force calendar re-render
        setSelectedDate(new Date(selectedDate))
        return
      }
      
      // From here on, we're in the \"completed\" path.
      // Wait for the update to complete, then refresh tasks/children
      await fetchTasks()
      await fetchChildren() // Refresh children to get updated time balance
      // Check if all tasks for the relevant day are complete
      console.log(`[COMPLETION] Checking daily completion for date: ${taskDateIso}`)
      console.log(`[COMPLETION] taskDateIso type: ${typeof taskDateIso}, value: ${taskDateIso}`)
      
      // Ensure taskDateIso is a valid string
      if (!taskDateIso || taskDateIso === 'undefined' || taskDateIso === 'null') {
        console.error(`[COMPLETION] ERROR: Invalid taskDateIso: ${taskDateIso}`)
        return
      }
      
      // Use URLSearchParams to ensure proper encoding
      // IMPORTANT: Use relative URL to avoid CORS issues, but ensure query string is included
      const url = new URL('/api/tasks/check-daily-completion', window.location.origin)
      url.searchParams.set('date', taskDateIso)
      // Add timestamp to prevent caching
      url.searchParams.set('_t', Date.now().toString())
      // Use only the pathname + search to ensure query string is preserved
      const completionUrl = url.pathname + url.search
      
      console.log(`[COMPLETION] ===== FETCHING CHECK-DAILY-COMPLETION =====`)
      console.log(`[COMPLETION] taskDateIso: ${taskDateIso}`)
      console.log(`[COMPLETION] Full URL: ${completionUrl}`)
      console.log(`[COMPLETION] URL search params: ${url.searchParams.toString()}`)
      console.log(`[COMPLETION] URL.search: ${url.search}`)
      console.log(`[COMPLETION] URL.href: ${url.href}`)
      
      // Use the full URL to ensure query params are sent
      const completionResponse = await fetch(completionUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store', // Prevent caching
      })
      console.log(`[COMPLETION] Response status: ${completionResponse.status}`)
      
      if (completionResponse.ok) {
        const data = await completionResponse.json()
        console.log('[COMPLETION] Daily completion data:', data)
        console.log(`[COMPLETION] Response date field: ${data.date} (type: ${typeof data.date})`)
        console.log(`[COMPLETION] taskDateIso: ${taskDateIso} (type: ${typeof taskDateIso})`)
        
        // Use the date from the response (which is the actual date checked), not taskDateIso
        // This ensures we use the correct date even if the query parameter wasn't passed
        // The response date is the date that was actually checked (using fallback if needed)
        // IMPORTANT: Always use data.date if available, as it's the date that was actually checked
        let awardDate: string | undefined = undefined
        
        if (data && typeof data === 'object' && 'date' in data && typeof data.date === 'string') {
          awardDate = data.date
          console.log(`[COMPLETION] ✅ Using date from response: ${awardDate}`)
        } else {
          console.error(`[COMPLETION] ❌ ERROR: data.date is missing or invalid!`)
          console.error(`[COMPLETION] data object:`, JSON.stringify(data, null, 2))
          console.error(`[COMPLETION] data.date value:`, data.date)
          console.error(`[COMPLETION] data.date type:`, typeof data.date)
          console.warn(`[COMPLETION] ⚠️ WARNING: Falling back to taskDateIso: ${taskDateIso}`)
          awardDate = taskDateIso
        }
        
        console.log(`[COMPLETION] Final award date: ${awardDate}`)
        console.log(`[COMPLETION] Award date type: ${typeof awardDate}, value: ${awardDate}`)
        
        // Check for tech time rewards
        if (data.techTimeRewards && data.techTimeRewards.length > 0) {
          for (const reward of data.techTimeRewards) {
            // Only award if not already awarded
            if (!reward.awarded) {
              // Use the date from the reward object (which comes from the backend)
              // This is the most reliable source since it's the date that was actually checked
              let rewardDate: string | undefined = undefined
              
              if (reward.date && typeof reward.date === 'string') {
                rewardDate = reward.date
                console.log(`[COMPLETION] ✅ Using reward.date: ${rewardDate}`)
              } else if (data.date && typeof data.date === 'string') {
                rewardDate = data.date
                console.warn(`[COMPLETION] ⚠️ reward.date missing, using data.date: ${rewardDate}`)
              } else {
                console.error(`[COMPLETION] ❌ ERROR: No valid date found! reward.date=${reward.date}, data.date=${data.date}`)
                console.error(`[COMPLETION] Full reward object:`, JSON.stringify(reward, null, 2))
                console.error(`[COMPLETION] Full data object:`, JSON.stringify(data, null, 2))
                alert(`Error: Could not determine date for tech time award. Please check console for details.`)
                continue // Skip this reward
              }
              
              console.log(`[COMPLETION] ===== CALLING AWARD ENDPOINT =====`)
              console.log(`[COMPLETION] Awarding tech time to ${reward.childName} for date ${rewardDate}`)
              
              // Double-check the date before sending
              const requestBody = { 
                childId: reward.childId,
                date: rewardDate,
              }
              console.log(`[COMPLETION] Request body (before JSON.stringify):`, requestBody)
              console.log(`[COMPLETION] Request body (after JSON.stringify):`, JSON.stringify(requestBody))
              
              const awardResponse = await fetch('/api/tasks/award-tech-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
              })
              
              if (awardResponse.ok) {
                const awardData = await awardResponse.json()
                console.log('[COMPLETION] Tech time awarded:', awardData)
                alert(`🎉 ${reward.childName} completed both categories! Awarded 1 hour of tech time!`)
                await fetchChildren() // Refresh to show new balance
                await fetchTasks() // Refresh tasks to update calendar stars
                // Force calendar re-render by updating selected date
                setSelectedDate(new Date(selectedDate))
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
      
      // Prevent double deletion
      const response = await fetch(url, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        if (result.deletedCount && result.deletedCount > 1) {
          console.log(`Deleted ${result.deletedCount} tasks from series`)
        }
        // Refresh tasks and children to update UI
        await fetchTasks()
        await fetchChildren()
      } else {
        const error = await response.json()
        // Don't show error if task was already deleted
        if (error.error !== 'Task not found' && !error.message?.includes('already deleted')) {
          alert(`Error: ${error.error || 'Failed to delete task'}`)
        }
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      // Don't show alert on network errors if task might be deleted
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

        <Calendar
          tasks={tasks}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onTaskComplete={handleTaskComplete}
          onTaskEdit={handleEditTask}
          onTaskDelete={handleTaskDelete}
          children={children}
        />

        <TimeTracker childrenList={children} onTimeUpdated={fetchChildren} />

        <CompletionTracker key={`completion-${tasks.length}`} childrenList={children} />

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
