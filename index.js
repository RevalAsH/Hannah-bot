const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hannah123';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
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
  res.send('Hannah is running - PAGE_TOKEN: ' + !!PAGE_ACCESS_TOKEN);
});

async function sendReply(recipientId, text, igUserId) {
  if (!PAGE_ACCESS_TOKEN || !recipientId) return false;
  const url = `https://graph.facebook.com/v19.0/${igUserId || 'me'}/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  try {
    console.log(`Sending via ${url} to ${recipientId}: ${text}`);
    const resp = await 【entity-axios¦canonical_name=axios】.post(url, {
      recipient: { id: recipientId },
      message: { text: text }
    });
    console.log('Reply SUCCESS:', resp.data);
    return true;
  } catch (e) {
    console.error('Send FAILED:', JSON.stringify(e.response?.data || e.message).substring(0,2000));
    return false;
  }
}

function getReply(text) {
  const l = (text || '').toLowerCase();
  if (l.includes('price')) return "For pricing, tell me what you need - RevlAsH will reply soon! 🔥";
  if (l.includes('hello') || l.includes('hi') || l.includes('hey')) return "Heyy! It's Hannah 💫 — RevlAsH's assistant! How can I help today?";
  return "Heyy! It's Hannah 💫 Thanks for DMing @ashgod_og! What did you need?";
}

app.post('/webhook', async (req, res) => {
  console.log('=== POST /webhook START ===');
  console.log(JSON.stringify(req.body, null, 2).substring(0, 10000));
  console.log('=== POST /webhook END ===');

  try {
    for (const entry of req.body.entry || []) {
      console.log('Entry keys:', Object.keys(entry));
      console.log('Entry id:', entry.id, 'uid:', entry.uid);
      console.log('Entry full:', JSON.stringify(entry).substring(0, 6000));

      let toProcess = [];
      if (entry.messaging) {
        console.log(`Found entry.messaging: ${entry.messaging.length}`);
        for (const m of entry.messaging) {
          toProcess.push({ senderId: m.sender?.id, text: m.message?.text });
        }
      }
      if (entry.changes) {
        console.log(`Found entry.changes: ${entry.changes.length}`);
        for (const c of entry.changes) {
          console.log('Change field:', c.field, 'value:', JSON.stringify(c.value).substring(0,2000));
          if (c.field === 'messages') {
            const v = c.value || {};
            toProcess.push({ senderId: v.sender?.id || v.from?.id, text: v.message?.text || v.text });
          }
        }
      }

      console.log(`Total messages to process: ${toProcess.length}`);
      for (const msg of toProcess) {
        console.log('Msg:', JSON.stringify(msg).substring(0,1000));
        if (!msg.senderId || !msg.text) { console.log('Skip - no sender/text'); continue; }
        if (msg.senderId == entry.id || msg.senderId == entry.uid) { console.log('Skip self'); continue; }
        const reply = getReply(msg.text);
        console.log(`Replying to ${msg.senderId} with: ${reply}`);
        await sendReply(msg.senderId, reply, entry.id);
      }
    }
  } catch (err) {
    console.error('Webhook error:', err, err.stack);
  }
  res.status(200).send('EVENT_RECEIVED');
});

app.listen(PORT, () => console.log(`Hannah running on port ${PORT}`));
