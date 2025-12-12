'use client'

import { useState, useEffect } from 'react'
import Calendar from '@/components/Calendar'
import TaskForm from '@/components/TaskForm'
import RecurrenceTemplateManager from '@/components/RecurrenceTemplateManager'
import ChildManager from '@/components/ChildManager'
import { Task, Child, RecurrenceTemplate } from '@/types'

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showRecurrenceManager, setShowRecurrenceManager] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  useEffect(() => {
    fetchTasks()
    fetchChildren()
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks')
      const data = await response.json()
      setTasks(data)
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const fetchChildren = async () => {
    try {
      const response = await fetch('/api/children')
      const data = await response.json()
      setChildren(data)
    } catch (error) {
      console.error('Error fetching children:', error)
    }
  }

  const handleTaskComplete = async (taskId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      })
      if (response.ok) {
        await fetchTasks()
        // Check if all tasks for the day are complete
        await checkDailyCompletion()
      }
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        await fetchTasks()
      } else {
        alert('Failed to delete task')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }

  const checkDailyCompletion = async () => {
    try {
      const response = await fetch('/api/tasks/check-daily-completion')
      if (response.ok) {
        const data = await response.json()
        if (data.allComplete) {
          // Trigger Home Assistant webhook
          await fetch('/api/home-assistant/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: new Date().toISOString() }),
          })
        }
      }
    } catch (error) {
      console.error('Error checking daily completion:', error)
    }
  }

  const handleTaskSaved = () => {
    fetchTasks()
    setShowTaskForm(false)
    setSelectedTask(null)
  }

  const handleEditTask = (task: Task) => {
    setSelectedTask(task)
    setShowTaskForm(true)
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Task Calendar
          </h1>
          <p className="text-gray-600">
            Track chores and tasks for your children
          </p>
        </div>

        <ChildManager childrenList={children} onChildAdded={fetchChildren} />

        <div className="mb-6 flex gap-4">
          <button
            onClick={() => {
              setSelectedTask(null)
              setShowTaskForm(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Add New Task
          </button>
          <button
            onClick={() => setShowRecurrenceManager(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Manage Recurrence Templates
          </button>
        </div>

        <Calendar
          tasks={tasks}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onTaskComplete={handleTaskComplete}
          onTaskEdit={handleEditTask}
          onTaskDelete={handleTaskDelete}
        />

        {showTaskForm && (
          <TaskForm
            task={selectedTask}
            childrenList={children}
            onSave={handleTaskSaved}
            onCancel={() => {
              setShowTaskForm(false)
              setSelectedTask(null)
            }}
            onDelete={handleTaskDelete}
          />
        )}

        {showRecurrenceManager && (
          <RecurrenceTemplateManager
            onClose={() => setShowRecurrenceManager(false)}
          />
        )}
      </div>
    </main>
  )
}
