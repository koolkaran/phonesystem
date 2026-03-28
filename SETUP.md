# 📞 AI Call Answering Bot — Setup Guide

A Node.js bot that answers your phone calls using Twilio + Claude AI.
It holds natural conversations and logs messages to a dashboard.

---

## What You Need (all free tiers available)

| Thing | Where to get it | Cost |
|---|---|---|
| Twilio account + number | twilio.com | ~£1/month for a UK number |
| Anthropic API key | console.anthropic.com | Pay-per-use (~$0.003/call) |
| A server to host this | Railway / Render / fly.io | Free tier available |

---

## Step 1 — Get Your Accounts

### Twilio
1. Sign up at **twilio.com**
2. Go to **Phone Numbers → Buy a Number** — pick a UK number
3. Note your **Account SID** and **Auth Token** from the dashboard (you won't need these in the code, but keep them safe)

### Anthropic API Key
1. Go to **console.anthropic.com**
2. Create an account → **API Keys → Create Key**
3. Copy it — you'll need it in Step 3

---

## Step 2 — Deploy the Server

### Option A: Railway (easiest)
1. Push this folder to a GitHub repo
2. Go to **railway.app** → New Project → Deploy from GitHub
3. Select your repo — it auto-detects Node.js
4. Add environment variables (see Step 3)
5. Railway gives you a public URL like `https://your-app.railway.app`

### Option B: Render
1. Go to **render.com** → New → Web Service
2. Connect your GitHub repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables (see Step 3)

### Option C: Run locally with ngrok (for testing)
```bash
npm install
cp .env.example .env
# Edit .env with your API key
node server.js

# In another terminal:
npx ngrok http 3000
# Copy the https URL ngrok gives you
```

---

## Step 3 — Set Environment Variables

In your hosting dashboard, add:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3000
```

---

## Step 4 — Connect Twilio to Your Server

1. In Twilio dashboard, go to **Phone Numbers → Manage → Active Numbers**
2. Click your number
3. Under **Voice & Fax → A Call Comes In**, set:
   - **Webhook**: `https://your-app-url.com/voice`
   - **HTTP Method**: POST
4. Click Save

That's it! 🎉

---

## Step 5 — Test It

Call your Twilio number. The bot will:
- Answer with a friendly greeting
- Hold a natural AI conversation
- Take a message if asked (name, contact, message)
- Log everything to your dashboard

### View Messages
Open `https://your-app-url.com/messages` in your browser to see all logged messages.

---

## Customising the Bot

Open `server.js` and edit the `SYSTEM_PROMPT` near the top to:
- Change the bot's name or personality
- Add your business info (opening hours, address, FAQs)
- Change what information it collects

Example addition to the system prompt:
```
The business is "Joe's Plumbing", open Mon-Fri 8am-6pm.
Our emergency number is 07700 900000.
```

---

## File Structure

```
ai-call-bot/
├── server.js        # Main app — all the logic lives here
├── package.json     # Dependencies
├── .env.example     # Environment variable template
├── messages.json    # Auto-created when first message is saved
└── SETUP.md         # This file
```

---

## How It Works

```
Caller dials your Twilio number
        ↓
Twilio sends POST to /voice
        ↓
Server asks Claude for a greeting
        ↓
Claude responds → Twilio reads it aloud (Polly.Amy voice)
        ↓
Caller speaks → Twilio transcribes it → POST to /respond
        ↓
Claude replies → spoken to caller
        ↓  (loop until goodbye)
If message collected → saved to messages.json
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Bot doesn't answer | Check Twilio webhook URL is correct and server is running |
| "Technical issue" message | Check ANTHROPIC_API_KEY is set correctly |
| No speech recognition | Twilio free trial requires verified numbers to call in |
| Messages not saving | Check server has write permissions to its directory |
