import { useState, useMemo, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns'
import { Task } from '@/types'
import { useIsMobile } from '@/hooks/useIsMobile'

interface CalendarProps {
  tasks: Task[]
  selectedDate: Date
  onDateSelect: (date: Date) => void
  onTaskComplete: (taskId: string, completed: boolean) => void
  onTaskEdit: (task: Task) => void
  onTaskDelete: (taskId: string, deleteSeries?: boolean) => void
  children?: Array<{ id: string; name: string }>
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
  const [mobileDayExpanded, setMobileDayExpanded] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!isMobile || !mobileDayExpanded) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isMobile, mobileDayExpanded])

  useEffect(() => {
    if (!isMobile) setMobileDayExpanded(false)
  }, [isMobile])

  useEffect(() => {
    setMobileDayExpanded(false)
  }, [currentMonth])
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

  // Get list of children who completed both categories on a specific date
  const getChildrenWithBothCategoriesComplete = (date: Date) => {
    const dayTasks = getTasksForDate(date)
    const tasksByChild = new Map<string, { helpingFamily: Task[], enrichment: Task[] }>()
    
    for (const task of dayTasks) {
      if (!tasksByChild.has(task.childId)) {
        tasksByChild.set(task.childId, { helpingFamily: [], enrichment: [] })
      }
      const childTasks = tasksByChild.get(task.childId)!
      if (task.category === 'helping-family') {
        childTasks.helpingFamily.push(task)
      } else if (task.category === 'enrichment') {
        childTasks.enrichment.push(task)
      }
    }
    
    const completedChildren: Array<{ childId: string; color: string }> = []

    // Check each child to see if they have both categories complete
    for (const [childId, childTasks] of tasksByChild.entries()) {
      const hasBoth = childTasks.helpingFamily.length > 0 && 
                      childTasks.enrichment.length > 0
      // A child gets a star if they have at least ONE completed task in each category
      const bothComplete = hasBoth &&
                          childTasks.helpingFamily.some(t => t.completed) && 
                          childTasks.enrichment.some(t => t.completed)
      if (bothComplete) {
        // Use the child's color from any of their tasks on this day
        const sampleTask = dayTasks.find(t => t.childId === childId)
        const color = sampleTask?.child?.color || '#facc15' // default yellow-400
        completedChildren.push({ childId, color })
      }
    }
    return completedChildren
  }


  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))


  const today = new Date()
  const todayStr = format(today, 'MMM d, yyyy')
  const version = '0.1.74'

  const renderMobileTaskListForDay = (day: Date) => {
    const dayTasks = getTasksForDate(day)
    if (dayTasks.length === 0) {
      return (
        <p className="text-gray-700 text-center py-8 text-base">No tasks for this date</p>
      )
    }
    const sortedTasks = [...dayTasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      return a.title.localeCompare(b.title)
    })
    return (
      <div className="space-y-3 w-full max-w-none">
        {sortedTasks.map((task) => {
          const bgColor = getTaskBgColor(task)
          return (
            <div
              key={task.id}
              className="flex w-full max-w-none flex-col gap-3 rounded-lg border-2 p-4 touch-manipulation"
              style={{
                backgroundColor: task.completed ? '#f0f0f0' : bgColor + '20',
                borderColor: task.completed ? '#d0d0d0' : bgColor,
                borderLeftWidth: '6px',
              }}
            >
              <div className="flex w-full items-start gap-3">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={(e) => {
                    e.stopPropagation()
                    onTaskComplete(task.id, e.target.checked)
                  }}
                  className="h-6 w-6 flex-shrink-0 touch-manipulation rounded text-blue-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-lg">
                      {task.category === 'helping-family' ? '👨‍👩‍👧' : '📚'}
                    </span>
                    <h4
                      className={`text-base font-semibold ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}
                    >
                      {task.title}
                    </h4>
                  </div>
                  {task.child && <p className="text-sm text-gray-600">{task.child.name}</p>}
                </div>
              </div>
              <div className="flex w-full flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTaskEdit(task)
                  }}
                  className="min-h-[44px] touch-manipulation rounded bg-blue-100 px-4 py-2 text-base text-blue-700 active:bg-blue-200"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (task.recurrenceTemplateId) {
                      const deleteChoice = confirm(
                        `"${task.title}" is part of a recurring series.\n\n` +
                          `Click OK to delete ALL future tasks in this series (starting from this date).\n` +
                          `Click Cancel to delete just this one task.`,
                      )
                      onTaskDelete(task.id, deleteChoice)
                    } else if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
                      onTaskDelete(task.id, false)
                    }
                  }}
                  className="min-h-[44px] touch-manipulation rounded bg-red-100 px-4 py-2 text-base text-red-700 active:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Mobile view: Week view with large touch-friendly task list
  if (isMobile) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex justify-between items-center mb-4 border-b-2 border-gray-300 pb-2">
          <div className="text-sm font-semibold text-gray-700 font-mono bg-gray-50 px-3 py-1 rounded">
            v{version} • {todayStr}
          </div>
        </div>
        
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={prevMonth}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg active:bg-blue-800 font-semibold text-base touch-manipulation min-h-[44px]"
            aria-label="Previous month"
          >
            ←
          </button>
          <h2 className="text-xl font-bold text-gray-800 text-center flex-1">
            {monthYear}
          </h2>
          <button
            onClick={nextMonth}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg active:bg-blue-800 font-semibold text-base touch-manipulation min-h-[44px]"
            aria-label="Next month"
          >
            →
          </button>
        </div>

        {/* Mobile: 3-day view with today in the middle */}
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-2">
            {(() => {
              // Show 3 days: yesterday, today, tomorrow (or adjust based on selected date)
              const baseDate = isSameDay(selectedDate, today) ? today : selectedDate
              const threeDays = [
                new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 1),
                baseDate,
                new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 1)
              ]
              
              return threeDays.map((day) => {
                const dayKey = format(day, 'yyyy-MM-dd')
                const dayTasks = getTasksForDate(day)
                const isSelected = isSameDay(day, selectedDate)
                const isToday = isSameDay(day, today)
                const dayNumber = day.getDate()
                const dayName = format(day, 'EEE')
                
                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => {
                      onDateSelect(day)
                      setMobileDayExpanded(true)
                    }}
                    className={`
                      min-h-[80px] border-2 rounded-lg p-3 transition touch-manipulation
                      ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 active:bg-gray-100'}
                      ${isToday ? 'ring-2 ring-blue-300' : ''}
                    `}
                    style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="text-xs text-gray-600 mb-1">
                      {dayName}
                    </div>
                    <div className="text-lg font-bold mb-1">
                      {dayNumber}
                    </div>
                    {dayTasks.length > 0 && (
                      <div className="text-sm text-gray-700 font-semibold">
                        {dayTasks.filter(t => !t.completed).length}/{dayTasks.length}
                      </div>
                    )}
                    {isToday && (
                      <div className="text-xs text-blue-600 font-semibold mt-1">
                        Today
                      </div>
                    )}
                  </button>
                )
              })
            })()}
          </div>
        </div>

        <p className="text-sm text-gray-600 text-center mt-2">
          Tap a day to open full-width task list
        </p>

        {mobileDayExpanded && (
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-white"
            role="dialog"
            aria-modal="true"
            aria-label={`Tasks for ${format(selectedDate, 'MMMM d, yyyy')}`}
          >
            <div className="flex flex-shrink-0 items-center border-b border-gray-200 bg-white py-3 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
              <button
                type="button"
                onClick={() => setMobileDayExpanded(false)}
                className="min-h-[44px] touch-manipulation rounded-lg border border-gray-300 px-3 py-2 text-base font-semibold text-gray-800 active:bg-gray-100"
              >
                ← Back
              </button>
              <h2 className="min-w-0 flex-1 truncate px-2 text-center text-lg font-bold text-gray-900">
                {format(selectedDate, 'EEEE, MMM d')}
              </h2>
            </div>
            <div
              className="min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {renderMobileTaskListForDay(selectedDate)}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Desktop view: Full calendar grid
  return (
    <div className="bg-white rounded-lg shadow-lg p-2 sm:p-4 md:p-6">
      <div className="flex justify-between items-center mb-3 gap-2 border-b-2 border-gray-300 pb-2">
        <div className="text-sm font-semibold text-gray-700 font-mono bg-gray-50 px-3 py-1 rounded">
          v{version} • {todayStr}
        </div>
      </div>
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
          const completedChildren = getChildrenWithBothCategoriesComplete(day)

          return (
            <div
              key={dayKey}
              onClick={() => onDateSelect(day)}
              className={`
                h-12 sm:h-16 md:h-24 border-2 rounded-lg p-1 sm:p-2 cursor-pointer transition touch-manipulation
                ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 active:bg-gray-100'}
                ${!isCurrentMonth ? 'opacity-50' : ''}
              `}
              style={{ 
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <div className="flex justify-between items-start mb-0.5 sm:mb-1 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <span className={`text-xs sm:text-sm font-semibold ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                    {dayNumber}
                  </span>
                  {completedChildren.length > 0 && (
                    <div className="flex items-center gap-0.5">
                      {completedChildren.map(childInfo => (
                        <span
                          key={childInfo.childId}
                          className="text-xs sm:text-sm"
                          style={{ color: childInfo.color || '#facc15' }}
                          title="Both categories completed - Tech time awarded!"
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  )}
                </div>
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
              <div 
                className="overflow-y-auto overflow-x-hidden flex-1" 
                style={{ 
                  minHeight: 0,
                  pointerEvents: 'auto', 
                  WebkitOverflowScrolling: 'touch',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {(() => {
                  // Sort tasks: incomplete first, then completed at bottom, both by title
                  const sortedTasks = [...dayTasks].sort((a, b) => {
                    if (a.completed !== b.completed) {
                      return a.completed ? 1 : -1 // Incomplete first, completed at bottom
                    }
                    return a.title.localeCompare(b.title)
                  })
                  
                  // Limit to 8 tasks maximum for scrolling
                  const tasksToShow = sortedTasks.slice(0, 8)
                  
                  return (
                    <>
                      {tasksToShow.map((task, index) => {
                        const bgColor = getTaskBgColor(task)
                        const textColor = getTaskColor(task)
                        
                        return (
                          <div
                            key={task.id}
                            className={`
                              relative z-10 cursor-pointer text-[9px] p-0.5 rounded truncate group touch-manipulation
                              ${task.completed ? 'bg-green-200 text-green-800 line-through opacity-75' : ''}
                              hover:opacity-90 active:opacity-80 transition-opacity
                              ${index > 0 ? 'border-t border-white' : ''}
                            `}
                            style={{
                              ...(task.completed ? {} : { backgroundColor: bgColor, color: textColor.includes('white') ? 'white' : 'rgb(17, 24, 39)' }),
                              pointerEvents: 'auto',
                              zIndex: 10,
                              lineHeight: '1.2',
                              borderTopWidth: index > 0 ? '1px' : '0px'
                            }}
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
                            title={`${task.title} - Click to ${task.completed ? 'uncomplete' : 'complete'}, double-click to edit`}
                          >
                            <div className="flex items-center gap-0.5">
                              {task.completed && (
                                <span className="text-green-700 font-bold flex-shrink-0 text-[8px]">✓</span>
                              )}
                              <span className="text-[7px] opacity-75 flex-shrink-0">
                                {task.category === 'helping-family' ? '👨‍👩‍👧' : '📚'}
                              </span>
                              <span className={task.completed ? 'line-through' : ''}>{task.title}</span>
                            </div>
                          </div>
                        )
                      })}
                      {sortedTasks.length > 8 && (
                        <div className="text-[8px] text-gray-500 pt-0.5 border-t border-white">
                          +{sortedTasks.length - 8} more
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected Date Tasks Detail - Desktop only */}
      <div className="mt-3 sm:mt-6 border-t pt-3 sm:pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-4">
          Tasks for {format(selectedDate, 'MMMM d, yyyy')} ({(() => {
            const selectedDateTasks = getTasksForDate(selectedDate)
            return selectedDateTasks.length
          })()})
        </h3>
        <div className="space-y-2 overflow-y-auto overflow-x-hidden pr-2 relative" style={{ maxHeight: '400px', minHeight: '100px', pointerEvents: 'auto' }}>
          {(() => {
            const selectedDateTasks = getTasksForDate(selectedDate)
            if (selectedDateTasks.length === 0) {
              return <p className="text-gray-700">No tasks for this date</p>
            }
            // Sort: incomplete tasks first, then completed tasks at bottom, both by title
            const sortedTasks = [...selectedDateTasks].sort((a, b) => {
              if (a.completed !== b.completed) {
                return a.completed ? 1 : -1 // Incomplete first, completed at bottom
              }
              return a.title.localeCompare(b.title)
            })
            return sortedTasks.map((task) => {
              const bgColor = getTaskBgColor(task)
              return (
              <div
                key={task.id}
                className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg relative z-10"
                style={{ 
                  ...(task.completed ? {} : { backgroundColor: bgColor + '40', borderLeft: `4px solid ${bgColor}` }),
                  pointerEvents: 'auto',
                  position: 'relative',
                  zIndex: 10
                }}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={(e) => {
                    e.stopPropagation()
                    onTaskComplete(task.id, e.target.checked)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 rounded touch-manipulation relative"
                  style={{ pointerEvents: 'auto', zIndex: 20, position: 'relative' }}
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
                <div className="flex gap-2" style={{ pointerEvents: 'auto', zIndex: 20, position: 'relative' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskEdit(task)
                    }}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    style={{ pointerEvents: 'auto' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
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
                    style={{ pointerEvents: 'auto' }}
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
