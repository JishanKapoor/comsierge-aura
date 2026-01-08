// Test MMS sending
// Run with: node test-mms-send.js

const testSendSMS = async () => {
  const API_URL = "https://comsierge-iwe0.onrender.com";
  
  console.log("Testing SMS send to +14372392448...\n");
  
  try {
    // First, get a login token (we need to be authenticated)
    // For testing, let's just check if send-test-sms works (doesn't need auth)
    const response = await fetch(`${API_URL}/api/twilio/send-test-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        toNumber: "+14372392448",
        body: "Test MMS - if you receive this, SMS is working!",
      }),
    });
    
    const data = await response.json();
    console.log("Response status:", response.status);
    console.log("Response data:", JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log("\n✅ SMS sent successfully!");
    } else {
      console.log("\n❌ SMS failed:", data.message);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
};

testSendSMS();
