import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph, END, START } from "@langchain/langgraph";
import { z } from "zod";

// Initialize OpenAI with GPT-5.2
const llm = new ChatOpenAI({
  modelName: "gpt-4o", // Using gpt-4o as fallback - change to gpt-5.2 when available
  temperature: 0.3,
  openAIApiKey: process.env.OPENAI_API_KEY,
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
});

// System prompt for message analysis
const ANALYSIS_SYSTEM_PROMPT = `You are an AI assistant for Comsierge, a communication management platform. 
Your job is to analyze incoming messages and provide actionable insights.

Analyze each message and determine:
1. Priority (high/medium/low):
   - HIGH: Urgent matters, emergencies, time-sensitive requests, angry customers, VIP contacts
   - MEDIUM: Standard business inquiries, follow-ups, general questions
   - LOW: Newsletters, spam, promotional content, non-urgent messages

2. Should Hold (true/false):
   - Hold messages that need human review before responding
   - Hold sensitive topics, complaints, or complex requests
   - Don't hold simple inquiries or spam

3. Category: inquiry, complaint, support, sales, spam, personal, urgent, other

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
  analysis: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  error: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
};

// Node: Analyze message
async function analyzeMessage(state) {
  try {
    const { message, senderPhone, senderName, conversationHistory } = state;
    
    // Build context from conversation history
    let historyContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = "\n\nRecent conversation history:\n" + 
        conversationHistory.slice(-5).map(msg => 
          `${msg.direction === 'inbound' ? 'Customer' : 'Agent'}: ${msg.content}`
        ).join("\n");
    }

    const userPrompt = `Analyze this incoming message:

From: ${senderName || senderPhone || "Unknown"}
Phone: ${senderPhone || "Unknown"}
Message: "${message}"
${historyContext}

Provide your analysis in JSON format with these fields:
- priority: "high" | "medium" | "low"
- shouldHold: boolean
- holdReason: string (only if shouldHold is true)
- category: "inquiry" | "complaint" | "support" | "sales" | "spam" | "personal" | "urgent" | "other"
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
  workflow.addNode("analyze", analyzeMessage);
  workflow.addNode("generate_response", generateResponse);

  // Add edges
  workflow.addEdge(START, "analyze");
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

// Main analysis function
async function analyzeIncomingMessage(message, senderPhone, senderName, conversationHistory = []) {
  const graph = getMessageGraph();
  
  const result = await graph.invoke({
    message,
    senderPhone,
    senderName,
    conversationHistory,
  });

  return result.analysis;
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

export {
  analyzeIncomingMessage,
  quickPriorityCheck,
  batchAnalyzeMessages,
  generateAutoResponse,
  shouldHoldMessage,
  MessageAnalysisSchema,
};
