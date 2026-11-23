import { createApp } from './app';
import { connectDb } from './db/connect';
import { config } from './config';
import { seedIfEmpty } from './db/seed';
import { aiStatus } from './ai/client';

const uri = await connectDb();
await seedIfEmpty();
createApp().listen(config.port, () => {
  const ai = aiStatus();
  console.log(`EstateOS API on http://localhost:${config.port}  (db: ${uri.replace(/\/\/.*@/, '//***@')})`);
  console.log(ai.mode === 'gemini' ? `AI assistant: Google Gemini (${ai.model})` : 'AI assistant: offline mode — set GEMINI_API_KEY to use Gemini');
});
