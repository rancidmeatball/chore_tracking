'use client'

import { useState, useMemo, memo, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns'
import { Task } from '@/types'

interface CalendarProps {
  tasks: Task[]
  selectedDate: Date
  onDateSelect: (date: Date) => void
  onTaskComplete: (taskId: string, completed: boolean) => void
  onTaskEdit: (task: Task) => void
  onTaskDelete: (taskId: string) => void
}

function Calendar({
  tasks,
  selectedDate,
  onDateSelect,
  onTaskComplete,
  onTaskEdit,
  onTaskDelete,
}: CalendarProps) {
  // Memoize initial date to prevent unnecessary re-renders
  const [currentMonth, setCurrentMonth] = useState(() => new Date())

  // Memoize month calculations
  const { monthStart, monthEnd, daysInMonth, firstDayOfWeek, emptyDays, monthYear } = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })
    const firstDay = start.getDay()
    const empty = Array(firstDay).fill(null)
    const monthYearStr = format(currentMonth, 'MMMM yyyy')
    return { monthStart: start, monthEnd: end, daysInMonth: days, firstDayOfWeek: firstDay, emptyDays: empty, monthYear: monthYearStr }
  }, [currentMonth])

  // Memoize task lookup map with completion status - only recalculate when tasks change
  const tasksByDate = useMemo(() => {
    const map = new Map<string, { tasks: Task[], completion: { total: number, completed: number } | null }>()
    for (const task of tasks) {
      const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd')
      const existing = map.get(dateKey)
      if (existing) {
        existing.tasks.push(task)
        existing.completion = {
          total: existing.tasks.length,
          completed: existing.tasks.filter(t => t.completed).length
        }
      } else {
        map.set(dateKey, {
          tasks: [task],
          completion: {
            total: 1,
            completed: task.completed ? 1 : 0
          }
        })
      }
    }
    return map
  }, [tasks])

  // Simple inline functions - no callback overhead
  const getTasksForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    return tasksByDate.get(dateKey)?.tasks || []
  }
  
  const getCompletionForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    return tasksByDate.get(dateKey)?.completion || null
  }


  const prevMonth = useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1))
  }, [])
  
  const nextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1))
  }, [])


  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={prevMonth}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-md"
          aria-label="Previous month"
        >
          ← Prev
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          {monthYear}
        </h2>
        <button
          onClick={nextMonth}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-md"
          aria-label="Next month"
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center font-semibold text-gray-800 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="h-24"></div>
        ))}
        {daysInMonth.map((day) => {
          // Pre-compute all values once per day - use cached values
          const dayKey = format(day, 'yyyy-MM-dd')
          const dayTasks = getTasksForDate(day)
          const completion = getCompletionForDate(day)
          const isSelected = isSameDay(day, selectedDate)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const dayNumber = day.getDate() // Cache day number

          return (
            <div
              key={dayKey}
              onClick={() => onDateSelect(day)}
              className={`
                h-24 border-2 rounded-lg p-2 cursor-pointer transition
                ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                ${!isCurrentMonth ? 'opacity-50' : ''}
              `}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-semibold ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                  {dayNumber}
                </span>
                {completion && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    completion.completed === completion.total
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {completion.completed}/{completion.total}
                  </span>
                )}
              </div>
              <div className="space-y-1 overflow-y-auto max-h-16">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskEdit(task)
                    }}
                    className={`
                      text-xs p-1 rounded truncate cursor-pointer
                      ${task.completed ? 'bg-green-200 text-green-800 line-through' : 'bg-blue-100 text-blue-800'}
                    `}
                    title={task.title}
                  >
                    {task.title}
                  </div>
                ))}
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
      {useMemo(() => {
        const selectedDateTasks = getTasksForDate(selectedDate)
        const selectedDateFormatted = format(selectedDate, 'MMMM d, yyyy')
        
        return (
          <div className="mt-6 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tasks for {selectedDateFormatted}
            </h3>
            <div className="space-y-2">
              {selectedDateTasks.length === 0 ? (
                <p className="text-gray-700">No tasks for this date</p>
              ) : (
                selectedDateTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={(e) => onTaskComplete(task.id, e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <h4 className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {task.title}
                  </h4>
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
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
                        onTaskDelete(task.id)
                      }
                    }}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
                ))
              )}
            </div>
          </div>
        )
      }, [selectedDate, tasksByDate])}
    </div>
  )
}

// Memoize the Calendar component with custom comparison
// Only re-render if tasks, selectedDate, or callbacks actually change
export default memo(Calendar, (prevProps, nextProps) => {
  // Quick reference check first
  if (prevProps.tasks === nextProps.tasks && 
      prevProps.selectedDate === nextProps.selectedDate &&
      prevProps.onDateSelect === nextProps.onDateSelect &&
      prevProps.onTaskComplete === nextProps.onTaskComplete &&
      prevProps.onTaskEdit === nextProps.onTaskEdit &&
      prevProps.onTaskDelete === nextProps.onTaskDelete) {
    return true // Skip re-render
  }
  
  // Check selectedDate by time value
  if (prevProps.selectedDate.getTime() !== nextProps.selectedDate.getTime()) {
    return false // Re-render
  }
  
  // Check tasks array length and reference
  if (prevProps.tasks.length !== nextProps.tasks.length) {
    return false // Re-render
  }
  
  // If tasks array reference changed but length is same, check if content changed
  if (prevProps.tasks !== nextProps.tasks) {
    // Quick check: compare first and last task IDs
    if (prevProps.tasks.length > 0 && nextProps.tasks.length > 0) {
      if (prevProps.tasks[0].id !== nextProps.tasks[0].id ||
          prevProps.tasks[prevProps.tasks.length - 1].id !== nextProps.tasks[nextProps.tasks.length - 1].id) {
        return false // Re-render
      }
    }
  }
  
  // Check callbacks
  if (prevProps.onDateSelect !== nextProps.onDateSelect ||
      prevProps.onTaskComplete !== nextProps.onTaskComplete ||
      prevProps.onTaskEdit !== nextProps.onTaskEdit ||
      prevProps.onTaskDelete !== nextProps.onTaskDelete) {
    return false // Re-render
  }
  
  return true // Skip re-render
})
