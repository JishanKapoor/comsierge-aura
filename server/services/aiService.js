import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph, END, START } from "@langchain/langgraph";
import { z } from "zod";

// Initialize OpenAI with GPT-5.2 for complex analysis
const llm = new ChatOpenAI({
  modelName: "gpt-5.2",
  temperature: 0.2,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Fast model for quick classification (GPT-4o-mini)
const fastLlm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.1,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Schema for spam classification (multi-factor)
const SpamClassificationSchema = z.object({
  senderTrust: z.enum(["high", "medium", "low"]),
  intent: z.enum(["conversational", "informational", "transactional", "financial", "deceptive", "coercive", "promotional", "meta"]),
  behaviorPattern: z.enum(["normal", "suspicious", "scripted"]),
  contentRiskLevel: z.enum(["none", "low", "medium", "high"]),
  spamProbability: z.number().min(0).max(100),
  isSpam: z.boolean(),
  reasoning: z.string(),
});

// Schema for message analysis
const MessageAnalysisSchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
  shouldHold: z.boolean(),
  holdReason: z.string().optional(),
  category: z.enum(["inquiry", "complaint", "support", "sales", "spam", "personal", "urgent", "other"]),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  suggestedResponse: z.string(),
  keyTopics: z.array(z.string()),
  requiresHumanReview: z.boolean(),
  confidence: z.number().min(0).max(1),
  spamAnalysis: SpamClassificationSchema.optional(),
});

// Multi-Factor Spam Classification System Prompt
const SPAM_CLASSIFICATION_PROMPT = `You are an advanced spam classification AI for Comsierge, a business communication platform.

CRITICAL PRINCIPLE: The same message text can be spam or non-spam depending on WHO sent it and WHY.
NEVER classify spam based only on keywords. Keywords are signals, not rules.

You must evaluate FOUR independent dimensions:

## 1. SENDER TRUST (Most Important)
Before reading the message content, evaluate the sender:

HIGH TRUST (spam probability capped at 10%):
- Saved contact with name
- Marked as Family, Work, Friend, VIP, or Favorite
- Prior conversation history exists
- User has replied to this sender before
- Whitelisted number

MEDIUM TRUST:
- Unknown number but normal phone format
- First-time contact with standard area code
- No prior flags or issues

LOW TRUST:
- Unknown number from suspicious area code
- Short code or VoIP/virtual number range
- Previously flagged by other users
- Country mismatch with user's location
- No conversation history

RULE: If sender trust is HIGH → message is almost NEVER spam unless user explicitly flagged it.

## 2. INTENT CLASSIFICATION (What is the message trying to do?)

SPAM INTENTS (suspicious):
- Financial solicitation ("wire money", "investment opportunity")
- Credential harvesting ("verify your account", "confirm your password")
- Urgency/fear inducement ("account locked", "immediate action required")
- Prize/lottery claims ("you've won", "claim your prize")
- Impersonation ("I'm calling from [bank/IRS/etc]")

NON-SPAM INTENTS (legitimate):
- Conversational ("hey", "how are you", "what's up")
- Meta-discussion ("this looks like a spam message" - talking ABOUT spam is not spam)
- Jokes/humor
- Information sharing
- Work coordination
- Personal updates
- Questions/inquiries

CRITICAL: A message ABOUT spam is NOT spam. "This is a spam message" from a friend discussing spam is conversational.

## 3. BEHAVIORAL PATTERNS

NORMAL (non-spam):
- Natural conversational flow
- Varied wording across messages
- Responds appropriately to replies
- Human typing patterns

SUSPICIOUS/SCRIPTED (spam indicators):
- Same message sent to many users
- No reply handling (ignores responses)
- Repeated follow-ups without acknowledgment
- Copy-paste patterns
- Robotic/templated language
- Message timing bursts

## 4. CONTENT RISK SIGNALS (Lowest Weight - NEVER decides alone)

Risk indicators (weak signals only):
- Banking/crypto/wire transfer keywords
- Shortened/masked URLs
- Impersonation language
- Misspellings combined with urgency
- Request for personal information

These INCREASE suspicion but NEVER decide classification alone.

## DECISION LOGIC:

IF sender_trust == HIGH:
    RETURN not_spam (confidence: 95%+)
ELSE:
    IF intent is financial/deceptive/coercive AND behavior is suspicious:
        RETURN spam (with reasoning)
    ELSE:
        RETURN not_spam

## OUTPUT FORMAT (JSON):
{
  "senderTrust": "high" | "medium" | "low",
  "intent": "conversational" | "informational" | "transactional" | "financial" | "deceptive" | "coercive" | "promotional" | "meta",
  "behaviorPattern": "normal" | "suspicious" | "scripted",
  "contentRiskLevel": "none" | "low" | "medium" | "high",
  "spamProbability": 0-100,
  "isSpam": true | false,
  "reasoning": "Brief explanation of why this is/isn't spam"
}

SPAM THRESHOLD: Only classify as spam if spamProbability >= 70`;

