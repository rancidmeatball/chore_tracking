# Task Calendar - Chore Tracker

A web application to track chores and tasks for children with Home Assistant integration.

## Features

- ✅ Calendar view to track chores and tasks
- ✅ Create tasks with completion dates
- ✅ Assign tasks to children
- ✅ Recurrence templates (daily, weekly, monthly) that can be saved and reused
- ✅ Track task completion status
- ✅ Home Assistant integration - triggers automations when all tasks are completed for a day

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Home Assistant instance (optional, for automation integration)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and configure:
- `DATABASE_URL` - SQLite database path (default: `file:./dev.db`)
- `HOME_ASSISTANT_URL` - Your Home Assistant URL (e.g., `http://homeassistant.local:8123`)
- `HOME_ASSISTANT_TOKEN` - Long-lived access token from Home Assistant
- `HOME_ASSISTANT_WEBHOOK_ID` - Optional webhook ID for Home Assistant

3. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Home Assistant Setup

### Option 1: REST API (Recommended)

1. Create a Long-Lived Access Token in Home Assistant:
   - Go to your profile → Long-Lived Access Tokens
   - Create a new token and copy it to your `.env` file

2. Create an automation in Home Assistant:
```yaml
automation:
  - alias: "All Tasks Complete"
    trigger:
      - platform: event
        event_type: all_tasks_complete
    action:
      - service: notify.mobile_app_your_phone
        data:
          message: "All tasks completed for today!"
      # Add your desired actions here
```

3. Create a service to trigger the automation:
   - In Home Assistant, create a service that can be called via REST API
   - Update the `entity_id` in `/app/api/home-assistant/trigger/route.ts` to match your automation

### Option 2: Webhook

1. Create a webhook in Home Assistant:
   - Go to Configuration → Automations & Scenes → Webhooks
   - Create a new webhook and copy the ID to your `.env` file

2. Create an automation that triggers on the webhook:
```yaml
automation:
  - alias: "All Tasks Complete"
    trigger:
      - platform: webhook
        webhook_id: your_webhook_id_here
    action:
      - service: notify.mobile_app_your_phone
        data:
          message: "All tasks completed for today!"
```

## Usage

1. **Add Children**: First, you'll need to add children through the API or directly in the database. You can use Prisma Studio:
   ```bash
   npm run db:studio
   ```

2. **Create Tasks**: Click "Add New Task" to create tasks with due dates and assign them to children.

3. **Create Recurrence Templates**: Click "Manage Recurrence Templates" to create reusable recurrence patterns (daily, weekly, monthly).

4. **Complete Tasks**: Check off tasks as they're completed. When all tasks for a day are complete, the app will automatically trigger your Home Assistant automation.

## Project Structure

```
TaskCalendar/
├── app/
│   ├── api/              # API routes
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main page
├── components/           # React components
│   ├── Calendar.tsx
│   ├── TaskForm.tsx
│   └── RecurrenceTemplateManager.tsx
├── lib/
│   └── prisma.ts         # Prisma client
├── prisma/
│   └── schema.prisma     # Database schema
└── types/
    └── index.ts          # TypeScript types
```

## Database Schema

- **Child**: Stores children information
- **Task**: Stores tasks with due dates, completion status, and assignments
- **RecurrenceTemplate**: Stores reusable recurrence patterns

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:studio` - Open Prisma Studio to manage database
- `npm run db:push` - Push schema changes to database

## Next Steps

- Add user authentication
- Add email/notification reminders
- Implement automatic task generation from recurrence templates
- Add task history and statistics
- Improve mobile responsiveness
- Add dark mode support

## License

MIT

