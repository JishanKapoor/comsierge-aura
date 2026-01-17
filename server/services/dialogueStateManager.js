/**
 * Dialogue State Manager - LangGraph-based Finite State Machine
 * 
 * Uses AI for intent classification, not regex.
 * Proper state management with nodes and edges.
 */

import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import ConversationState from "../models/ConversationState.js";
import Rule from "../models/Rule.js";
import User from "../models/User.js";

// Initialize LLM for intent classification
const llm = new ChatOpenAI({
  modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// INTENT CLASSIFICATION (AI-POWERED)
// ============================================

const INTENT_CLASSIFICATION_PROMPT = `You are an intent classifier for a communication management AI.
Classify the user's message into ONE of these intents with a priority score (1-100).

INTENT CATEGORIES:

EMERGENCY (Priority 95-100):
- emergency_medical: Health crisis, injury, hospitalization ("I fell", "hospital", "can't breathe", "heart attack")
- emergency_safety: Physical danger, threat ("someone's breaking in", "I'm scared", "help me")
- emergency_family: Family crisis ("mom's in hospital", "accident", "died")

URGENT (Priority 70-85):
- plea_urgent: Strong emotional plea with urgency ("I really need you", "please call now", "it's important")
- plea_soft: Gentle request for attention ("I miss you", "can we talk?")

LOCATION/AVAILABILITY (Priority 40-50):
- location_query: Asking where someone is ("where are you?", "are you home?")
- availability_query: Asking about timing ("when will you be back?", "are you free?")
- activity_query: Asking what someone is doing ("what are you up to?", "wyd")

SCHEDULING (Priority 50-60):
- meeting_request: Asking for a meeting ("can we meet?", "let's schedule a call")
- proposal_time: Proposing a specific time ("how about 2:30?", "let's do Tuesday")
- proposal_correction: Changing a proposed time ("actually make it 3", "can we do later?")
- confirmation: Confirming something ("yes", "that works", "confirmed", "sounds good")
- rejection: Declining ("no", "can't make it", "doesn't work")

IDENTIFICATION (Priority 30-40):
- identification_success: Clear name provided ("It's Dave", "This is John Smith")
- identification_vague: Unclear identification ("it's me", "the guy from yesterday")
- greeting: Simple hello ("hi", "hello", "hey")

OVERRIDE (Priority 100):
- vip_override_code: A code word bypass (exact match required, provided in context)

SENSITIVE DATA (Priority 80-90):
- 2fa_code: Two-factor authentication code ("Your code is 1234", "verification code")
- fraud_alert: Bank fraud/security alert ("did you spend", "suspicious activity", "unauthorized")
- financial_sensitive: Account numbers, SSN, passwords

OTHER (Priority 20-30):
- call_request: Asking for a call ("call me", "give me a ring")
- acknowledgment: Simple acknowledgment ("ok", "thanks", "got it")
- statement: General statement, no clear intent

CONTEXT:
- Current State: {current_state}
- Contact Name: {contact_name}
- VIP Code Words: {vip_codes}
- Active Rules: {active_rules}

MESSAGE: "{message}"

Respond with JSON only:
{
  "intent": "intent_name",
  "priority": 85,
  "confidence": 0.95,
  "reasoning": "brief explanation",
  "extracted_data": {
    "time_mentioned": null,
    "name_mentioned": null,
    "code_detected": null
  }
}`;

/**
 * AI-powered intent classification
 */
export async function classifyIntent(message, context = {}) {
  const prompt = INTENT_CLASSIFICATION_PROMPT
    .replace("{message}", message)
    .replace("{current_state}", context.currentState || "IDLE")
    .replace("{contact_name}", context.contactName || "Unknown")
    .replace("{vip_codes}", context.vipCodes?.join(", ") || "none")
    .replace("{active_rules}", context.activeRules || "none");

  try {
    const response = await llm.invoke([
      new SystemMessage(prompt),
      new HumanMessage(message)
    ]);

    let content = response.content.trim();
    if (content.startsWith("```json")) content = content.slice(7);
    if (content.startsWith("```")) content = content.slice(3);
    if (content.endsWith("```")) content = content.slice(0, -3);

    return JSON.parse(content.trim());
  } catch (error) {
    console.error("Intent classification error:", error);
    return {
      intent: "unknown",
      priority: 10,
      confidence: 0,
      reasoning: "Classification failed",
      extracted_data: {}
    };
  }
}

// ============================================
// STATE DEFINITIONS
// ============================================

export const DialogueStates = {
  IDLE: "IDLE",
  BOUND: "BOUND",                     // Active deflection rule
  SCHEDULING_MODE: "SCHEDULING_MODE", // Negotiating meeting time
  DND_ACTIVE: "DND_ACTIVE",          // Do Not Disturb
  TEMP_WHITELIST: "TEMP_WHITELIST",  // VIP bypass active
  SCREENING_MODE: "SCREENING_MODE",   // Asking for identification
  FORWARDING: "FORWARDING",          // Ready to forward
  DESTROYED: "DESTROYED",            // Rule override triggered
  ESCALATED: "ESCALATED",            // Emergency escalation
};

// ============================================
// STATE GRAPH NODES
// ============================================

/**
 * Node: Classify Intent
 * First node - classifies the incoming message
 */
async function classifyIntentNode(state) {
  console.log("📊 [NODE] Classify Intent");
  
  const intentResult = await classifyIntent(state.message, {
    currentState: state.currentState,
    contactName: state.contactName,
    vipCodes: state.vipCodes,
    activeRules: state.activeRules?.map(r => r.rule).join("; "),
  });

  return {
    ...state,
    intent: intentResult.intent,
    intentPriority: intentResult.priority,
    intentConfidence: intentResult.confidence,
    intentReasoning: intentResult.reasoning,
    extractedData: intentResult.extracted_data,
  };
}

/**
 * Node: Check Emergency Override
 * Checks if message should trigger emergency escalation
 */
async function checkEmergencyNode(state) {
  console.log("🚨 [NODE] Check Emergency Override");
  
  const emergencyIntents = ["emergency_medical", "emergency_safety", "emergency_family"];
  const isEmergency = emergencyIntents.includes(state.intent);
  const priorityOverride = state.intentPriority >= 95;

  if (isEmergency || priorityOverride) {
    return {
      ...state,
      shouldEscalate: true,
      escalationReason: state.intentReasoning,
      nextState: DialogueStates.ESCALATED,
      action: {
        type: "EMERGENCY_ESCALATE",
        ringPhone: true,
        autoReply: `I am alerting ${state.userName || "the user"} right now. This is urgent.`,
        destroyRule: true,
      },
    };
  }

  return {
    ...state,
    shouldEscalate: false,
  };
}

/**
 * Node: Check VIP Bypass
 * Checks for code word override
 */
async function checkVIPBypassNode(state) {
  console.log("🔑 [NODE] Check VIP Bypass");

  if (state.intent === "vip_override_code" || 
      (state.vipCodes && state.vipCodes.some(code => 
        state.message.toLowerCase().includes(code.toLowerCase())))) {
    return {
      ...state,
      vipBypass: true,
      nextState: DialogueStates.TEMP_WHITELIST,
      action: {
        type: "VIP_BYPASS",
        whitelistDuration: 15, // minutes
        autoReply: "Connecting you now.",
        allowCalls: true,
      },
    };
  }

  return {
    ...state,
    vipBypass: false,
  };
}

/**
 * Node: Check Sensitive Data
 * Blocks forwarding of 2FA codes, fraud alerts, etc.
 */
async function checkSensitiveDataNode(state) {
  console.log("🔒 [NODE] Check Sensitive Data");

  const sensitiveIntents = ["2fa_code", "fraud_alert", "financial_sensitive"];
  
  if (sensitiveIntents.includes(state.intent)) {
    const isFraud = state.intent === "fraud_alert";
    
    return {
      ...state,
      sensitiveData: true,
      blockForwarding: true,
      action: {
        type: isFraud ? "HOLD_SPAM" : "BLOCK_FORWARD_SENSITIVE",
        holdMessage: true,
        markAsSpam: isFraud,
        log: isFraud 
          ? "Fraud alert detected - held for user review"
          : `Blocked ${state.intent} from forwarding - security risk`,
        notifyUser: isFraud,
        autoReply: null, // Silent block
      },
    };
  }

  return {
    ...state,
    sensitiveData: false,
    blockForwarding: false,
  };
}

/**
 * Node: Handle Screening Mode
 * Manages unknown caller identification flow
 */
async function handleScreeningNode(state) {
  console.log("🔍 [NODE] Handle Screening");

  // If not in screening mode and this is an unknown contact, start screening
  if (state.currentState === DialogueStates.IDLE && state.isUnknownContact) {
    return {
      ...state,
      nextState: DialogueStates.SCREENING_MODE,
      screeningAttempts: 0,
      action: {
        type: "START_SCREENING",
        autoReply: `This is ${state.userName || "the user"}'s AI. Who is calling and is it urgent?`,
      },
    };
  }

  // Already in screening mode
  if (state.currentState === DialogueStates.SCREENING_MODE) {
    const attempts = (state.screeningAttempts || 0) + 1;

    if (state.intent === "identification_success") {
      return {
        ...state,
        nextState: DialogueStates.FORWARDING,
        identifiedName: state.extractedData?.name_mentioned,
        action: {
          type: "SCREENING_SUCCESS",
          forwardToUser: true,
          forwardMessage: `${state.extractedData?.name_mentioned || "Someone"} is trying to reach you. Allow?`,
        },
      };
    }

    if (state.intent === "identification_vague") {
      if (attempts >= 2) {
        return {
          ...state,
          screeningAttempts: attempts,
          action: {
            type: "SCREENING_SOFT_FAIL",
            autoReply: "I can't put you through without a name. Please state your name or text directly.",
          },
        };
      }

      return {
        ...state,
        screeningAttempts: attempts,
        action: {
          type: "SCREENING_CHALLENGE",
          autoReply: "Sorry, I don't have this number saved. What is your name?",
        },
      };
    }
  }

  return state;
}

/**
 * Node: Handle Scheduling Mode
 * Manages meeting negotiation flow
 */
async function handleSchedulingNode(state) {
  console.log("📅 [NODE] Handle Scheduling");

  // Check if this should trigger scheduling mode
  if (state.intent === "meeting_request" && state.currentState === DialogueStates.IDLE) {
    // TODO: Check actual calendar
    const availableSlots = state.calendarSlots || ["2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM"];
    
    return {
      ...state,
      nextState: DialogueStates.SCHEDULING_MODE,
      proposedSlots: availableSlots,
      tempSlot: null,
      action: {
        type: "OFFER_SLOTS",
        autoReply: `${state.userName || "They"} are free tomorrow between 2 PM and 4 PM. Do any of those work?`,
      },
    };
  }

  // Already in scheduling mode
  if (state.currentState === DialogueStates.SCHEDULING_MODE) {
    if (state.intent === "proposal_time" || state.intent === "proposal_correction") {
      const proposedTime = state.extractedData?.time_mentioned || state.message;
      
      return {
        ...state,
        tempSlot: proposedTime,
        action: {
          type: "VALIDATE_SLOT",
          autoReply: `${proposedTime} works. Shall I lock that in for you?`,
        },
      };
    }

    if (state.intent === "confirmation" && state.tempSlot) {
      return {
        ...state,
        nextState: DialogueStates.IDLE,
        confirmedSlot: state.tempSlot,
        action: {
          type: "BOOK_MEETING",
          bookCalendar: true,
          sendInvite: true,
          forwardToUser: true,
          autoReply: `Perfect! ${state.tempSlot} is booked. A calendar invite will be sent shortly.`,
          forwardMessage: `Meeting booked with ${state.contactName} at ${state.tempSlot}`,
        },
      };
    }

    if (state.intent === "rejection") {
      return {
        ...state,
        nextState: DialogueStates.IDLE,
        action: {
          type: "CANCEL_SCHEDULING",
          autoReply: "No problem. Let me know if you'd like to reschedule later.",
        },
      };
    }
  }

  return state;
}

/**
 * Node: Handle Bound State (Active Deflection)
 * Manages active rule deflection
 */
async function handleBoundStateNode(state) {
  console.log("🔗 [NODE] Handle Bound State");

  // Skip if emergency was triggered
  if (state.shouldEscalate) {
    return {
      ...state,
      nextState: DialogueStates.DESTROYED,
      action: {
        ...state.action,
        destroyRule: true,
      },
    };
  }

  // If in BOUND state, use rule's follow-up responses
  if (state.currentState === DialogueStates.BOUND) {
    const rule = state.activeRule;
    const scope = rule?.conversationScope || {};
    const followUps = scope.followUpResponses || {};
    
    // Get appropriate response based on intent
    let response = followUps[state.intent] || 
                   followUps.default || 
                   rule?.transferDetails?.autoReplyMessage ||
                   "I'll get back to you when I'm available.";

    // Check for plea escalation (not emergency, but more urgent)
    if (state.intent === "plea_urgent" && state.intentPriority >= 70) {
      response = "I'll call you as soon as I'm free.";
    }

    return {
      ...state,
      action: {
        type: "DEFLECT",
        autoReply: response,
        maintainState: true,
      },
    };
  }

  // Check if should enter BOUND state (has matching active rule)
  if (state.matchingRule && state.currentState === DialogueStates.IDLE) {
    return {
      ...state,
      nextState: DialogueStates.BOUND,
      activeRule: state.matchingRule,
      action: {
        type: "ACTIVATE_DEFLECTION",
        autoReply: state.matchingRule.transferDetails?.autoReplyMessage || "I'm tied up with work right now.",
        createState: true,
      },
    };
  }

  return state;
}

/**
 * Node: Determine Final Action
 * Decides final response and state transition
 */
async function determineFinalActionNode(state) {
  console.log("🎯 [NODE] Determine Final Action");

  // Priority order:
  // 1. Emergency escalation
  // 2. VIP bypass
  // 3. Sensitive data block
  // 4. Scheduling
  // 5. Screening
  // 6. Bound deflection
  // 7. Default pass-through

  if (state.shouldEscalate) {
    return {
      ...state,
      finalAction: state.action,
      finalState: DialogueStates.ESCALATED,
    };
  }

  if (state.vipBypass) {
    return {
      ...state,
      finalAction: state.action,
      finalState: DialogueStates.TEMP_WHITELIST,
    };
  }

  if (state.blockForwarding) {
    return {
      ...state,
      finalAction: state.action,
      finalState: state.currentState,
    };
  }

  if (state.action) {
    return {
      ...state,
      finalAction: state.action,
      finalState: state.nextState || state.currentState,
    };
  }

  // Default: pass through
  return {
    ...state,
    finalAction: {
      type: "PASS_THROUGH",
      autoReply: null,
      forward: true,
    },
    finalState: DialogueStates.IDLE,
  };
}

// ============================================
// BUILD THE STATE GRAPH
// ============================================

function buildDialogueGraph() {
  // Define the graph with annotation-style state
  const graph = new StateGraph({
    channels: {
      // Input
      message: { value: (x, y) => y ?? x, default: () => null },
      userId: { value: (x, y) => y ?? x, default: () => null },
      contactPhone: { value: (x, y) => y ?? x, default: () => null },
      contactName: { value: (x, y) => y ?? x, default: () => null },
      userName: { value: (x, y) => y ?? x, default: () => null },
      isUnknownContact: { value: (x, y) => y ?? x, default: () => false },
      vipCodes: { value: (x, y) => y ?? x, default: () => [] },
      activeRules: { value: (x, y) => y ?? x, default: () => [] },
      matchingRule: { value: (x, y) => y ?? x, default: () => null },
      currentState: { value: (x, y) => y ?? x, default: () => DialogueStates.IDLE },
      calendarSlots: { value: (x, y) => y ?? x, default: () => [] },
      
      // Classification results
      intent: { value: (x, y) => y ?? x, default: () => null },
      intentPriority: { value: (x, y) => y ?? x, default: () => 0 },
      intentConfidence: { value: (x, y) => y ?? x, default: () => 0 },
      intentReasoning: { value: (x, y) => y ?? x, default: () => null },
      extractedData: { value: (x, y) => y ?? x, default: () => ({}) },
      
      // State tracking
      shouldEscalate: { value: (x, y) => y ?? x, default: () => false },
      vipBypass: { value: (x, y) => y ?? x, default: () => false },
      sensitiveData: { value: (x, y) => y ?? x, default: () => false },
      blockForwarding: { value: (x, y) => y ?? x, default: () => false },
      screeningAttempts: { value: (x, y) => y ?? x, default: () => 0 },
      tempSlot: { value: (x, y) => y ?? x, default: () => null },
      proposedSlots: { value: (x, y) => y ?? x, default: () => [] },
      activeRule: { value: (x, y) => y ?? x, default: () => null },
      nextState: { value: (x, y) => y ?? x, default: () => null },
      
      // Output
      action: { value: (x, y) => y ?? x, default: () => null },
      finalAction: { value: (x, y) => y ?? x, default: () => null },
      finalState: { value: (x, y) => y ?? x, default: () => DialogueStates.IDLE },
    }
  });

  // Add nodes
  graph.addNode("classify_intent", classifyIntentNode);
  graph.addNode("check_emergency", checkEmergencyNode);
  graph.addNode("check_vip_bypass", checkVIPBypassNode);
  graph.addNode("check_sensitive", checkSensitiveDataNode);
  graph.addNode("handle_screening", handleScreeningNode);
  graph.addNode("handle_scheduling", handleSchedulingNode);
  graph.addNode("handle_bound", handleBoundStateNode);
  graph.addNode("determine_action", determineFinalActionNode);

  // Define edges (flow)
  graph.setEntryPoint("classify_intent");
  
  graph.addEdge("classify_intent", "check_emergency");
  graph.addEdge("check_emergency", "check_vip_bypass");
  graph.addEdge("check_vip_bypass", "check_sensitive");
  graph.addEdge("check_sensitive", "handle_screening");
  graph.addEdge("handle_screening", "handle_scheduling");
  graph.addEdge("handle_scheduling", "handle_bound");
  graph.addEdge("handle_bound", "determine_action");
  graph.addEdge("determine_action", END);

  return graph.compile();
}

// Singleton graph instance
let dialogueGraph = null;

function getDialogueGraph() {
  if (!dialogueGraph) {
    dialogueGraph = buildDialogueGraph();
  }
  return dialogueGraph;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Process an incoming message through the dialogue state manager
 */
export async function processMessage(params) {
  const {
    message,
    userId,
    contactPhone,
    contactName,
    userName,
    isUnknownContact = false,
    vipCodes = [],
    activeRules = [],
    matchingRule = null,
    currentState = DialogueStates.IDLE,
    calendarSlots = [],
    existingConversationState = null,
  } = params;

  console.log("\n" + "=".repeat(60));
  console.log("🧠 DIALOGUE STATE MANAGER");
  console.log("=".repeat(60));
  console.log(`Message: "${message}"`);
  console.log(`From: ${contactName} (${contactPhone})`);
  console.log(`Current State: ${currentState}`);
  console.log("=".repeat(60));

  const graph = getDialogueGraph();

  // Build initial state
  const initialState = {
    message,
    userId,
    contactPhone,
    contactName,
    userName,
    isUnknownContact,
    vipCodes,
    activeRules,
    matchingRule,
    currentState: existingConversationState?.state || currentState,
    calendarSlots,
    screeningAttempts: existingConversationState?.screeningAttempts || 0,
    tempSlot: existingConversationState?.tempSlot || null,
    activeRule: existingConversationState?.activeRule || matchingRule,
  };

  // Run the graph
  const result = await graph.invoke(initialState);

  console.log("\n📤 RESULT:");
  console.log(`   Intent: ${result.intent} (priority: ${result.intentPriority})`);
  console.log(`   Final State: ${result.finalState}`);
  console.log(`   Action: ${result.finalAction?.type}`);
  console.log(`   Auto-Reply: ${result.finalAction?.autoReply || "(none)"}`);
  console.log("=".repeat(60) + "\n");

  return {
    intent: result.intent,
    intentPriority: result.intentPriority,
    intentConfidence: result.intentConfidence,
    reasoning: result.intentReasoning,
    extractedData: result.extractedData,
    previousState: currentState,
    newState: result.finalState,
    action: result.finalAction,
    stateData: {
      screeningAttempts: result.screeningAttempts,
      tempSlot: result.tempSlot,
      activeRule: result.activeRule,
    },
  };
}

/**
 * Save conversation state to database
 */
export async function saveConversationState(userId, contactPhone, stateData) {
  const {
    newState,
    stateData: extraData,
    action,
  } = stateData;

  // Find or create conversation state
  let convState = await ConversationState.findOne({
    userId,
    contactPhone,
    active: true,
  });

  if (convState) {
    convState.state = newState;
    convState.screeningAttempts = extraData.screeningAttempts;
    convState.tempSlot = extraData.tempSlot;
    if (action?.destroyRule) {
      convState.active = false;
    }
    await convState.save();
  } else if (action?.createState) {
    convState = await ConversationState.create({
      userId,
      contactPhone,
      state: newState,
      active: true,
      screeningAttempts: extraData.screeningAttempts || 0,
      tempSlot: extraData.tempSlot,
      ruleId: extraData.activeRule?._id,
    });
  }

  return convState;
}

export default { processMessage, saveConversationState, classifyIntent, DialogueStates };
