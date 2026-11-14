const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hannah123';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
const PORT = process.env.PORT || 3000;

console.log('Hannah starting... VERIFY_TOKEN:', !!VERIFY_TOKEN, 'PAGE_TOKEN:', !!PAGE_ACCESS_TOKEN);

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

app.get('/', (req, res) => {
  res.send('Hannah is running - PAGE_TOKEN set: ' + !!PAGE_ACCESS_TOKEN);
});

async function sendReply(recipientId, text, igUserId) {
  if (!PAGE_ACCESS_TOKEN || !recipientId) return;
  // For Instagram Business Login, send via IG user ID endpoint
  const endpoints = [
    `https://graph.facebook.com/v19.0/${igUserId || IG_USER_ID || 'me'}/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`
  ];
  for (const url of endpoints) {
    try {
      const payload = {
        recipient: { id: recipientId },
        message: { text: text }
      };
      console.log(`Sending reply via ${url} to ${recipientId}: ${text}`);
      const resp = await axios.post(url, payload);
      console.log('Reply SUCCESS:', resp.data);
      return true;
    } catch (e) {
      console.error('Send failed via', url, ':', JSON.stringify(e.response?.data || e.message).substring(0,1500));
    }
  }
  return false;
}

function getReply(text) {
  const lower = (text || '').toLowerCase();
  if (!lower) return null;
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) return "Heyy! It's Hannah 💫 — RevlAsH's assistant! How can I help today?";
  if (lower.includes('price')) return "For pricing, tell me what you need and I'll have RevlAsH get back to you! 🔥";
  if (lower.includes('commission')) return "Got it! Share details + budget — RevlAsH will reply soon!";
  return "Heyy! It's Hannah 💫 Thanks for DMing @ashgod_og! What did you need?";
}

app.post('/webhook', async (req, res) => {
  const body = req.body;
  console.log('=== POST /webhook FULL BODY START ===');
  console.log(JSON.stringify(body, null, 2).substring(0, 10000));
  console.log('=== POST /webhook FULL BODY END ===');
  
  try {
    for (const entry of body.entry || []) {
      console.log('Entry keys:', Object.keys(entry));
      console.log('Entry id:', entry.id, 'uid:', entry.uid, 'time:', entry.time);
      console.log('Entry full:', JSON.stringify(entry).substring(0, 5000));
      
      // Try all possible message locations
      let messagesToProcess = [];
      
      // Format 1: entry.messaging (old Messenger)
      if (entry.messaging) {
        console.log('Found entry.messaging with', entry.messaging.length, 'items');
        for (const m of entry.messaging) {
          messagesToProcess.push({
            senderId: m.sender?.id,
            text: m.message?.text,
            raw: m
          });
        }
      }
      
      // Format 2: entry.changes (new Instagram Graph API)
      if (entry.changes) {
        console.log('Found entry.changes with', entry.changes.length, 'items');
        for (const change of entry.changes) {
          console.log('Change field:', change.field);
          console.log('Change value keys:', Object.keys(change.value || {}));
          console.log('Change value full:', JSON.stringify(change.value).substring(0,3000));
          if (change.field === 'messages') {
            const v = change.value || {};
            messagesToProcess.push({
              senderId: v.sender?.id || v.from?.id,
              text: v.message?.text || v.text || (typeof v.message === 'string' ? v.message : null),
              raw: v
            });
          }
        }
      }
      
      // Format 3: Direct entry with messaging inside? (some Instagram business login payloads)
      // Some payloads have entry.id as IG user, and messaging inside entry
      // Already covered, but also check if entry itself is a message
      if (entry.message || entry.messages) {
        console.log('Found direct entry.message');
      }
      
      console.log('Total messages to process:', messagesToProcess.length);
      
      for (const msg of messagesToProcess) {
        console.log('Processing message:', JSON.stringify(msg).substring(0,1000));
        if (!msg.senderId || !msg.text) {
          console.log('Skipping - no sender or text');
          continue;
        }
        // Don't reply to self
        if (msg.senderId == entry.id || msg.senderId == entry.uid) {
          console.log('Skipping self-message');
          continue;
        }
        const reply = getReply(msg.text);
        if (reply) {
          console.log(`Replying to ${msg.senderId}: ${reply}`);
          await sendReply(msg.senderId, reply, entry.id);
        }
      }
    }
  } catch (err) {
    console.error('Handler error:', err, err.stack);
  }
  
  res.status(200).send('EVENT_RECEIVED');
});

app.listen(PORT, () => console.log(`Hannah running on port ${PORT}`));
module.exports = app;
