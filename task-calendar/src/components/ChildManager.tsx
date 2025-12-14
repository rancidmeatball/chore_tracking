import { useState, useEffect } from 'react'
import { Child } from '@/types'

interface ChildManagerProps {
  childrenList: Child[]
  onChildAdded: () => void
}

export default function ChildManager({ childrenList, onChildAdded }: ChildManagerProps) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6') // Default blue
  const [inputBoolean, setInputBoolean] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, inputBoolean: inputBoolean || null }),
      })

      if (response.ok) {
        setName('')
        setColor('#3B82F6') // Reset to default
        setInputBoolean('')
        setShowForm(false)
        onChildAdded()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to add child'}`)
      }
    } catch (error) {
      console.error('Error adding child:', error)
      alert('Failed to add child')
    }
  }

  if (!showForm) {
    return (
      <div className="mb-4">
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-3 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:bg-purple-800 transition touch-manipulation text-base sm:text-sm font-medium w-full sm:w-auto"
        >
          Add Child
        </button>
        {childrenList.length > 0 && (
          <div className="mt-2 text-sm text-gray-900">
            Children: {childrenList.map(c => c.name).join(', ')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Child's name"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-400 mb-2"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
            title="Choose color for this child's tasks"
          />
          <input
            type="text"
            value={inputBoolean}
            onChange={(e) => setInputBoolean(e.target.value)}
            placeholder="input_boolean.tasks_complete_..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
            title="Home Assistant input_boolean entity (e.g., input_boolean.tasks_complete_hayden)"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(false)
              setName('')
              setColor('#3B82F6')
              setInputBoolean('')
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

