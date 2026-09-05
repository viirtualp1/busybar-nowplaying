#!/usr/bin/env node
import { errorMessage } from 'busybar-kit/errors';
import { App } from './app.js';
import { BarDisplay, createBusyBar } from './bar/display.js';
import { loadConfig, loadEnvFile } from './config.js';
import { createSource } from './media/index.js';

loadEnvFile();
const { config, warnings } = loadConfig();

const source = createSource({
  kind: config.sourceKind,
  appFilter: config.appFilter,
  timeoutMs: config.requestTimeoutMs,
});

console.log('busybar-nowplaying');
console.log(
  `Source: ${source.name}${config.appFilter ? ` (only ${config.appFilter})` : ''}`,
);
for (const warning of warnings) {
  console.warn(warning);
}

const bar = createBusyBar({
  addr: config.busyAddr,
  token: config.busyToken,
  httpPassword: config.busyHttpPassword,
  timeoutMs: config.requestTimeoutMs,
});
const app = new App({
  config,
  source,
  display: new BarDisplay(bar, config.drawPriority),
});

let exiting = false;
async function shutdown(code: number): Promise<void> {
  if (exiting) {
    return;
  }
  exiting = true;
  await app.stop();
  process.exit(code);
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
process.on('unhandledRejection', (reason) => {
  console.warn(`Unhandled rejection: ${errorMessage(reason)}`);
});
process.on('uncaughtException', (error) => {
  console.error(`Fatal: ${errorMessage(error)}`);
  void shutdown(1);
});

try {
  await app.start();
} catch (error) {
  console.error(errorMessage(error));
  process.exit(1);
}
await app.wait();
