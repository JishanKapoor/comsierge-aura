import twilio from 'twilio';
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import AICall from '../models/AICall.js';
import User from '../models/User.js';
import TwilioAccount from '../models/TwilioAccount.js';

const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/**
 * Initiate an AI-powered autonomous call
 */
export async function initiateAICall(aiCallId) {
  const aiCall = await AICall.findById(aiCallId).populate('userId');
  if (!aiCall) throw new Error('AI Call not found');
  
  const user = aiCall.userId;
  if (!user) throw new Error('User not found');

  // Get Twilio account
  const twilioAccount = await TwilioAccount.findOne({
    $or: [
      { phoneNumbers: { $exists: true, $ne: [] } },
      { 'phoneAssignments.userId': user._id }
    ]
  });

  if (!twilioAccount) throw new Error('No Twilio account found');

  // Get from number
  let fromNumber = null;
  if (twilioAccount.phoneAssignments?.length > 0) {
    const assignment = twilioAccount.phoneAssignments.find(
      a => a.userId?.toString() === user._id.toString()
    );
    if (assignment) fromNumber = assignment.phoneNumber;
  }
  if (!fromNumber && twilioAccount.phoneNumbers?.length > 0) {
    fromNumber = twilioAccount.phoneNumbers[0];
  }

  if (!fromNumber) throw new Error('No phone number available');

  // Initialize Twilio client
  const client = twilio(twilioAccount.accountSid, twilioAccount.authToken);

  // Generate initial greeting based on objective
  const greeting = await generateGreeting(aiCall);
  
  // Store greeting as first transcript entry
  aiCall.transcript.push({
    speaker: 'ai',
    text: greeting,
    timestamp: new Date()
  });
  aiCall.status = 'in-progress';
  aiCall.startedAt = new Date();
  await aiCall.save();

  // Get the base URL for webhooks
  const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'https://comsierge-backend.onrender.com';

  // Create the call with TwiML that speaks and gathers response
  const call = await client.calls.create({
    to: aiCall.contactPhone,
    from: fromNumber,
    twiml: generateTwiML(greeting, aiCallId, baseUrl),
    statusCallback: `${baseUrl}/api/ai-calls/status/${aiCallId}`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
    record: true, // Record the call for transcription
  });

  aiCall.twilioCallSid = call.sid;
  await aiCall.save();

  console.log(`📞 AI Call initiated: ${call.sid} to ${aiCall.contactPhone}`);
  return call;
}

/**
 * Generate initial greeting based on objective
 */
async function generateGreeting(aiCall) {
  const voiceStyle = aiCall.voiceStyle || 'friendly';
  
  const stylePrompts = {
    friendly: "Be warm, personable, and use casual language.",
    professional: "Be polite, formal, and businesslike.",
    casual: "Be very relaxed and conversational, like talking to a friend."
  };

  const response = await llm.invoke([
    new SystemMessage(`You are an AI assistant making a phone call on behalf of someone.
Generate ONLY the opening greeting (1-2 sentences). Keep it natural and brief.
${stylePrompts[voiceStyle]}
Do NOT use any text formatting, asterisks, or special characters.
The person should feel like they're talking to a real person, not an AI.`),
    new HumanMessage(`Call objective: ${aiCall.objective}
Contact name: ${aiCall.contactName}
${aiCall.scriptPoints?.length > 0 ? `Key points to cover: ${aiCall.scriptPoints.join(', ')}` : ''}

Generate the opening greeting:`)
  ]);

  return response.content.trim();
}

/**
 * Generate AI response based on what the person said
 */
