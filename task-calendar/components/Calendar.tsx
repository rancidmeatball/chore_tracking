'use client'

import { useState, useMemo } from 'react'
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
  const [currentMonth, setCurrentMonth] = useState(new Date())

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

  // Simple task lookup map - only recalculate when tasks change
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd')
      const existing = map.get(dateKey) || []
      existing.push(task)
      map.set(dateKey, existing)
    }
    return map
  }, [tasks])

  // Simple inline function
  const getTasksForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    return tasksByDate.get(dateKey) || []
  }


  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))


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
      <div className="mt-6 border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Tasks for {format(selectedDate, 'MMMM d, yyyy')}
        </h3>
        <div className="space-y-2">
          {(() => {
            const selectedDateTasks = getTasksForDate(selectedDate)
            if (selectedDateTasks.length === 0) {
              return <p className="text-gray-700">No tasks for this date</p>
            }
            return selectedDateTasks.map((task) => (
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
          ))
          })()}
        </div>
      </div>
    </div>
  )
}

// Export Calendar without memo - let React handle re-renders naturally
export default Calendar