// System prompt for message analysis
const ANALYSIS_SYSTEM_PROMPT = `You are an AI assistant for Comsierge, a communication management platform. 
Your job is to analyze incoming messages and provide actionable insights.

Analyze each message and determine:
1. Priority (high/medium/low):
   - HIGH: Urgent matters, emergencies, time-sensitive requests, angry customers, VIP contacts
   - MEDIUM: Standard business inquiries, follow-ups, general questions
   - LOW: Newsletters, promotional content, non-urgent messages

2. Should Hold (true/false):
   - Hold messages that need human review before responding
   - Hold sensitive topics, complaints, or complex requests
   - Don't hold simple inquiries

3. Category: inquiry, complaint, support, sales, spam, personal, urgent, other
   NOTE: For spam classification, use the multi-factor spam analysis provided.

4. Sentiment: positive, negative, neutral

5. Suggested Response: A professional, helpful response draft

6. Key Topics: Main subjects discussed in the message

7. Requires Human Review: true if the message is complex or sensitive

Always respond in valid JSON format matching the schema.`;

// LangGraph state definition
const graphState = {
  message: {
    value: (x, y) => y ?? x,
    default: () => "",
  },
  senderPhone: {
    value: (x, y) => y ?? x,
    default: () => "",
  },
  senderName: {
    value: (x, y) => y ?? x,
    default: () => "",
  },
  conversationHistory: {
    value: (x, y) => y ?? x,
    default: () => [],
  },
  senderContext: {
    value: (x, y) => y ?? x,
    default: () => ({
      isSavedContact: false,
      isFavorite: false,
      tags: [],
      hasConversationHistory: false,
      messageCount: 0,
      userHasReplied: false,
      isBlocked: false,
    }),
  },
  analysis: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  spamAnalysis: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  error: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
};

