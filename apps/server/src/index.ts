import { BUILD_ID } from '@chameleon/shared';
import { loadConfig } from './config';
import { startServer } from './server';

const config = loadConfig();
const server = await startServer({ config });
console.log(`office-camouflage ${BUILD_ID} listening on ${config.host}:${server.port}`);
console.log(`allowed origins: ${config.allowedOrigins.join(', ')}`);

const shutdown = (signal: string) => {
  console.log(`${signal} received, closing`);
  server.close().then(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
