import { env } from './config/env';
import { createServer } from './server';

void createServer().then(() => {
  console.log(`API on http://localhost:${env.PORT}`);
});
