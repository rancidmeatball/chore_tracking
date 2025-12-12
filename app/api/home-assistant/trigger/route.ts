import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date } = body

    const homeAssistantUrl = process.env.HOME_ASSISTANT_URL
    const homeAssistantToken = process.env.HOME_ASSISTANT_TOKEN
    const webhookId = process.env.HOME_ASSISTANT_WEBHOOK_ID

    if (!homeAssistantUrl || !homeAssistantToken) {
      return NextResponse.json(
        {
          error: 'Home Assistant configuration missing',
          message: 'Please set HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN in your .env file',
        },
        { status: 500 }
      )
    }

    // Option 1: Use REST API to trigger an automation
    // This requires creating a service/automation in Home Assistant
    const response = await fetch(`${homeAssistantUrl}/api/services/automation/trigger`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${homeAssistantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity_id: 'automation.all_tasks_complete', // You'll need to create this automation
        variables: {
          date: date,
        },
      }),
    })

    // Option 2: Use webhook (if webhookId is configured)
    if (webhookId && !response.ok) {
      const webhookResponse = await fetch(
        `${homeAssistantUrl}/api/webhook/${webhookId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: 'all_tasks_complete',
            date: date,
          }),
        }
      )

      if (webhookResponse.ok) {
        return NextResponse.json({
          success: true,
          method: 'webhook',
          message: 'Home Assistant webhook triggered successfully',
        })
      }
    }

    if (response.ok) {
      return NextResponse.json({
        success: true,
        method: 'rest_api',
        message: 'Home Assistant automation triggered successfully',
      })
    } else {
      const errorText = await response.text()
      return NextResponse.json(
        {
          error: 'Failed to trigger Home Assistant',
          details: errorText,
        },
        { status: response.status }
      )
    }
  } catch (error) {
    console.error('Error triggering Home Assistant:', error)
    return NextResponse.json(
      {
        error: 'Failed to trigger Home Assistant',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

