const express = require("express");
const twilio = require("twilio");
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory store for active call conversations
const callSessions = {};

// Load messages log
const MESSAGES_FILE = path.join(__dirname, "messages.json");
function loadMessages() {
  if (!fs.existsSync(MESSAGES_FILE)) return [];
  return JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf8"));
}
function saveMessage(entry) {
  const messages = loadMessages();
  messages.push(entry);
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a friendly, professional AI assistant answering phone calls on behalf of the owner.

Your goals:
1. Greet the caller warmly and ask how you can help.
2. Answer general questions helpfully and conversationally.
3. If the caller wants to leave a message, ask for:
   - Their name
   - Their phone number or email
   - Their message
   Then confirm you've noted it.
4. Keep responses SHORT — under 40 words. This is a phone call, not an essay.
5. Never pretend to be human if directly asked. Say you're an AI assistant.
6. End calls politely when the caller is done.

When you've collected a complete message (name + contact + message), include this exact tag at the end of your response:
[MESSAGE_COLLECTED: name="<name>" contact="<contact>" message="<their message>"]`;

// ─── INCOMING CALL ─────────────────────────────────────────────────────────────
app.post("/voice", async (req, res) => {
  const callSid = req.body.CallSid;
  const twiml = new twilio.twiml.VoiceResponse();

  // Start a new session for this call
  callSessions[callSid] = { history: [], from: req.body.From };

  // Get AI greeting
  const greeting = await getAIResponse(callSid, "The call just connected. Greet the caller.");

  twiml.gather({
    input: "speech",
    speechTimeout: "auto",
    speechModel: "phone_call",
    action: "/respond",
    method: "POST",
  }).say({ voice: "Polly.Amy", language: "en-GB" }, greeting);

  res.type("text/xml");
  res.send(twiml.toString());
});

// ─── HANDLE CALLER'S SPEECH ────────────────────────────────────────────────────
app.post("/respond", async (req, res) => {
  const callSid = req.body.CallSid;
  const speechResult = req.body.SpeechResult || "";
  const twiml = new twilio.twiml.VoiceResponse();

  if (!callSessions[callSid]) {
    callSessions[callSid] = { history: [], from: req.body.From };
  }

  let aiReply = await getAIResponse(callSid, speechResult);

  // Check if a message was collected
  const msgMatch = aiReply.match(/\[MESSAGE_COLLECTED: name="(.+?)" contact="(.+?)" message="(.+?)"\]/);
  if (msgMatch) {
    saveMessage({
      timestamp: new Date().toISOString(),
      from: callSessions[callSid].from,
      name: msgMatch[1],
      contact: msgMatch[2],
      message: msgMatch[3],
    });
    // Strip the tag from spoken response
    aiReply = aiReply.replace(/\[MESSAGE_COLLECTED:.*?\]/, "").trim();
  }

  // Check if call should end
  const shouldEnd = /goodbye|bye|thank you, goodbye|that'?s? all/i.test(aiReply);

  if (shouldEnd) {
    twiml.say({ voice: "Polly.Amy", language: "en-GB" }, aiReply);
    twiml.hangup();
    delete callSessions[callSid];
  } else {
    twiml.gather({
      input: "speech",
      speechTimeout: "auto",
      speechModel: "phone_call",
      action: "/respond",
      method: "POST",
    }).say({ voice: "Polly.Amy", language: "en-GB" }, aiReply);
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

// ─── AI RESPONSE HELPER ────────────────────────────────────────────────────────
async function getAIResponse(callSid, userInput) {
  const session = callSessions[callSid];
  session.history.push({ role: "user", content: userInput });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: session.history,
    });

    const reply = response.content[0].text;
    session.history.push({ role: "assistant", content: reply });
    return reply;
  } catch (err) {
    console.error("Claude API error:", err);
    return "I'm sorry, I'm having a technical issue right now. Please try calling back shortly.";
  }
}

// ─── VIEW MESSAGES DASHBOARD ───────────────────────────────────────────────────
app.get("/messages", (req, res) => {
  const messages = loadMessages();
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Call Messages</title>
    <style>
      body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #f5f5f5; }
      h1 { color: #333; }
      .card { background: white; border-radius: 8px; padding: 16px; margin: 12px 0; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
      .meta { color: #888; font-size: 13px; }
      .name { font-weight: bold; font-size: 16px; }
      .msg { margin-top: 8px; color: #333; }
      .empty { color: #888; text-align: center; margin-top: 60px; }
    </style>
  </head>
  <body>
    <h1>📞 Call Messages</h1>
    ${messages.length === 0
      ? '<p class="empty">No messages yet.</p>'
      : [...messages].reverse().map(m => `
        <div class="card">
          <div class="name">${m.name}</div>
          <div class="meta">${m.contact} &bull; ${new Date(m.timestamp).toLocaleString()} &bull; From: ${m.from}</div>
          <div class="msg">${m.message}</div>
        </div>`).join("")
    }
  </body>
  </html>`;
  res.send(html);
});

// ─── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ AI Call Bot running on port ${PORT}`);
});
