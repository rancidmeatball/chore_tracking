import { useState, useEffect } from 'react'
import { Child } from '@/types'

const TIME_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240] as const

function formatTime(minutes: number): string {
  const hours = Math.floor(Math.abs(minutes) / 60)
  const mins = Math.abs(minutes) % 60
  const sign = minutes < 0 ? '-' : ''
  if (hours === 0) return `${sign}${mins}m`
  if (mins === 0) return `${sign}${hours}h`
  return `${sign}${hours}h ${mins}m`
}

function minutesLabel(m: number): string {
  if (m === 60) return '1 hour'
  if (m === 90) return '1.5 hours'
  if (m === 120) return '2 hours'
  if (m === 180) return '3 hours'
  if (m === 240) return '4 hours'
  return `${m} minutes`
}

interface ClaimTimeModalProps {
  isOpen: boolean
  onClose: () => void
  childrenList: Child[]
  onClaimed: () => void
}

export default function ClaimTimeModal({
  isOpen,
  onClose,
  childrenList,
  onClaimed,
}: ClaimTimeModalProps) {
  const [childId, setChildId] = useState('')
  const [minutes, setMinutes] = useState(15)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setMinutes(15)
    setNote('')
    setChildId('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || childrenList.length !== 1) return
    setChildId(childrenList[0].id)
  }, [isOpen, childrenList])

  const selectedChild = childrenList.find((c) => c.id === childId)

  const handleClose = () => {
    setNote('')
    setMinutes(15)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!childId) {
      alert('Please select a child')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/children/${childId}/time-claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      })

      if (response.ok) {
        onClaimed()
        handleClose()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to claim time'}`)
      }
    } catch {
      alert('Failed to claim time')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Claim time reward</h2>
        <p className="text-sm text-gray-600 mb-4">
          Record tech time you&apos;re using now. This subtracts from the child&apos;s banked balance.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Child *</label>
            <select
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
            >
              <option value="">Choose a child…</option>
              {childrenList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.timeBalance !== 0 ? ` (${formatTime(c.timeBalance)} available)` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedChild && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <span className="text-gray-600">Current balance: </span>
              <span
                className={`font-bold ${selectedChild.timeBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {formatTime(selectedChild.timeBalance)}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Amount to claim *</label>
            <select
              value={minutes}
              onChange={(e) => setMinutes(parseInt(e.target.value, 10))}
              required
              disabled={!childId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white disabled:opacity-50"
            >
              {TIME_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {minutesLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. Minecraft, TV"
              disabled={!childId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-800 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !childId || childrenList.length === 0}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : `Claim ${formatTime(minutes)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
