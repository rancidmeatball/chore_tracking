'use client'

import { useState, useEffect } from 'react'
import { Task, Child, RecurrenceTemplate } from '@/types'
import { format } from 'date-fns'

interface TaskFormProps {
  task?: Task | null
  childrenList: Child[]
  onSave: () => void
  onCancel: () => void
  onDelete?: (taskId: string, deleteSeries?: boolean) => void
}

export default function TaskForm({ task, childrenList, onSave, onCancel, onDelete }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [isOpenEnded, setIsOpenEnded] = useState(false)
  const [childId, setChildId] = useState('')
  const [category, setCategory] = useState<'helping-family' | 'enrichment'>('helping-family')
  const [recurrenceTemplateId, setRecurrenceTemplateId] = useState('')
  const [recurrenceTemplates, setRecurrenceTemplates] = useState<RecurrenceTemplate[]>([])

  useEffect(() => {
    fetchRecurrenceTemplates()
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setDueDate(format(new Date(task.dueDate), 'yyyy-MM-dd'))
      setChildId(task.childId)
      setCategory(task.category || 'helping-family')
      setRecurrenceTemplateId(task.recurrenceTemplateId || '')
      setIsOpenEnded(false) // Tasks always have a due date
    }
  }, [task])

  // Get selected recurrence template
  const selectedTemplate = recurrenceTemplates.find(t => t.id === recurrenceTemplateId)
  const isRecurring = selectedTemplate && selectedTemplate.frequency !== 'one-time'

  const fetchRecurrenceTemplates = async () => {
    try {
      const response = await fetch('/api/recurrence-templates')
      const data = await response.json()
      setRecurrenceTemplates(data)
    } catch (error) {
      console.error('Error fetching recurrence templates:', error)
    }
  }

  // Format template display text with all relevant information
  const formatTemplateDisplay = (template: RecurrenceTemplate): string => {
    const parts: string[] = []
    
    // Add child name if available
    if (template.child?.name) {
      parts.push(template.child.name)
    }
    
    // Add template name
    parts.push(template.name)
    
    // Add frequency and schedule details
    if (template.frequency === 'weekly' && template.daysOfWeek && template.daysOfWeek.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const selectedDays = template.daysOfWeek
        .map((day: number) => dayNames[day])
        .join(', ')
      parts.push(`Weekly: ${selectedDays}`)
    } else if (template.frequency === 'monthly' && template.dayOfMonth) {
      parts.push(`Monthly: Day ${template.dayOfMonth}`)
    } else if (template.frequency === 'one-time') {
      parts.push('One-time')
    } else {
      parts.push(template.frequency)
    }
    
    // Add description if available
    if (template.description) {
      parts.push(`- ${template.description}`)
    }
    
    return parts.join(' | ')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = task ? `/api/tasks/${task.id}` : '/api/tasks'
      const method = task ? 'PUT' : 'POST'
      
      // For open-ended recurring tasks, use a far future date or null
      let taskDueDate: string | null = null
      if (isOpenEnded && isRecurring) {
        // Open-ended: use a far future date (10 years from now)
        taskDueDate = new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString()
      } else {
        taskDueDate = new Date(dueDate).toISOString()
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          dueDate: taskDueDate,
          category,
          childId,
          recurrenceTemplateId: recurrenceTemplateId || null,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        // Log how many tasks were created (for recurring templates, this will be an array)
        if (Array.isArray(result)) {
          console.log(`Created ${result.length} recurring tasks`)
        } else {
          console.log('Created single task')
        }
        onSave()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || error.message || 'Failed to save task'}`)
      }
    } catch (error) {
      console.error('Error saving task:', error)
      alert('Failed to save task')
    }
  }

  const handleDelete = async () => {
    if (!task || !onDelete) return

    // Check if this task is part of a recurring series
    let deleteSeries = false
    if (task.recurrenceTemplateId) {
      deleteSeries = confirm(
        `"${task.title}" is part of a recurring series.\n\n` +
        `Click OK to delete ALL future tasks in this series (starting from this date).\n` +
        `Click Cancel to delete just this one task.`
      )
    } else {
      if (!confirm(`Are you sure you want to delete "${task.title}"?`)) return
    }

    try {
      const url = deleteSeries 
        ? `/api/tasks/${task.id}?deleteSeries=true`
        : `/api/tasks/${task.id}`
      
      const response = await fetch(url, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        if (result.deletedCount && result.deletedCount > 1) {
          console.log(`Deleted ${result.deletedCount} tasks from series`)
        }
        onDelete(task.id, deleteSeries)
        onCancel()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to delete task'}`)
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {task ? 'Edit Task' : 'Create New Task'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
            />
          </div>

          {(!selectedTemplate || selectedTemplate.frequency === 'one-time') && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Due Date *
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>
          )}

          {isRecurring && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Due Date
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOpenEnded}
                    onChange={(e) => {
                      setIsOpenEnded(e.target.checked)
                      if (!e.target.checked) {
                        setDueDate(format(new Date(), 'yyyy-MM-dd'))
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-900 font-medium">Open-Ended (No Due Date)</span>
                </label>
                {!isOpenEnded && (
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  />
                )}
              </div>
              <p className="text-xs text-gray-700 mt-1">
                {isOpenEnded 
                  ? 'This task will repeat indefinitely on the scheduled days'
                  : 'Set a specific end date for this recurring task'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Assign to Child *
            </label>
            <select
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
            >
              <option value="">Select a child</option>
              {childrenList.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as 'helping-family' | 'enrichment')}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
            >
              <option value="helping-family">👨‍👩‍👧 Helping the Family</option>
              <option value="enrichment">📚 Enrichment</option>
            </select>
            <p className="text-xs text-gray-600 mt-1">
              {category === 'helping-family' 
                ? 'Tasks that help the family (chores, cleaning, etc.)'
                : 'Tasks for personal enrichment (reading, learning, etc.)'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Recurrence Template (Optional)
            </label>
            <select
              value={recurrenceTemplateId}
              onChange={(e) => setRecurrenceTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
            >
              <option value="">None - Create a one-time task</option>
              {recurrenceTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {formatTemplateDisplay(template)}
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-gray-900">
                  {selectedTemplate.child?.name && (
                    <span className="text-blue-700">👤 {selectedTemplate.child.name}</span>
                  )}
                  {selectedTemplate.child?.name && selectedTemplate.name && ' • '}
                  <span className="text-gray-700">{selectedTemplate.name}</span>
                </p>
                {selectedTemplate.description && (
                  <p className="text-xs text-gray-600 mt-1">{selectedTemplate.description}</p>
                )}
                <div className="mt-1 text-xs text-gray-600">
                  {selectedTemplate.frequency === 'weekly' && selectedTemplate.daysOfWeek && selectedTemplate.daysOfWeek.length > 0 && (
                    <span>
                      📅 Weekly on: {selectedTemplate.daysOfWeek
                        .map((day: number) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day])
                        .join(', ')}
                    </span>
                  )}
                  {selectedTemplate.frequency === 'monthly' && selectedTemplate.dayOfMonth && (
                    <span>📅 Monthly on day {selectedTemplate.dayOfMonth}</span>
                  )}
                  {selectedTemplate.frequency === 'one-time' && (
                    <span>📅 One-time task</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            {task && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {task ? 'Update Task' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
