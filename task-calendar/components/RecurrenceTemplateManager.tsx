'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { RecurrenceTemplate, Child } from '@/types'

interface RecurrenceTemplateManagerProps {
  onClose: () => void
  childrenList: Child[]
}

export default function RecurrenceTemplateManager({ onClose, childrenList }: RecurrenceTemplateManagerProps) {
  const [templates, setTemplates] = useState<RecurrenceTemplate[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<RecurrenceTemplate | null>(null)
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<'one-time' | 'weekly' | 'monthly'>('one-time')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [childId, setChildId] = useState<string>('')

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/recurrence-templates')
      const data = await response.json()
      setTemplates(data)
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingTemplate
        ? `/api/recurrence-templates/${editingTemplate.id}`
        : '/api/recurrence-templates'
      const method = editingTemplate ? 'PUT' : 'POST'

      // Get child name for the template name
      const selectedChild = childrenList.find(c => c.id === childId)
      if (!selectedChild) {
        alert('Please select a child')
        return
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedChild.name, // Use child name as template name
          description,
          frequency,
          daysOfWeek: frequency === 'weekly' ? daysOfWeek : null,
          dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
          dueDate: frequency === 'one-time' ? new Date(dueDate).toISOString() : null,
          childId: childId || null,
        }),
      })

      if (response.ok) {
        fetchTemplates()
        resetForm()
      } else {
        const error = await response.json()
        alert(`Error: ${error.message || 'Failed to save template'}`)
      }
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
    }
  }

  const handleEdit = (template: RecurrenceTemplate) => {
    setEditingTemplate(template)
    setDescription(template.description || '')
    setFrequency(template.frequency)
    setDaysOfWeek(template.daysOfWeek || [])
    setDayOfMonth(template.dayOfMonth || 1)
    setChildId(template.childId || '')
    if (template.dueDate) {
      setDueDate(format(new Date(template.dueDate), 'yyyy-MM-dd'))
    } else {
      setDueDate(format(new Date(), 'yyyy-MM-dd'))
    }
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const response = await fetch(`/api/recurrence-templates/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchTemplates()
      } else {
        alert('Failed to delete template')
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Failed to delete template')
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingTemplate(null)
    setDescription('')
    setFrequency('one-time')
    setDaysOfWeek([])
    setDayOfMonth(1)
    setDueDate(format(new Date(), 'yyyy-MM-dd'))
    setChildId('')
  }

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    )
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Recurrence Templates</h2>
          <button
            onClick={onClose}
            className="text-gray-700 hover:text-gray-900 text-2xl"
          >
            ×
          </button>
        </div>

        {!showForm ? (
          <>
            <button
              onClick={() => setShowForm(true)}
              className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Create New Template
            </button>

            <div className="space-y-2">
              {templates.length === 0 ? (
                <p className="text-gray-700">No recurrence templates yet</p>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 border border-gray-200 rounded-lg flex justify-between items-start"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      {template.description && (
                        <p className="text-sm text-gray-900">{template.description}</p>
                      )}
                      {template.child && (
                        <p className="text-sm text-gray-900 font-medium mt-1">Child: {template.child.name}</p>
                      )}
                      <p className="text-sm text-gray-900 mt-1">
                        Frequency: {template.frequency === 'one-time' ? 'One-Time (No Recurrence)' : template.frequency}
                        {template.frequency === 'weekly' && template.daysOfWeek && template.daysOfWeek.length > 0 && (
                          <span> (Days: {template.daysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')})</span>
                        )}
                        {template.frequency === 'monthly' && template.dayOfMonth != null && (
                          <span> (Day {template.dayOfMonth!} of each month)</span>
                        )}
                        {template.frequency === 'one-time' && template.dueDate && (
                          <span> - Due: {format(new Date(template.dueDate), 'MMM d, yyyy')}</span>
                        )}
                        {(template.frequency === 'weekly' || template.frequency === 'monthly') && (
                          <span className="text-green-700 font-medium"> (Open-Ended)</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(template)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Child Name * (Template will use this name)
              </label>
              <select
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="">Select a child...</option>
                {childrenList.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Frequency *
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'one-time' | 'weekly' | 'monthly')}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="one-time">One-Time (No Recurrence)</option>
                <option value="weekly">Weekly (Repeat on Selected Days)</option>
                <option value="monthly">Monthly (Same Day Each Month)</option>
              </select>
            </div>

            {frequency === 'weekly' && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Select Days of Week * (Choose which days to repeat weekly)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {dayNames.map((dayName, index) => (
                    <label
                      key={index}
                      className="flex items-center space-x-3 p-3 border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-white hover:border-blue-400 transition bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={daysOfWeek.includes(index)}
                        onChange={() => toggleDayOfWeek(index)}
                        className="w-5 h-5 text-blue-600 border-gray-400 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-gray-900 font-semibold text-base">{dayName}</span>
                    </label>
                  ))}
                </div>
                {daysOfWeek.length === 0 && (
                  <p className="text-sm text-red-600 font-medium mt-3">⚠️ Please select at least one day</p>
                )}
                {daysOfWeek.length > 0 && (
                  <p className="text-sm text-green-600 font-medium mt-3">
                    ✓ Selected: {daysOfWeek.map(d => dayNames[d]).join(', ')}
                  </p>
                )}
              </div>
            )}

            {frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Day of Month (1-31) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>
            )}

            {frequency === 'one-time' && (
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

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

