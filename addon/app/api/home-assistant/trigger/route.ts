import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date } = body

    // Use supervisor API when running as add-on
    const homeAssistantUrl = process.env.HOME_ASSISTANT_URL || 'http://supervisor/core'
    const homeAssistantToken = process.env.HOME_ASSISTANT_TOKEN || process.env.SUPERVISOR_TOKEN

    if (!homeAssistantToken) {
      return NextResponse.json(
        {
          error: 'Home Assistant token missing',
          message: 'SUPERVISOR_TOKEN not available',
        },
        { status: 500 }
      )
    }

    // Call Home Assistant service directly
    const response = await fetch(`${homeAssistantUrl}/api/services/automation/trigger`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${homeAssistantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity_id: 'automation.all_tasks_complete',
        variables: {
          date: date,
        },
      }),
    })

    if (response.ok) {
      return NextResponse.json({
        success: true,
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

