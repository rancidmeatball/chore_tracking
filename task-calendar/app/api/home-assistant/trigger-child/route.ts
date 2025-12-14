import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputBoolean, date } = body

    if (!inputBoolean) {
      return NextResponse.json(
        {
          error: 'inputBoolean entity_id is required',
        },
        { status: 400 }
      )
    }

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

    console.log(`[HOME ASSISTANT] Turning on ${inputBoolean} - Child's tasks completed for ${date}`)

    // Call Home Assistant service to turn on the input_boolean
    const response = await fetch(`${homeAssistantUrl}/api/services/input_boolean/turn_on`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${homeAssistantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity_id: inputBoolean,
      }),
    })

    if (response.ok) {
      console.log(`[HOME ASSISTANT] Successfully turned on ${inputBoolean}`)
      return NextResponse.json({
        success: true,
        message: `Input boolean ${inputBoolean} turned on successfully`,
        date: date,
      })
    } else {
      const errorText = await response.text()
      console.error(`[HOME ASSISTANT] Failed to turn on ${inputBoolean}:`, errorText)
      return NextResponse.json(
        {
          error: 'Failed to turn on input boolean',
          details: errorText,
        },
        { status: response.status }
      )
    }
  } catch (error) {
    console.error('Error turning on child input boolean:', error)
    return NextResponse.json(
      {
        error: 'Failed to turn on input boolean',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

