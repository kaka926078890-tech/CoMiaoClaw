import { createApp } from './transport/index.js';
import { config } from './shared/config.js';

const app = createApp();
const port = config.port;

if (!config.deepseekApiKey) {
  process.stderr.write(JSON.stringify({
    level: 'warn',
    message: 'DEEPSEEK_API_KEY not set; chat will fail until configured',
  }) + '\n');
}

app.listen(port, () => {
  process.stderr.write(JSON.stringify({
    level: 'info',
    message: 'gateway listening',
    port,
  }) + '\n');
});
