export interface Child {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface RecurrenceTemplate {
  id: string
  name: string
  description?: string
  frequency: 'daily' | 'weekly' | 'monthly'
  dayOfWeek?: number
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

