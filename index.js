const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hannah123';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID; // optional: your IG business ID
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
  res.send('Hannah is running 💫 - POST /webhook ready. PAGE_TOKEN set: ' + !!PAGE_ACCESS_TOKEN);
});

async function sendReply(recipientId, text) {
  if (!PAGE_ACCESS_TOKEN || !recipientId) {
    console.log('Cannot reply - missing token or recipient');
    return;
  }
  // Try Instagram Graph API format first, then Messenger format
  const endpoints = [
    `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    `https://graph.facebook.com/v19.0/${IG_USER_ID || 'me'}/messages?access_token=${PAGE_ACCESS_TOKEN}`
  ];
  for (const url of endpoints) {
    try {
      const payload = {
        recipient: { id: recipientId },
        message: { text: text }
      };
      console.log(`Trying to send via ${url} to ${recipientId}: ${text}`);
      const resp = await axios.post(url, payload);
      console.log('Reply SUCCESS:', resp.data);
      return;
    } catch (e) {
      console.error('Send via', url, 'failed:', JSON.stringify(e.response?.data || e.message).substring(0,1000));
    }
  }
}

function getReplyForText(text) {
  const lower = (text || '').toLowerCase();
  if (!lower) return "Heyy! It's Hannah 💫 Thanks for DMing @ashgod_og! How can I help?";
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) return "Heyy! It's Hannah 💫 — RevlAsH's assistant! How can I help you today?";
  if (lower.includes('price')) return "For pricing, tell me what you need and I'll have RevlAsH get back to you! 🔥";
  if (lower.includes('commission')) return "Got it! Share details + budget for commission — RevlAsH will reply soon!";
  if (lower.includes('link')) return "Here are RevlAsH's links — what do you need specifically?";
  return "Heyy! It's Hannah 💫 Thanks for DMing! RevlAsH is away but I'll make sure he sees this. What did you need?";
}

app.post('/webhook', async (req, res) => {
  console.log('POST /webhook RECEIVED! Full Body:', JSON.stringify(req.body).substring(0, 3000));
  const body = req.body;
  
  try {
    for (const entry of body.entry || []) {
      console.log('Processing entry id:', entry.id, 'time:', entry.time);
      
      // OLD FORMAT: entry.messaging
      for (const messaging of entry.messaging || []) {
        const senderId = messaging.sender?.id;
        const messageText = messaging.message?.text || '';
        console.log(`OLD FORMAT - From ${senderId}: ${messageText}`);
        if (senderId && messageText) {
          const reply = getReplyForText(messageText);
          await sendReply(senderId, reply);
        }
      }
      
      // NEW FORMAT: entry.changes with field=messages (Instagram Business Login)
      for (const change of entry.changes || []) {
        console.log('Change field:', change.field, 'Value:', JSON.stringify(change.value).substring(0,2000));
        if (change.field === 'messages' || change.field === 'messaging' || change.field === 'message') {
          const val = change.value || {};
          // Extract sender and text from various possible structures
          const senderId = val.sender?.id || val.from?.id || val.sender_id;
          const recipientId = val.recipient?.id || val.to?.id;
          let messageText = '';
          if (val.message?.text) messageText = val.message.text;
          else if (val.text) messageText = val.text;
          else if (typeof val.message === 'string') messageText = val.message;
          else if (val.message?.is_unsupported) messageText = 'unsupported';
          
          console.log(`NEW FORMAT - From ${senderId} text: ${messageText}`);
          
          // Avoid replying to self (if sender is your own IG ID)
          if (senderId && messageText && senderId !== recipientId) {
            const reply = getReplyForText(messageText);
            console.log(`Replying to ${senderId} with: ${reply}`);
            await sendReply(senderId, reply);
          } else {
            console.log('Skipping - missing sender/text or self-message');
          }
        }
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }
  
  res.status(200).send('EVENT_RECEIVED');
});

app.listen(PORT, () => console.log(`Hannah running on port ${PORT}`));
module.exports = app;
