import express from 'express';
import AICall from '../models/AICall.js';
import {
  initiateAICall,
  generateAIResponse,
  generateContinueTwiML,
  handleCallCompleted
} from '../services/aiCallService.js';

const router = express.Router();

// Get base URL for webhooks
function getBaseUrl(req) {
  return process.env.RENDER_EXTERNAL_URL || 
         process.env.BASE_URL || 
         `${req.protocol}://${req.get('host')}`;
}

/**
 * POST /api/ai-calls/initiate/:id
 * Manually trigger an AI call (for testing or immediate calls)
 */
router.post('/initiate/:id', async (req, res) => {
  try {
    const aiCallId = req.params.id;
    const call = await initiateAICall(aiCallId);
    res.json({ 
      success: true, 
      callSid: call.sid,
      message: 'AI call initiated'
    });
  } catch (error) {
    console.error('Error initiating AI call:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai-calls/gather/:id
 * Webhook: Handle speech input from the person on the call
 */
router.post('/gather/:id', async (req, res) => {
  try {
    const aiCallId = req.params.id;
    const speechResult = req.body.SpeechResult;
    const baseUrl = getBaseUrl(req);
    
    console.log(`🎤 AI Call ${aiCallId} received speech:`, speechResult);

    if (!speechResult) {
      // No speech detected, ask again
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I didn't quite catch that. Could you say that again?</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}/api/ai-calls/gather/${aiCallId}" method="POST">
    <Say voice="Polly.Joanna"></Say>
  </Gather>
  <Say voice="Polly.Joanna">I'm having trouble hearing you. Let me let you go. Goodbye!</Say>
  <Hangup/>
</Response>`);
      return;
    }

    // Generate AI response
    const { response, shouldEnd } = await generateAIResponse(aiCallId, speechResult);
    
    console.log(`🤖 AI Response:`, response, 'shouldEnd:', shouldEnd);

    // Return TwiML with AI response
    res.type('text/xml');
    res.send(generateContinueTwiML(response, aiCallId, baseUrl, shouldEnd));
    
  } catch (error) {
    console.error('Error in gather webhook:', error);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I'm having some technical difficulties. Let me call you back later. Goodbye!</Say>
  <Hangup/>
</Response>`);
  }
});

/**
 * POST /api/ai-calls/status/:id
 * Webhook: Handle call status updates
 */
router.post('/status/:id', async (req, res) => {
  try {
    const aiCallId = req.params.id;
    const callStatus = req.body.CallStatus;
    const callDuration = req.body.CallDuration;
    
    console.log(`📞 AI Call ${aiCallId} status update:`, callStatus);

    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus)) {
      await handleCallCompleted(aiCallId, callStatus);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error in status webhook:', error);
    res.sendStatus(500);
  }
});

/**
 * GET /api/ai-calls/:id
 * Get details of an AI call
 */
router.get('/:id', async (req, res) => {
  try {
    const aiCall = await AICall.findById(req.params.id);
    if (!aiCall) {
      return res.status(404).json({ error: 'AI Call not found' });
    }
    res.json(aiCall);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai-calls/user/:userId
 * Get all AI calls for a user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const aiCalls = await AICall.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(aiCalls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai-calls/create
 * Create a new AI call (can be immediate or scheduled)
 */
router.post('/create', async (req, res) => {
  try {
    const { userId, contactPhone, contactName, objective, scriptPoints, scheduledAt, voiceStyle } = req.body;

    if (!userId || !contactPhone || !objective) {
      return res.status(400).json({ error: 'userId, contactPhone, and objective are required' });
    }

    const aiCall = await AICall.create({
      userId,
      contactPhone,
      contactName: contactName || 'Unknown',
      objective,
      scriptPoints: scriptPoints || [],
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      voiceStyle: voiceStyle || 'friendly',
      status: 'pending'
    });

    // If no scheduled time, initiate immediately
    if (!scheduledAt) {
      try {
        await initiateAICall(aiCall._id);
      } catch (callError) {
        aiCall.status = 'failed';
        aiCall.errorMessage = callError.message;
        await aiCall.save();
        return res.status(500).json({ error: `Failed to initiate call: ${callError.message}` });
      }
    }

    res.json({ 
      success: true, 
      aiCall,
      message: scheduledAt ? `AI call scheduled for ${new Date(scheduledAt).toLocaleString()}` : 'AI call initiated'
    });
  } catch (error) {
    console.error('Error creating AI call:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/ai-calls/:id
 * Cancel a pending AI call
 */
router.delete('/:id', async (req, res) => {
  try {
    const aiCall = await AICall.findById(req.params.id);
    if (!aiCall) {
      return res.status(404).json({ error: 'AI Call not found' });
    }

    if (aiCall.status === 'in-progress') {
      return res.status(400).json({ error: 'Cannot cancel a call in progress' });
    }

    aiCall.status = 'cancelled';
    await aiCall.save();

    res.json({ success: true, message: 'AI call cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
