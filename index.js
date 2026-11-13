const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hannah123';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PORT = process.env.PORT || 3000;

// CONFIGURE HANNAH'S REPLIES HERE - from your dashboard
const automations = [
  { trigger: 'hello', response: "Heyy! It's Hannah here — RevlAsH's assistant 💫 How can I help?" },
  { trigger: 'hi', response: "Heyy! It's Hannah here — RevlAsH's assistant 💫 How can I help?" },
  { trigger: 'price', response: "For pricing/commissions, RevlAsH will get back to you! Can you tell me what you need?" },
  { trigger: 'commission', response: "Got it! For commissions, please share details and budget — RevlAsH will reply soon 🔥" },
  { trigger: 'link', response: "Here's RevlAsH's links! What do you need specifically?" },
];

// Instagram webhook verification (Meta calls this once)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Instagram messages come here
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'instagram' || body.object === 'page') {
    for (const entry of body.entry) {
      for (const messaging of entry.messaging || []) {
        const senderId = messaging.sender?.id;
        const messageText = messaging.message?.text?.toLowerCase() || '';
        if (!senderId || !messageText) continue;
        
        // Find matching automation
        let reply = null;
        for (const auto of automations) {
          if (messageText.includes(auto.trigger)) { reply = auto.response; break; }
        }
        if (!reply) reply = "Heyy! It's Hannah 💫 Thanks for DMing! RevlAsH is away but I'll make sure he sees this. What did you need?";

        // Send reply back to Instagram
        if (PAGE_ACCESS_TOKEN) {
          try {
            await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
              recipient: { id: senderId },
              message: { text: reply }
            });
            console.log(`Replied to ${senderId}: ${reply}`);
          } catch (e) {
            console.error('Send error:', e.response?.data || e.message);
          }
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

app.get('/', (req, res) => res.send('Hannah is running 💫 - /webhook is ready'));

app.listen(PORT, () => console.log(`Hannah running on port ${PORT}`));