// Node: Fast Message Classification (INBOX / SPAM / HELD)
// Uses GPT-4o-mini for speed with your exact logic
async function classifySpam(state) {
  try {
    const { message, senderPhone, senderName, conversationHistory, senderContext } = state;
    
    // Calculate key variables
    const isSavedContact = senderContext.isSavedContact || senderContext.isFavorite || false;
    const userSentCount = conversationHistory ? conversationHistory.filter(m => m.direction === 'outbound').length : 0;
    
    // RULE 1: SAVED CONTACT → INBOX (instant, no AI needed)
    if (isSavedContact) {
      console.log("   [FastClassify] Saved contact → INBOX");
      return {
        ...state,
        spamAnalysis: {
          category: "INBOX",
          senderTrust: "high",
          intent: "conversational",
          behaviorPattern: "normal",
          contentRiskLevel: "none",
          spamProbability: 0,
          isSpam: false,
          isHeld: false,
          reasoning: "Saved contact - messages from contacts in address book are always delivered to inbox.",
        },
      };
    }
    
    // RULE 2: ESTABLISHED CONVERSATION (user has replied before)
    if (userSentCount > 0) {
      // Need AI to check for revoked consent or contextual banter
      const historyText = conversationHistory.slice(-10).map(m => 
        `${m.direction === 'outbound' ? 'YOU' : 'THEM'}: ${m.body || m.content || ''}`
      ).join('\n');
      
      const prompt = `You are a high-speed message classifier. The user has replied to this sender before (${userSentCount} times).

CONVERSATION HISTORY:
${historyText}

NEW MESSAGE: "${message}"

CHECK:
1. Did the user recently say "stop", "unsubscribe", or express disinterest, and the sender is persisting with sales/warranty/promo content?
   - If YES → category is "SPAM"
2. If no "stop" command, even if the new message LOOKS like spam (prank, weird link, "lol", joke), if history shows friendly/casual relationship:
   - category is "INBOX"

Respond with JSON only:
{"category": "INBOX" | "SPAM", "reason": "brief explanation"}`;

      const response = await fastLlm.invoke([
        new SystemMessage("You classify messages. Respond with JSON only. Be FAST."),
        new HumanMessage(prompt),
      ]);
      
      let result = { category: "INBOX", reason: "Established conversation" };
      try {
        const text = response.content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      } catch (e) { /* use default */ }
      
      console.log(`   [FastClassify] Established convo (${userSentCount} replies) → ${result.category}: ${result.reason}`);
      
      return {
        ...state,
        spamAnalysis: {
          category: result.category,
          senderTrust: "medium",
          intent: result.category === "SPAM" ? "promotional" : "conversational",
          behaviorPattern: result.category === "SPAM" ? "scripted" : "normal",
          contentRiskLevel: result.category === "SPAM" ? "medium" : "none",
          spamProbability: result.category === "SPAM" ? 85 : 5,
          isSpam: result.category === "SPAM",
          isHeld: false, // Never hold established conversations
          reasoning: result.reason,
        },
      };
    }
    
    // RULE 3: FIRST CONTACT (unknown sender, user never replied)
    // AI decides: obvious spam → SPAM, otherwise → HELD
    // SHORT/SIMPLE MESSAGES ARE NEVER SPAM - they go to HELD
    const msgLower = message.toLowerCase().trim();
    const shortGreetings = ['hey', 'hi', 'hello', 'yo', 'sup', 'hola', 'heya', 'hii', 'heyy', 'helloo', 'what\'s up', 'whats up', 'wassup', 'howdy', 'good morning', 'good afternoon', 'good evening', 'gm', 'morning'];
    const isSimpleGreeting = shortGreetings.some(g => msgLower === g || msgLower.startsWith(g + ' ') || msgLower.startsWith(g + '!') || msgLower.startsWith(g + '?'));
    const isShortMessage = message.length <= 20;
    
    // Simple greetings and very short messages are ALWAYS held, NEVER spam
    if (isSimpleGreeting || (isShortMessage && !message.includes('http') && !message.includes('$') && !message.includes('won'))) {
      console.log(`   [FastClassify] Short/greeting message → HELD (never spam for simple messages)`);
      return {
        ...state,
        spamAnalysis: {
          category: "HELD",
          senderTrust: "low",
          intent: "conversational",
          behaviorPattern: "normal",
          contentRiskLevel: "none",
          spamProbability: 5,
          isSpam: false,
          isHeld: true,
          reasoning: "Short greeting from unknown sender - held for review (never auto-spam simple messages)",
        },
      };
    }
    
    const prompt = `You are a high-speed spam classifier for FIRST-TIME messages from UNKNOWN senders.

MESSAGE: "${message}"
FROM: ${senderName || senderPhone || "Unknown"}

This is the FIRST message from this number. User has NEVER replied.

IMPORTANT: NEVER classify simple greetings, short messages, or ambiguous messages as SPAM.
ONLY classify as SPAM if it contains CLEAR spam indicators like:
- Financial scams (crypto schemes, wire money, investment returns)
- Phishing (verify account, confirm password, click suspicious link)
- Lottery/prize claims
- Unsolicited product sales (warranties, insurance)
- Mass-marketing templates

CLASSIFY:
- "SPAM" = ONLY for obvious automated scam/marketing messages
- "HELD" = Everything else (greetings, questions, unknown intent, personal messages)

When in doubt, ALWAYS choose HELD.

Respond with JSON only:
{"category": "SPAM" | "HELD", "reason": "brief explanation"}`;

    const response = await fastLlm.invoke([
      new SystemMessage("You classify first-contact messages. Respond with JSON only. Be FAST."),
      new HumanMessage(prompt),
    ]);
    
    let result = { category: "HELD", reason: "First contact - needs review" };
    try {
      const text = response.content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch (e) { /* use default */ }
    
    console.log(`   [FastClassify] First contact → ${result.category}: ${result.reason}`);
    
    return {
      ...state,
      spamAnalysis: {
        category: result.category,
        senderTrust: "low",
        intent: result.category === "SPAM" ? "deceptive" : "conversational",
        behaviorPattern: result.category === "SPAM" ? "scripted" : "normal",
        contentRiskLevel: result.category === "SPAM" ? "high" : "low",
        spamProbability: result.category === "SPAM" ? 90 : 30,
        isSpam: result.category === "SPAM",
        isHeld: result.category === "HELD",
        reasoning: result.reason,
      },
    };
  } catch (error) {
    console.error("Fast classification error:", error);
    // Default to HELD on error for safety
    return {
      ...state,
      spamAnalysis: {
        category: "HELD",
        senderTrust: "medium",
        intent: "conversational",
        behaviorPattern: "normal",
        contentRiskLevel: "none",
        spamProbability: 0,
        isSpam: false,
        isHeld: true,
        reasoning: "Classification error - holding for review",
      },
    };
  }
}

// Node: Analyze message
async function analyzeMessage(state) {
  try {
    const { message, senderPhone, senderName, conversationHistory, spamAnalysis } = state;
    
    // Build context from conversation history
    let historyContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = "\n\nRecent conversation history:\n" + 
        conversationHistory.slice(-5).map(msg => 
          `${msg.direction === 'inbound' ? 'Customer' : 'Agent'}: ${msg.content}`
        ).join("\n");
    }

    // Include spam analysis result in the prompt
    const spamContext = spamAnalysis 
      ? `\n\nSpam Analysis Result:
- Is Spam: ${spamAnalysis.isSpam}
- Spam Probability: ${spamAnalysis.spamProbability}%
- Reasoning: ${spamAnalysis.reasoning}`
      : "";

    const userPrompt = `Analyze this incoming message:

From: ${senderName || senderPhone || "Unknown"}
Phone: ${senderPhone || "Unknown"}
Message: "${message}"
${historyContext}
${spamContext}

Provide your analysis in JSON format with these fields:
- priority: "high" | "medium" | "low"
- shouldHold: boolean
- holdReason: string (only if shouldHold is true)
- category: "inquiry" | "complaint" | "support" | "sales" | "spam" | "personal" | "urgent" | "other"
  (Use "spam" ONLY if the spam analysis confirms isSpam: true)
- sentiment: "positive" | "negative" | "neutral"
- suggestedResponse: string
- keyTopics: string[]
- requiresHumanReview: boolean
- confidence: number (0-1)`;

    const response = await llm.invoke([
      new SystemMessage(ANALYSIS_SYSTEM_PROMPT),
      new HumanMessage(userPrompt),
    ]);

    // Parse the JSON response
    let analysisText = response.content;
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = analysisText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      analysisText = jsonMatch[1].trim();
    }
    
    const analysis = JSON.parse(analysisText);
    
    // Attach spam analysis to the result
    analysis.spamAnalysis = spamAnalysis;
    
    // Override category if spam analysis says not spam but category was set to spam
    if (spamAnalysis && !spamAnalysis.isSpam && analysis.category === "spam") {
      analysis.category = "other";
    }
    
    return {
      ...state,
      analysis,
    };
  } catch (error) {
    console.error("Analysis error:", error);
    return {
      ...state,
      error: error.message,
      analysis: {
        priority: "medium",
        shouldHold: true,
        holdReason: "AI analysis failed - requires human review",
        category: "other",
        sentiment: "neutral",
        suggestedResponse: "Thank you for your message. A team member will get back to you shortly.",
        keyTopics: [],
        requiresHumanReview: true,
        confidence: 0,
        spamAnalysis: state.spamAnalysis,
      },
    };
  }
}