export async function generateAIResponse(aiCallId, humanSpeech) {
  const aiCall = await AICall.findById(aiCallId);
  if (!aiCall) throw new Error('AI Call not found');

  // Add human speech to transcript
  aiCall.transcript.push({
    speaker: 'human',
    text: humanSpeech,
    timestamp: new Date()
  });

  // Build conversation history for context
  const conversationHistory = aiCall.transcript.map(t => 
    `${t.speaker === 'ai' ? 'AI' : 'Person'}: ${t.text}`
  ).join('\n');

  // Check if we've covered all script points
  const scriptPoints = aiCall.scriptPoints || [];
  const completedPoints = aiCall.conversationState?.completedPoints || [];
  const remainingPoints = scriptPoints.filter(p => !completedPoints.includes(p));

  const response = await llm.invoke([
    new SystemMessage(`You are an AI assistant on a phone call. Your objective: ${aiCall.objective}

CONVERSATION SO FAR:
${conversationHistory}

${remainingPoints.length > 0 ? `POINTS STILL TO COVER: ${remainingPoints.join(', ')}` : 'All key points have been covered.'}

RULES:
1. Keep responses SHORT (1-2 sentences max)
2. Sound natural, like a real person on a phone
3. NO text formatting, asterisks, or special characters
4. If all points are covered and the conversation seems complete, say goodbye naturally
5. Listen and respond appropriately to what they said
6. If they seem busy or want to end the call, be respectful and wrap up

Generate your next response:`),
    new HumanMessage(`Person just said: "${humanSpeech}"

Your response:`)
  ]);

  const aiResponse = response.content.trim();

  // Add AI response to transcript
  aiCall.transcript.push({
    speaker: 'ai',
    text: aiResponse,
    timestamp: new Date()
  });

  // Check if any script points were covered in this exchange
  for (const point of remainingPoints) {
    if (aiResponse.toLowerCase().includes(point.toLowerCase()) || 
        humanSpeech.toLowerCase().includes(point.toLowerCase())) {
      aiCall.conversationState.completedPoints.push(point);
    }
  }

  // Check if call should end
  const shouldEnd = await shouldEndCall(aiCall, humanSpeech, aiResponse);
  
  await aiCall.save();
  
  return { response: aiResponse, shouldEnd };
}

/**
 * Determine if the call should end
 */
async function shouldEndCall(aiCall, humanSpeech, aiResponse) {
  const goodbyePhrases = ['goodbye', 'bye', 'talk later', 'gotta go', 'have a good', 'take care'];
  const combined = (humanSpeech + ' ' + aiResponse).toLowerCase();
  
  if (goodbyePhrases.some(phrase => combined.includes(phrase))) {
    return true;
  }
  
  // Check if all script points are covered
  const scriptPoints = aiCall.scriptPoints || [];
  const completedPoints = aiCall.conversationState?.completedPoints || [];
  if (scriptPoints.length > 0 && completedPoints.length >= scriptPoints.length) {
    // All points covered, maybe time to wrap up
    return combined.includes('thank') || combined.includes('appreciate') || aiCall.transcript.length > 10;
  }
  
  // Don't end too early
  return aiCall.transcript.length > 20; // Max 20 exchanges
}

/**
 * Generate TwiML for AI call
 */
export function generateTwiML(text, aiCallId, baseUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(text)}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}/api/ai-calls/gather/${aiCallId}" method="POST">
    <Say voice="Polly.Joanna"></Say>
  </Gather>
  <Say voice="Polly.Joanna">I didn't catch that. Let me try again.</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}/api/ai-calls/gather/${aiCallId}" method="POST">
    <Say voice="Polly.Joanna"></Say>
  </Gather>
  <Say voice="Polly.Joanna">I'm having trouble hearing you. I'll let you go. Goodbye!</Say>
  <Hangup/>
</Response>`;
}

/**
 * Generate TwiML for continuing conversation
 */
export function generateContinueTwiML(text, aiCallId, baseUrl, shouldEnd = false) {
  if (shouldEnd) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(text)}</Say>
  <Hangup/>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(text)}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}/api/ai-calls/gather/${aiCallId}" method="POST">
    <Say voice="Polly.Joanna"></Say>
  </Gather>
  <Say voice="Polly.Joanna">Are you still there?</Say>
  <Gather input="speech" timeout="3" speechTimeout="auto" action="${baseUrl}/api/ai-calls/gather/${aiCallId}" method="POST">
    <Say voice="Polly.Joanna"></Say>
  </Gather>
  <Say voice="Polly.Joanna">I'll let you go. Take care!</Say>
  <Hangup/>
</Response>`;
}

/**
 * Generate call summary after completion
 */
