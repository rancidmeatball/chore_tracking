import express from 'express';

const router = express.Router();

// POST /api/home-assistant/trigger
router.post('/trigger', async (req, res) => {
  try {
    const { date } = req.body;

    const homeAssistantUrl = process.env.HOME_ASSISTANT_URL || 'http://supervisor/core';
    const homeAssistantToken = process.env.HOME_ASSISTANT_TOKEN || process.env.SUPERVISOR_TOKEN;

    if (!homeAssistantToken) {
      return res.status(500).json({
        error: 'Home Assistant token missing',
        message: 'SUPERVISOR_TOKEN not available',
      });
    }

    const inputBooleanEntityId = process.env.HOME_ASSISTANT_INPUT_BOOLEAN || 'input_boolean.all_tasks_complete';

    console.log(`[HOME ASSISTANT] Turning on ${inputBooleanEntityId} - All tasks completed for ${date}`);

    const response = await fetch(`${homeAssistantUrl}/api/services/input_boolean/turn_on`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${homeAssistantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity_id: inputBooleanEntityId,
      }),
    });

    if (response.ok) {
      console.log(`[HOME ASSISTANT] Successfully turned on ${inputBooleanEntityId}`);
      return res.json({
        success: true,
        message: `Input boolean ${inputBooleanEntityId} turned on successfully`,
        date: date,
      });
    } else {
      const errorText = await response.text();
      console.error(`[HOME ASSISTANT] Failed to turn on ${inputBooleanEntityId}:`, errorText);
      return res.status(response.status).json({
        error: 'Failed to turn on input boolean',
        details: errorText,
      });
    }
  } catch (error) {
    console.error('Error turning on input boolean:', error);
    return res.status(500).json({
      error: 'Failed to turn on input boolean',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/home-assistant/trigger-child
router.post('/trigger-child', async (req, res) => {
  try {
    const { inputBoolean, date } = req.body;

    if (!inputBoolean) {
      return res.status(400).json({
        error: 'inputBoolean entity_id is required',
      });
    }

    const homeAssistantUrl = process.env.HOME_ASSISTANT_URL || 'http://supervisor/core';
    const homeAssistantToken = process.env.HOME_ASSISTANT_TOKEN || process.env.SUPERVISOR_TOKEN;

    if (!homeAssistantToken) {
      return res.status(500).json({
        error: 'Home Assistant token missing',
        message: 'SUPERVISOR_TOKEN not available',
      });
    }

    console.log(`[HOME ASSISTANT] Turning on ${inputBoolean} - Child's tasks completed for ${date}`);

    const response = await fetch(`${homeAssistantUrl}/api/services/input_boolean/turn_on`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${homeAssistantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity_id: inputBoolean,
      }),
    });

    if (response.ok) {
      console.log(`[HOME ASSISTANT] Successfully turned on ${inputBoolean}`);
      return res.json({
        success: true,
        message: `Input boolean ${inputBoolean} turned on successfully`,
        date: date,
      });
    } else {
      const errorText = await response.text();
      console.error(`[HOME ASSISTANT] Failed to turn on ${inputBoolean}:`, errorText);
      return res.status(response.status).json({
        error: 'Failed to turn on input boolean',
        details: errorText,
      });
    }
  } catch (error) {
    console.error('Error turning on child input boolean:', error);
    return res.status(500).json({
      error: 'Failed to turn on input boolean',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