// Node: Generate response
async function generateResponse(state) {
  try {
    const { message, senderName, analysis, conversationHistory } = state;
    
    if (!analysis || analysis.category === "spam") {
      return state;
    }

    // Build context from conversation history
    let historyContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = "\n\nConversation history:\n" + 
        conversationHistory.slice(-5).map(msg => 
          `${msg.direction === 'inbound' ? 'Customer' : 'Agent'}: ${msg.content}`
        ).join("\n");
    }

    const responsePrompt = `Based on this analysis, generate a professional response:

Customer Message: "${message}"
Customer Name: ${senderName || "Customer"}
Priority: ${analysis.priority}
Category: ${analysis.category}
Sentiment: ${analysis.sentiment}
${historyContext}

Generate a helpful, professional, and empathetic response. Keep it concise but thorough.
If the message is spam or promotional, suggest a brief acknowledgment or no response.`;

    const response = await llm.invoke([
      new SystemMessage("You are a professional customer service AI. Generate helpful, empathetic responses."),
      new HumanMessage(responsePrompt),
    ]);

    return {
      ...state,
      analysis: {
        ...analysis,
        suggestedResponse: response.content,
      },
    };
  } catch (error) {
    console.error("Response generation error:", error);
    return state;
  }
}

// Build the LangGraph workflow
function buildMessageAnalysisGraph() {
  const workflow = new StateGraph({
    channels: graphState,
  });

  // Add nodes
  workflow.addNode("classify_spam", classifySpam);
  workflow.addNode("analyze", analyzeMessage);
  workflow.addNode("generate_response", generateResponse);

  // Add edges - spam classification first, then analysis, then response
  workflow.addEdge(START, "classify_spam");
  workflow.addEdge("classify_spam", "analyze");
  workflow.addEdge("analyze", "generate_response");
  workflow.addEdge("generate_response", END);

  return workflow.compile();
}

