const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hannah123';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

console.log('Hannah starting... VERIFY_TOKEN set:', !!VERIFY_TOKEN, 'PAGE_TOKEN set:', !!PAGE_ACCESS_TOKEN);

// Webhook verification
app.get('/webhook', (req, res) => {
  console.log('GET /webhook verification attempt:', req.query);
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED - challenge:', challenge);
    res.status(200).send(challenge);
  } else {
    console.log('Verification failed - expected', VERIFY_TOKEN, 'got', token);
    res.sendStatus(403);
  }
});

// Test endpoint
app.get('/', (req, res) => {
  console.log('GET / - health check');
  res.send('Hannah is running 💫 - POST /webhook ready. PAGE_TOKEN set: ' + !!PAGE_ACCESS_TOKEN);
});

// Instagram messages
app.post('/webhook', async (req, res) => {
  console.log('POST /webhook RECEIVED! Body:', JSON.stringify(req.body).substring(0, 2000));
  
  const body = req.body;
  if (body.object === 'instagram' || body.object === 'page' || body.object === 'user' || body.object === 'instagram') {
    for (const entry of body.entry || []) {
      console.log('Entry:', JSON.stringify(entry).substring(0, 2000));
      for (const messaging of entry.messaging || []) {
        const senderId = messaging.sender?.id;
        const messageText = messaging.message?.text || messaging.message?.is_unsupported || 'no text';
        console.log(`Message from ${senderId}: ${messageText}`);
        
        let reply = "Heyy! It's Hannah here — RevlAsH's assistant 💫 Thanks for DMing @ashgod_og! How can I help?";
        const lower = (messageText || '').toLowerCase();
        if (lower.includes('hello') || lower.includes('hi')) reply = "Heyy! It's Hannah 💫 — RevlAsH's assistant! How can I help you today?";
        if (lower.includes('price')) reply = "For pricing, tell me what you need and I'll have RevlAsH get back to you! 🔥";
        if (lower.includes('commission')) reply = "Got it! Share details + budget for commission — RevlAsH will reply soon!";
        
        if (PAGE_ACCESS_TOKEN && senderId) {
          try {
            console.log(`Attempting to reply to ${senderId}: ${reply}`);
            const resp = await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
              recipient: { id: senderId },
              message: { text: reply }
            });
            console.log('Reply sent success:', resp.data);
          } catch (e) {
            console.error('Send error:', JSON.stringify(e.response?.data || e.message));
          }
        } else {
          console.log('No PAGE_ACCESS_TOKEN or senderId, skipping reply. Token set:', !!PAGE_ACCESS_TOKEN);
        }
      }
      // Also handle Instagram Graph API format (changes)
      for (const change of entry.changes || []) {
        console.log('Change:', JSON.stringify(change).substring(0, 2000));
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    console.log('Unknown object type:', body.object);
    res.status(200).send('EVENT_RECEIVED');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hannah running on port ${PORT}`));

module.exports = app;
