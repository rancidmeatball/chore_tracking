import { useState, useEffect } from 'react'
import { Child } from '@/types'

interface TimeTrackerProps {
  childrenList: Child[]
  onTimeUpdated: () => void
}

export default function TimeTracker({ childrenList, onTimeUpdated }: TimeTrackerProps) {
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [timeIncrement, setTimeIncrement] = useState<number>(15) // 15-minute increments
  const [operation, setOperation] = useState<'add' | 'subtract'>('add')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedChild = childrenList.find(c => c.id === selectedChildId)

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(Math.abs(minutes) / 60)
    const mins = Math.abs(minutes) % 60
    const sign = minutes < 0 ? '-' : ''
    if (hours === 0) {
      return `${sign}${mins}m`
    }
    if (mins === 0) {
      return `${sign}${hours}h`
    }
    return `${sign}${hours}h ${mins}m`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChildId) {
      alert('Please select a child')
      return
    }

    setIsSubmitting(true)
    try {
      const minutes = operation === 'add' ? timeIncrement : -timeIncrement
      const response = await fetch(`/api/children/${selectedChildId}/time`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      })

      if (response.ok) {
        onTimeUpdated()
        // Reset form
        setTimeIncrement(15)
        setOperation('add')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to update time'}`)
      }
    } catch (error) {
      console.error('Error updating time:', error)
      alert('Failed to update time')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Time Tracker</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Select Child *
          </label>
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
          >
            <option value="">Choose a child...</option>
            {childrenList.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name} {child.timeBalance !== 0 && `(${formatTime(child.timeBalance)})`}
              </option>
            ))}
          </select>
        </div>

        {selectedChild && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-900 mb-1 font-medium">Current Balance:</p>
            <p className={`text-2xl font-bold ${selectedChild.timeBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatTime(selectedChild.timeBalance)}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Operation *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                value="add"
                checked={operation === 'add'}
                onChange={(e) => setOperation(e.target.value as 'add' | 'subtract')}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-gray-900 font-medium">Add Time</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                value="subtract"
                checked={operation === 'subtract'}
                onChange={(e) => setOperation(e.target.value as 'add' | 'subtract')}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-gray-900 font-medium">Subtract Time</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Time Amount (15-minute increments) *
          </label>
          <select
            value={timeIncrement}
            onChange={(e) => setTimeIncrement(parseInt(e.target.value))}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
            <option value={180}>3 hours</option>
            <option value={240}>4 hours</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !selectedChildId}
          className={`w-full px-4 py-2 rounded-lg transition font-semibold ${
            operation === 'add'
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-red-600 text-white hover:bg-red-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting ? 'Processing...' : `${operation === 'add' ? 'Add' : 'Subtract'} ${formatTime(timeIncrement)}`}
        </button>
      </form>

      {childrenList.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">All Children&apos;s Time Balance</h3>
          <div className="space-y-2">
            {childrenList.map((child) => (
              <div
                key={child.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <span className="font-medium text-gray-900">{child.name}</span>
                <span className={`font-bold ${child.timeBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatTime(child.timeBalance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