// Create the compiled graph
let messageGraph = null;

function getMessageGraph() {
  if (!messageGraph) {
    messageGraph = buildMessageAnalysisGraph();
  }
  return messageGraph;
}

// Main analysis function with multi-factor spam classification
async function analyzeIncomingMessage(message, senderPhone, senderName, conversationHistory = [], senderContext = null) {
  const graph = getMessageGraph();
  
  // Default sender context if not provided
  const defaultSenderContext = {
    isSavedContact: false,
    isFavorite: false,
    tags: [],
    hasConversationHistory: conversationHistory.length > 0,
    messageCount: conversationHistory.length,
    userHasReplied: conversationHistory.some(m => m.direction === 'outbound'),
    isBlocked: false,
  };
  
  const result = await graph.invoke({
    message,
    senderPhone,
    senderName,
    conversationHistory,
    senderContext: senderContext || defaultSenderContext,
  });

  return result.analysis;
}

// Standalone spam classification (can be called separately)
async function classifyMessageAsSpam(message, senderPhone, senderName, senderContext = null, conversationHistory = []) {
  try {
    const defaultContext = {
      isSavedContact: false,
      isFavorite: false,
      tags: [],
      hasConversationHistory: conversationHistory.length > 0,
      messageCount: conversationHistory.length,
      userHasReplied: conversationHistory.some(m => m.direction === 'outbound'),
      isBlocked: false,
    };
    
    const state = {
      message,
      senderPhone,
      senderName,
      conversationHistory,
      senderContext: senderContext || defaultContext,
    };
    
    const result = await classifySpam(state);
    return result.spamAnalysis;
  } catch (error) {
    console.error("Spam classification error:", error);
    return {
      senderTrust: "medium",
      intent: "conversational",
      behaviorPattern: "normal",
      contentRiskLevel: "none",
      spamProbability: 0,
      isSpam: false,
      reasoning: "Classification error - defaulting to non-spam",
    };
  }
}

// Quick priority check (lighter weight)
async function quickPriorityCheck(message) {
  try {
    const response = await llm.invoke([
      new SystemMessage("You are a message priority classifier. Respond with ONLY one word: high, medium, or low"),
      new HumanMessage(`Classify the priority of this message: "${message}"`),
    ]);
    
    const priority = response.content.toLowerCase().trim();
    if (["high", "medium", "low"].includes(priority)) {
      return priority;
    }
    return "medium";
  } catch (error) {
    console.error("Priority check error:", error);
    return "medium";
  }
}

// Batch analyze multiple messages
async function batchAnalyzeMessages(messages) {
  const results = await Promise.all(
    messages.map(async (msg) => {
      const analysis = await analyzeIncomingMessage(
        msg.content,
        msg.senderPhone,
        msg.senderName,
        msg.conversationHistory || []
      );
      return {
        messageId: msg.id,
        ...analysis,
      };
    })
  );
  return results;
}

