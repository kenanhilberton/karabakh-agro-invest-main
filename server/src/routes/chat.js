import express from 'express';
import { answer } from '../services/aiAssistant.js';

const router = express.Router();

// AI assistant. Always answers with a useful reply: it falls back from the
// remote model chain to the built-in offline knowledge engine, so the client
// never receives a bare 500 from a rate-limited or unreachable provider.
router.post('/', async (req, res) => {
  const message = (req.body?.message ?? '').toString().trim();
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  if (!message) {
    return res.status(400).json({ error: 'Mesaj boş ola bilməz' });
  }

  try {
    const { reply, source } = await answer({ message: message.slice(0, 4000), history });
    res.json({ reply, source });
  } catch (e) {
    console.error('[chat] cavab xətası:', e?.message || e);
    res.json({
      reply: 'Üzr istəyirəm, hazırda cavab verə bilmirəm. Zəhmət olmasa bir az sonra yenidən cəhd edin.',
      source: 'error'
    });
  }
});

export default router;
