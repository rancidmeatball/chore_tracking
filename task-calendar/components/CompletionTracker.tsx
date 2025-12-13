'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { Child } from '@/types'

interface CompletionStats {
  period: {
    startDate: string
    endDate: string
    days: number
  }
  statistics: {
    totalCompleted: number
    onTimeCount: number
    lateCount: number
    onTimePercentage: number
  }
  byChild: Array<{
    childId: string
    childName: string
    childColor: string | null
    count: number
    onTime: number
    late: number
  }>
  byDate: Record<string, any[]>
  recentCompletions: Array<{
    id: string
    title: string
    completedAt: string
    dueDate: string
    child: {
      name: string
      color: string | null
    }
  }>
}

interface CompletionTrackerProps {
  childrenList: Child[]
}

export default function CompletionTracker({ childrenList }: CompletionTrackerProps) {
  const [stats, setStats] = useState<CompletionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [selectedChildId, setSelectedChildId] = useState<string>('')

  useEffect(() => {
    fetchStats()
  }, [days, selectedChildId])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const url = new URL('/api/tasks/completions', window.location.origin)
      url.searchParams.set('days', days.toString())
      if (selectedChildId) {
        url.searchParams.set('childId', selectedChildId)
      }

      const response = await fetch(url.toString())
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching completion stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <p className="text-gray-700">Loading completion statistics...</p>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Completion Tracking</h2>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center w-full sm:w-auto">
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Time Period
            </label>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white touch-manipulation"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Filter by Child
            </label>
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white touch-manipulation"
            >
              <option value="">All Children</option>
              {childrenList.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-700 font-medium">Total Completed</p>
          <p className="text-3xl font-bold text-blue-900">{stats.statistics.totalCompleted}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-700 font-medium">On Time</p>
          <p className="text-3xl font-bold text-green-900">{stats.statistics.onTimeCount}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <p className="text-sm text-yellow-700 font-medium">Late</p>
          <p className="text-3xl font-bold text-yellow-900">{stats.statistics.lateCount}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-purple-700 font-medium">On Time %</p>
          <p className="text-3xl font-bold text-purple-900">{stats.statistics.onTimePercentage}%</p>
        </div>
      </div>

      {/* By Child Statistics */}
      {stats.byChild.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">By Child</h3>
          <div className="space-y-2">
            {stats.byChild.map((child) => (
              <div key={child.childId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {child.childColor && (
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: child.childColor }}
                    />
                  )}
                  <span className="font-medium text-gray-900">{child.childName}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-700">
                    <span className="font-semibold text-green-600">{child.onTime}</span> on time
                  </span>
                  <span className="text-gray-700">
                    <span className="font-semibold text-yellow-600">{child.late}</span> late
                  </span>
                  <span className="text-gray-700">
                    <span className="font-semibold">{child.count}</span> total
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Completions */}
      {stats.recentCompletions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Completions</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.recentCompletions.map((task) => {
              const completedAt = parseISO(task.completedAt)
              const dueDate = parseISO(task.dueDate)
              const isOnTime = completedAt <= dueDate
              const childColor = task.child?.color || '#3B82F6'

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border-l-4"
                  style={{ borderLeftColor: childColor }}
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{task.title}</p>
                    <div className="flex gap-4 text-xs text-gray-600 mt-1">
                      <span>Completed: {format(completedAt, 'MMM d, yyyy h:mm a')}</span>
                      <span>Due: {format(dueDate, 'MMM d, yyyy')}</span>
                      {task.child && (
                        <span className="font-medium" style={{ color: childColor }}>
                          {task.child.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    {isOnTime ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        On Time
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                        Late
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {stats.statistics.totalCompleted === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No completions tracked in the selected period.</p>
        </div>
      )}
    </div>
  )
}

