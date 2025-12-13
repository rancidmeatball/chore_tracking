export interface Child {
  id: string
  name: string
  timeBalance: number // Time in minutes
  createdAt: string
  updatedAt: string
}

export interface RecurrenceTemplate {
  id: string
  name: string
  description?: string
  frequency: 'daily' | 'weekly' | 'monthly'
  daysOfWeek?: number[] // Array of day numbers [0-6] for weekly
  dayOfMonth?: number
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

