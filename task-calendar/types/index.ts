export interface Child {
  id: string
  name: string
  timeBalance: number // Time in minutes
  color?: string // Hex color code for calendar display
  createdAt: string
  updatedAt: string
}

export interface RecurrenceTemplate {
  id: string
  name: string
  description?: string
  frequency: 'one-time' | 'weekly' | 'monthly'
  daysOfWeek?: number[] // Array of day numbers [0-6] for weekly
  dayOfMonth?: number
  dueDate?: string // Optional due date (only for one-time tasks)
  childId?: string
  child?: Child
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  description?: string
  dueDate: string
  completed: boolean
  completedAt?: string
  childId: string
  child?: Child
  recurrenceTemplateId?: string
  recurrenceTemplate?: RecurrenceTemplate
  createdAt: string
  updatedAt: string
}

