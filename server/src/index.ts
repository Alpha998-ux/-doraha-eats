import { createApp } from './app.js';
import { env } from './config/env.js';
import { getSettings } from './services/settings.service.js';

const app = createApp();

app.listen(env.PORT, async () => {
  const s = await getSettings().catch(() => null);
  console.log(`\n  ${s?.brandName ?? 'Doraha Eats'} API`);
  console.log(`  ${s?.brandTagline ?? ''}`);
  console.log(`  http://localhost:${env.PORT}/api/v1  [${env.NODE_ENV}]`);
  console.log(`  health: http://localhost:${env.PORT}/health\n`);
});
