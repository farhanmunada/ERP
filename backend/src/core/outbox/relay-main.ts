import { runRelayLoop } from './outbox-relay.ts';

const RELAY_INTERVAL_MS = 1000;
const controller = new AbortController();

process.on('SIGINT', () => controller.abort());
process.on('SIGTERM', () => controller.abort());

console.log('[outbox-relay] worker berjalan (interval 1s)');
await runRelayLoop(RELAY_INTERVAL_MS, controller.signal);
