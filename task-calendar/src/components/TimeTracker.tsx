import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { Child, TimeClaim } from '@/types'

interface TimeTrackerProps {
  childrenList: Child[]
  onTimeUpdated: () => void
}

const TIME_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240] as const

export default function TimeTracker({ childrenList, onTimeUpdated }: TimeTrackerProps) {
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [timeIncrement, setTimeIncrement] = useState<number>(15) // 15-minute increments
  const [operation, setOperation] = useState<'add' | 'subtract'>('add')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [claimMinutes, setClaimMinutes] = useState<number>(15)
  const [claimNote, setClaimNote] = useState('')
  const [claimSubmitting, setClaimSubmitting] = useState(false)
  const [claims, setClaims] = useState<TimeClaim[]>([])
  const [claimsLoading, setClaimsLoading] = useState(false)

  const selectedChild = childrenList.find(c => c.id === selectedChildId)

  const loadClaims = useCallback(async (childId: string) => {
    if (!childId) {
      setClaims([])
      return
    }
    setClaimsLoading(true)
    try {
      const response = await fetch(`/api/children/${childId}/time-claims?limit=40`)
      if (response.ok) {
        const data = await response.json()
        setClaims(Array.isArray(data) ? data : [])
      } else {
        setClaims([])
      }
    } catch {
      setClaims([])
    } finally {
      setClaimsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadClaims(selectedChildId)
  }, [selectedChildId, loadClaims])

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

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChildId) {
      alert('Please select a child')
      return
    }

    setClaimSubmitting(true)
    try {
      const response = await fetch(`/api/children/${selectedChildId}/time-claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes: claimMinutes,
          ...(claimNote.trim() ? { note: claimNote.trim() } : {}),
        }),
      })

      if (response.ok) {
        onTimeUpdated()
        setClaimNote('')
        await loadClaims(selectedChildId)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to log time used'}`)
      }
    } catch (error) {
      console.error('Error logging time claim:', error)
      alert('Failed to log time used')
    } finally {
      setClaimSubmitting(false)
    }
  }

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

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Time Tracker</h2>
      
      {childrenList.length > 0 && (
        <div className="mb-6 pb-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">All Children&apos;s Time Balance</h3>
          <div className="space-y-2">
            {childrenList.map((child) => (
              <div
                key={child.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {child.color && (
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: child.color }}
                    />
                  )}
                  <span className="font-medium text-gray-900">{child.name}</span>
                </div>
                <span className={`text-lg font-bold ${child.timeBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatTime(child.timeBalance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
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
            {TIME_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 60 ? '1 hour' : m === 90 ? '1.5 hours' : m === 120 ? '2 hours' : m === 180 ? '3 hours' : m === 240 ? '4 hours' : `${m} minutes`}
              </option>
            ))}
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

      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Log time used</h3>
        <p className="text-sm text-gray-600 mb-4">
          Record when banked tech time was actually used. This subtracts from the child&apos;s balance and keeps a history below.
        </p>
        <form onSubmit={handleClaimSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              How much time was used? *
            </label>
            <select
              value={claimMinutes}
              onChange={(e) => setClaimMinutes(parseInt(e.target.value, 10))}
              required
              disabled={!selectedChildId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white disabled:opacity-50"
            >
              {TIME_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 60 ? '1 hour' : m === 90 ? '1.5 hours' : m === 120 ? '2 hours' : m === 180 ? '3 hours' : m === 240 ? '4 hours' : `${m} minutes`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              value={claimNote}
              onChange={(e) => setClaimNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. Minecraft, TV show"
              disabled={!selectedChildId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={claimSubmitting || !selectedChildId}
            className="w-full px-4 py-2 rounded-lg font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {claimSubmitting ? 'Saving...' : `Log ${formatTime(claimMinutes)} used`}
          </button>
        </form>

        {selectedChildId && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Recent time used</h4>
            {claimsLoading ? (
              <p className="text-sm text-gray-600">Loading…</p>
            ) : claims.length === 0 ? (
              <p className="text-sm text-gray-600">No entries yet for this child.</p>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {claims.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 p-3 bg-gray-50 rounded-lg text-sm"
                  >
                    <div>
                      <span className="font-semibold text-gray-900">−{formatTime(c.minutes)}</span>
                      {c.note && <span className="text-gray-700 ml-2">{c.note}</span>}
                    </div>
                    <span className="text-gray-500 shrink-0">
                      {format(parseISO(c.createdAt), 'MMM d, yyyy h:mm a')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

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

