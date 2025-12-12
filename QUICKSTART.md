# Quick Start Guide

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Environment

Create a `.env` file in the root directory:

```env
DATABASE_URL="file:./dev.db"
HOME_ASSISTANT_URL="http://homeassistant.local:8123"
HOME_ASSISTANT_TOKEN="your_token_here"
HOME_ASSISTANT_WEBHOOK_ID="your_webhook_id_here"
```

**Note:** Home Assistant configuration is optional. You can leave those fields empty if you're not using Home Assistant integration yet.

## Step 3: Initialize Database

```bash
npx prisma generate
npx prisma db push
```

## Step 4: Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 5: Add Your First Child

1. Click the "Add Child" button on the main page
2. Enter a child's name and click "Add"

## Step 6: Create Tasks

1. Click "Add New Task"
2. Fill in the task details:
   - Title (required)
   - Description (optional)
   - Due Date (required)
   - Assign to a child (required)
   - Optionally select a recurrence template

## Step 7: Create Recurrence Templates (Optional)

1. Click "Manage Recurrence Templates"
2. Click "Create New Template"
3. Fill in:
   - Name (e.g., "Weekly Chores")
   - Frequency (Daily, Weekly, or Monthly)
   - For Weekly: Select day of week
   - For Monthly: Enter day of month (1-31)

## Step 8: Complete Tasks

- Check off tasks as they're completed
- When all tasks for a day are complete, the app will automatically trigger your Home Assistant automation (if configured)

## Home Assistant Setup

### Get a Long-Lived Access Token

1. In Home Assistant, go to your profile (bottom left)
2. Scroll down to "Long-Lived Access Tokens"
3. Click "Create Token"
4. Copy the token to your `.env` file as `HOME_ASSISTANT_TOKEN`

### Create an Automation

Create an automation in Home Assistant that triggers when all tasks are complete. You can use either:

1. **REST API method**: Create an automation that can be triggered via the REST API
2. **Webhook method**: Create a webhook and set up an automation that listens to it

See the main README.md for detailed Home Assistant setup instructions.

## Troubleshooting

### Database Issues

If you encounter database errors:
```bash
npx prisma db push --force-reset
```

**Warning:** This will delete all data!

### Home Assistant Not Working

- Verify your `HOME_ASSISTANT_URL` is correct
- Check that your token has proper permissions
- Ensure Home Assistant is accessible from your development machine
- Check the browser console and server logs for errors

## Next Steps

- Customize the UI to match your preferences
- Add more features like task history, statistics, or notifications
- Set up automatic task generation from recurrence templates
- Add user authentication if needed