// Generate auto-response based on rules
async function generateAutoResponse(message, senderName, rules = []) {
  try {
    let rulesContext = "";
    if (rules.length > 0) {
      rulesContext = "\n\nActive automation rules:\n" + 
        rules.map(r => `- ${r.name}: ${r.description || r.condition}`).join("\n");
    }

    const response = await llm.invoke([
      new SystemMessage(`You are a professional AI assistant for Comsierge. Generate appropriate auto-responses based on the message context and any active rules.${rulesContext}`),
      new HumanMessage(`Generate an auto-response for this message from ${senderName || "a customer"}: "${message}"`),
    ]);

    return response.content;
  } catch (error) {
    console.error("Auto-response error:", error);
    return "Thank you for your message. A team member will get back to you shortly.";
  }
}

// Check if message should trigger a hold
async function shouldHoldMessage(message, senderName, existingRules = []) {
  try {
    const rulesText = existingRules.length > 0
      ? `\n\nActive hold rules:\n${existingRules.map(r => `- ${r.name}: ${r.condition}`).join("\n")}`
      : "";

    const response = await llm.invoke([
      new SystemMessage(`You are analyzing messages to determine if they should be held for human review. Consider sensitivity, complexity, and business rules.${rulesText}

Respond with JSON: { "shouldHold": boolean, "reason": string }`),
      new HumanMessage(`Should this message from ${senderName || "unknown"} be held?: "${message}"`),
    ]);

    let text = response.content;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[1] || jsonMatch[0];
    }
    
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Hold check error:", error);
    return { shouldHold: false, reason: "Analysis unavailable" };
  }
}

// Generate AI reply suggestions based on conversation context
async function generateReplySuggestions(conversationHistory, contactName) {
  // Use gpt-4o-mini for speed - it's fast and accurate for short replies
  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0.7,
    openAIApiKey: process.env.OPENAI_API_KEY,
    maxTokens: 200, // Limit output for speed
  });

  try {
    // Use last 5 messages - enough context without slowing things down
    const historyText = conversationHistory
      .slice(-5)
      .map(m => `${m.direction === 'incoming' ? (contactName || 'Contact') : 'You'}: ${m.content}`)
      .join('\n');

    // Get the last incoming message to focus the response
    const lastIncoming = conversationHistory
      .filter(m => m.direction === 'incoming')
      .slice(-1)[0];

    const response = await llm.invoke([
      new SystemMessage(`Generate 3 short reply suggestions for a text message conversation. Be concise and natural.
Rules:
- 1-2 sentences each, max 20 words
- Match the conversation's tone (casual/formal)
- Different approaches: 1) acknowledge/agree 2) ask/clarify 3) action/next step
- Return ONLY a JSON array of 3 strings`),
      new HumanMessage(`${historyText ? `Recent messages:\n${historyText}\n\n` : ''}Last message from ${contactName || 'Contact'}: "${lastIncoming?.content || 'Hello'}"`)
    ]);

    const text = response.content.trim();
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [
      "Got it, thanks!",
      "Can you tell me more?",
      "I'll take care of it."
    ];
  } catch (error) {
    console.error("Reply suggestions error:", error);
    return [
      "Got it, thanks!",
      "Can you tell me more?",
      "I'll take care of it."
    ];
  }
}

// Rewrite/improve a draft message
async function rewriteMessage(draftMessage, conversationHistory, contactName, style = "professional") {
  // Use gpt-4o-mini for speed
  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0.4,
    openAIApiKey: process.env.OPENAI_API_KEY,
    maxTokens: 150,
  });

  try {
    // Just use last 3 messages for context - enough to understand tone
    const historyText = conversationHistory
      .slice(-3)
      .map(m => `${m.direction === 'incoming' ? (contactName || 'Contact') : 'You'}: ${m.content}`)
      .join('\n');

    const response = await llm.invoke([
      new SystemMessage(`Improve this draft message. Keep it ${style}, fix errors, keep same meaning. Return ONLY the improved text.`),
      new HumanMessage(`${historyText ? `Context:\n${historyText}\n\n` : ''}Draft: "${draftMessage}"`)
    ]);

    return response.content.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error("Rewrite error:", error);
    const cleaned = draftMessage.replace(/\s+/g, " ").trim();
    const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
  }
}

export {
  analyzeIncomingMessage,
  classifyMessageAsSpam,
  quickPriorityCheck,
  batchAnalyzeMessages,
  generateAutoResponse,
  shouldHoldMessage,
  generateReplySuggestions,
  rewriteMessage,
  MessageAnalysisSchema,
  SpamClassificationSchema,
};
