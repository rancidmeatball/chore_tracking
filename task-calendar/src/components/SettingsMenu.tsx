import { useState, useRef, useEffect } from 'react'
import { Child } from '@/types'

interface SettingsMenuProps {
  childrenList?: Child[]
  onChildUpdated?: () => void
  onCacheCleared?: () => void
}

export default function SettingsMenu({ childrenList = [], onChildUpdated, onCacheCleared }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showChildSettings, setShowChildSettings] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const clearCache = () => {
    try {
      // Clear localStorage
      localStorage.clear()
      
      // Clear sessionStorage
      sessionStorage.clear()
      
      // Clear any service worker cache if available
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name)
          })
        })
      }

      alert('Cache cleared successfully! The page will reload.')
      setIsOpen(false)
      
      // Reload the page to ensure fresh data
      window.location.reload()
    } catch (error) {
      console.error('Error clearing cache:', error)
      alert('Error clearing cache. Please try again.')
    }
  }

  const clearApplicationData = () => {
    if (confirm('This will clear all cached application data. Are you sure?')) {
      clearCache()
      if (onCacheCleared) {
        onCacheCleared()
      }
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-800 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
        aria-label="Settings"
        title="Settings"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {isOpen && !showChildSettings && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="py-1">
            <button
              onClick={() => {
                setShowChildSettings(true)
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-gray-100 transition flex items-center gap-2 font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              Manage Children
            </button>
            <button
              onClick={clearApplicationData}
              className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-gray-100 transition flex items-center gap-2 font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Clear Cache
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <div className="px-4 py-2 text-xs text-gray-700">
              Clears browser cache and reloads the page
            </div>
          </div>
        </div>
      )}

      {showChildSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Manage Children</h2>
              <button
                onClick={() => setShowChildSettings(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              {childrenList && childrenList.length > 0 ? (
                childrenList.map((child) => (
                  <ChildEditForm
                    key={child.id}
                    child={child}
                    onUpdated={() => {
                      if (onChildUpdated) onChildUpdated()
                    }}
                  />
                ))
              ) : (
                <p className="text-gray-600 text-center py-4">No children added yet. Use "Add Child" button to add children.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChildEditForm({ child, onUpdated }: { child: Child; onUpdated: () => void }) {
  const [name, setName] = useState(child.name)
  const [color, setColor] = useState(child.color || '#3B82F6')
  const [inputBoolean, setInputBoolean] = useState(child.inputBoolean || '')
  const [isSaving, setIsSaving] = useState(false)
  const [inputBooleanOptions, setInputBooleanOptions] = useState<Array<{ entity_id: string; name: string; state: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoadingEntities, setIsLoadingEntities] = useState(false)

  const fetchInputBooleans = async () => {
    if (inputBooleanOptions.length > 0 || isLoadingEntities) return
    setIsLoadingEntities(true)
    try {
      const response = await fetch('/api/home-assistant/input-booleans')
      if (response.ok) {
        const data = await response.json()
        setInputBooleanOptions(data.inputBooleans || [])
      } else {
        console.error('Failed to fetch input booleans')
      }
    } catch (error) {
      console.error('Error fetching input booleans:', error)
    } finally {
      setIsLoadingEntities(false)
    }
  }

  const filteredOptions = inputBooleanOptions.filter((opt) => {
    if (!inputBoolean) return true
    const query = inputBoolean.toLowerCase()
    return opt.entity_id.toLowerCase().includes(query) || opt.name?.toLowerCase().includes(query)
  }).slice(0, 10)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const response = await fetch(`/api/children/${child.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, inputBoolean: inputBoolean || null }),
      })

      if (response.ok) {
        onUpdated()
        alert('Child updated successfully!')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to update child'}`)
      }
    } catch (error) {
      console.error('Error updating child:', error)
      alert('Failed to update child')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border border-gray-200 rounded-lg space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-900 mb-1">Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Input Boolean
          </label>
          <input
            type="text"
            value={inputBoolean}
            onChange={(e) => {
              setInputBoolean(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => {
              setShowSuggestions(true)
              fetchInputBooleans()
            }}
            placeholder="input_boolean.tasks_complete_..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
            title="Home Assistant input_boolean entity (e.g., input_boolean.tasks_complete_hayden)"
          />
          {isLoadingEntities && (
            <div className="text-xs text-gray-500 mt-1">Loading input booleans…</div>
          )}
          {showSuggestions && filteredOptions.length > 0 && (
            <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow max-h-40 overflow-y-auto z-10">
              {filteredOptions.map((opt) => (
                <button
                  key={opt.entity_id}
                  type="button"
                  onClick={() => {
                    setInputBoolean(opt.entity_id)
                    setShowSuggestions(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm text-gray-900"
                >
                  <div className="font-medium">{opt.entity_id}</div>
                  {opt.name && opt.name !== opt.entity_id && (
                    <div className="text-xs text-gray-600">{opt.name}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <button
        type="submit"
        disabled={isSaving}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}

