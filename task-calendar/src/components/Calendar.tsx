import { useState, useMemo, useRef } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns'
import { Task } from '@/types'

interface CalendarProps {
  tasks: Task[]
  selectedDate: Date
  onDateSelect: (date: Date) => void
  onTaskComplete: (taskId: string, completed: boolean) => void
  onTaskEdit: (task: Task) => void
  onTaskDelete: (taskId: string, deleteSeries?: boolean) => void
}

function Calendar({
  tasks,
  selectedDate,
  onDateSelect,
  onTaskComplete,
  onTaskEdit,
  onTaskDelete,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  // Track last click to handle double-click properly
  const lastClickRef = useRef<{ taskId: string; timestamp: number } | null>(null)

  // Memoize month calculations
  const { daysInMonth, emptyDays, monthYear } = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })
    const firstDay = start.getDay()
    const empty = Array(firstDay).fill(null)
    const monthYearStr = format(currentMonth, 'MMMM yyyy')
    return { daysInMonth: days, emptyDays: empty, monthYear: monthYearStr }
  }, [currentMonth])

  // Simple task lookup map - only recalculate when tasks change
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      // Normalize task date to local midnight to avoid timezone issues
      const taskDate = new Date(task.dueDate)
      // Get the date components in local timezone
      const year = taskDate.getFullYear()
      const month = taskDate.getMonth()
      const day = taskDate.getDate()
      // Create a new date at local midnight (not UTC)
      const localMidnight = new Date(year, month, day, 0, 0, 0, 0)
      const dateKey = format(localMidnight, 'yyyy-MM-dd')
      
      // Debug logging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log(`Task ${task.id}: dueDate=${task.dueDate}, dateKey=${dateKey}, localMidnight=${localMidnight.toISOString()}`)
      }
      
      const existing = map.get(dateKey) || []
      existing.push(task)
      map.set(dateKey, existing)
    }
    console.log('Tasks by date map:', Array.from(map.entries()).map(([key, tasks]) => `${key}: ${tasks.length} tasks`))
    return map
  }, [tasks])

  // Helper to get task color based on child
  const getTaskColor = (task: Task) => {
    if (task.completed) {
      return 'text-green-800'
    }
    // Use child's color if available, otherwise default blue
    const childColor = task.child?.color || '#3B82F6'
    // Convert hex to RGB for better text contrast
    const hex = childColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    // Calculate brightness to determine text color
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    const textColor = brightness > 128 ? 'text-gray-900' : 'text-white'
    return `${textColor}`
  }

  // Helper to get task background color
  const getTaskBgColor = (task: Task) => {
    if (task.completed) {
      return '#86efac' // green-300
    }
    return task.child?.color || '#3B82F6'
  }

  // Simple inline function
  const getTasksForDate = (date: Date) => {
    // Normalize the input date to local midnight for consistent comparison
    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    const localMidnight = new Date(year, month, day, 0, 0, 0, 0)
    const dateKey = format(localMidnight, 'yyyy-MM-dd')
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`getTasksForDate: date=${date.toISOString()}, dateKey=${dateKey}, tasks found=${tasksByDate.get(dateKey)?.length || 0}`)
    }
    
    return tasksByDate.get(dateKey) || []
  }


  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))


  return (
    <div className="bg-white rounded-lg shadow-lg p-2 sm:p-4 md:p-6">
      <div className="flex justify-between items-center mb-3 sm:mb-6 gap-2">
        <button
          onClick={prevMonth}
          className="px-2 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition font-semibold shadow-md text-sm sm:text-base touch-manipulation"
          aria-label="Previous month"
        >
          <span className="hidden sm:inline">← Prev</span>
          <span className="sm:hidden">←</span>
        </button>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 text-center flex-1">
          {monthYear}
        </h2>
        <button
          onClick={nextMonth}
          className="px-2 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition font-semibold shadow-md text-sm sm:text-base touch-manipulation"
          aria-label="Next month"
        >
          <span className="hidden sm:inline">Next →</span>
          <span className="sm:hidden">→</span>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs sm:text-sm font-semibold text-gray-800 py-1 sm:py-2">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.substring(0, 1)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="h-24"></div>
        ))}
        {daysInMonth.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd')
          const dayTasks = getTasksForDate(day)
          const completion = dayTasks.length > 0 ? {
            total: dayTasks.length,
            completed: dayTasks.filter(t => t.completed).length
          } : null
          const isSelected = isSameDay(day, selectedDate)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const dayNumber = day.getDate()

          return (
            <div
              key={dayKey}
              onClick={() => onDateSelect(day)}
              className={`
                h-12 sm:h-16 md:h-24 border-2 rounded-lg p-1 sm:p-2 cursor-pointer transition touch-manipulation
                ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 active:bg-gray-100'}
                ${!isCurrentMonth ? 'opacity-50' : ''}
              `}
            >
              <div className="flex justify-between items-start mb-0.5 sm:mb-1">
                <span className={`text-xs sm:text-sm font-semibold ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                  {dayNumber}
                </span>
                {completion && (
                  <span className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded ${
                    completion.completed === completion.total
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {completion.completed}/{completion.total}
                  </span>
                )}
              </div>
              <div className="space-y-0.5 sm:space-y-1 overflow-y-auto max-h-8 sm:max-h-12 md:max-h-16">
                {dayTasks.slice(0, 3).map((task) => {
                  const bgColor = getTaskBgColor(task)
                  const textColor = getTaskColor(task)
                  
                  return (
                    <div
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        const now = Date.now()
                        const lastClick = lastClickRef.current
                        
                        // Check if this is a double-click (same task, within 300ms)
                        if (lastClick && lastClick.taskId === task.id && (now - lastClick.timestamp) < 300) {
                          // This is a double-click - don't toggle completion
                          lastClickRef.current = null
                          return
                        }
                        
                        // Store this click
                        lastClickRef.current = { taskId: task.id, timestamp: now }
                        
                        // Delay the single-click action to allow for double-click detection
                        setTimeout(() => {
                          // Only execute if this is still the last click (not a double-click)
                          if (lastClickRef.current && lastClickRef.current.taskId === task.id && (Date.now() - lastClickRef.current.timestamp) >= 300) {
                            onTaskComplete(task.id, !task.completed)
                            lastClickRef.current = null
                          }
                        }, 300)
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        // Clear the last click ref to prevent single-click action
                        lastClickRef.current = null
                        // Double-click to edit
                        onTaskEdit(task)
                      }}
                      className={`
                        text-[10px] sm:text-xs p-0.5 sm:p-1 rounded truncate cursor-pointer relative group touch-manipulation
                        ${task.completed ? 'bg-green-200 text-green-800 line-through opacity-75' : ''}
                        hover:opacity-90 active:opacity-80 transition-opacity
                      `}
                      style={task.completed ? {} : { backgroundColor: bgColor, color: textColor.includes('white') ? 'white' : 'rgb(17, 24, 39)' }}
                      title={`${task.title} - Click to ${task.completed ? 'uncomplete' : 'complete'}, double-click to edit`}
                    >
                      <div className="flex items-center gap-1">
                        {task.completed && (
                          <span className="text-green-700 font-bold flex-shrink-0">✓</span>
                        )}
                        <span className="text-[8px] sm:text-[10px] opacity-75 flex-shrink-0">
                          {task.category === 'helping-family' ? '👨‍👩‍👧' : '📚'}
                        </span>
                        <span className={task.completed ? 'line-through' : ''}>{task.title}</span>
                      </div>
                    </div>
                  )
                })}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-gray-700">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected Date Tasks Detail */}
      <div className="mt-3 sm:mt-6 border-t pt-3 sm:pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-4">
          Tasks for {format(selectedDate, 'MMMM d, yyyy')}
        </h3>
        <div className="space-y-2">
          {(() => {
            const selectedDateTasks = getTasksForDate(selectedDate)
            if (selectedDateTasks.length === 0) {
              return <p className="text-gray-700">No tasks for this date</p>
            }
            return selectedDateTasks.map((task) => {
              const bgColor = getTaskBgColor(task)
              return (
              <div
                key={task.id}
                className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg"
                style={task.completed ? {} : { backgroundColor: bgColor + '40', borderLeft: `4px solid ${bgColor}` }}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={(e) => onTaskComplete(task.id, e.target.checked)}
                  className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 rounded touch-manipulation"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">
                      {task.category === 'helping-family' ? '👨‍👩‍👧' : '📚'}
                    </span>
                    <h4 className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {task.title}
                    </h4>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      task.category === 'helping-family' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {task.category === 'helping-family' ? 'Family' : 'Enrichment'}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-700">{task.description}</p>
                  )}
                  {task.child && (
                    <p className="text-xs text-gray-700">Assigned to: {task.child.name}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onTaskEdit(task)}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      // Check if this task is part of a recurring series
                      if (task.recurrenceTemplateId) {
                        const deleteChoice = confirm(
                          `"${task.title}" is part of a recurring series.\n\n` +
                          `Click OK to delete ALL future tasks in this series (starting from this date).\n` +
                          `Click Cancel to delete just this one task.`
                        )
                        // If user clicks OK, delete series. If Cancel, delete just this task.
                        onTaskDelete(task.id, deleteChoice)
                      } else {
                        // Not a recurring task, just confirm deletion
                        if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
                          onTaskDelete(task.id, false)
                        }
                      }
                    }}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )})
          })()}
        </div>
      </div>
    </div>
  )
}

// Export Calendar without memo - let React handle re-renders naturally
export default Calendar