export async function generateCallSummary(aiCallId) {
  const aiCall = await AICall.findById(aiCallId).populate('userId');
  if (!aiCall) throw new Error('AI Call not found');

  const transcript = aiCall.transcript.map(t => 
    `${t.speaker === 'ai' ? 'AI' : aiCall.contactName}: ${t.text}`
  ).join('\n');

  const response = await llm.invoke([
    new SystemMessage(`Summarize this phone call concisely. Include:
1. Brief summary (2-3 sentences)
2. Key points discussed
3. Any action items or follow-ups needed

Use plain text only, no markdown or formatting.`),
    new HumanMessage(`Call objective was: ${aiCall.objective}

Transcript:
${transcript}

Provide the summary:`)
  ]);

  const summaryText = response.content.trim();
  
  // Parse out key points and action items
  const lines = summaryText.split('\n');
  const keyPoints = [];
  const actionItems = [];
  
  let section = 'summary';
  let summaryLines = [];
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('key point') || lower.includes('discussed')) {
      section = 'keypoints';
    } else if (lower.includes('action') || lower.includes('follow')) {
      section = 'actions';
    } else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
      const item = line.replace(/^[-•*]\s*/, '').trim();
      if (section === 'keypoints') keyPoints.push(item);
      else if (section === 'actions') actionItems.push(item);
    } else if (section === 'summary' && line.trim()) {
      summaryLines.push(line.trim());
    }
  }

  aiCall.summary = summaryLines.join(' ') || summaryText;
  aiCall.keyPoints = keyPoints;
  aiCall.actionItems = actionItems;
  await aiCall.save();

  return aiCall;
}

/**
 * Notify user about completed call
 */
export async function notifyUserAboutCall(aiCallId) {
  const aiCall = await AICall.findById(aiCallId).populate('userId');
  if (!aiCall || aiCall.userNotified) return;

  const user = aiCall.userId;
  if (!user?.forwardingNumber) {
    console.log('Cannot notify user - no forwarding number');
    return;
  }

  // Get Twilio account
  const twilioAccount = await TwilioAccount.findOne({
    $or: [
      { phoneNumbers: { $exists: true, $ne: [] } },
      { 'phoneAssignments.userId': user._id }
    ]
  });

  if (!twilioAccount) return;

  let fromNumber = twilioAccount.phoneNumbers?.[0];
  if (!fromNumber) return;

  const client = twilio(twilioAccount.accountSid, twilioAccount.authToken);

  // Send SMS summary to user
  const message = `AI Call Complete to ${aiCall.contactName}:
${aiCall.summary || 'Call completed.'}
${aiCall.actionItems?.length > 0 ? '\nAction items: ' + aiCall.actionItems.join(', ') : ''}`;

  await client.messages.create({
    to: user.forwardingNumber,
    from: fromNumber,
    body: message.slice(0, 1600) // Twilio SMS limit
  });

  aiCall.userNotified = true;
  await aiCall.save();
  
  console.log(`✅ User notified about AI call to ${aiCall.contactName}`);
}

/**
 * Handle call completion
 */
export async function handleCallCompleted(aiCallId, callStatus) {
  const aiCall = await AICall.findById(aiCallId);
  if (!aiCall) return;

  aiCall.endedAt = new Date();
  if (aiCall.startedAt) {
    aiCall.durationSeconds = Math.round((aiCall.endedAt - aiCall.startedAt) / 1000);
  }

  if (callStatus === 'completed') {
    aiCall.status = 'completed';
    await aiCall.save();
    
    // Generate summary
    await generateCallSummary(aiCallId);
    
    // Notify user
    await notifyUserAboutCall(aiCallId);
  } else if (callStatus === 'no-answer' || callStatus === 'busy') {
    aiCall.status = 'no-answer';
    aiCall.errorMessage = `Call status: ${callStatus}`;
    await aiCall.save();
  } else if (callStatus === 'failed') {
    aiCall.status = 'failed';
    aiCall.errorMessage = `Call failed`;
    await aiCall.save();
  } else {
    aiCall.status = callStatus;
    await aiCall.save();
  }

  console.log(`📞 AI Call ${aiCallId} ended with status: ${aiCall.status}`);
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default {
  initiateAICall,
  generateAIResponse,
  generateTwiML,
  generateContinueTwiML,
  generateCallSummary,
  notifyUserAboutCall,
  handleCallCompleted
};
