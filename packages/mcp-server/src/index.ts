import { pathToFileURL } from 'node:url';
import {
  DEFAULT_HISTORY_PATH,
  DEFAULT_WEBHOOK_PORT,
  createFileHistoryStore,
  createPointGrabMcpServer,
  main,
} from './server.js';

export {
  DEFAULT_HISTORY_PATH,
  DEFAULT_WEBHOOK_PORT,
  createFileHistoryStore,
  createPointGrabMcpServer,
  main,
};
export type {
  AddGrabResult,
  CreatePointGrabMcpServerOptions,
  HistoryStore,
  PointGrabMcpServer,
} from './server.js';
export type { GrabContext, GrabEntry, GrabHistory } from './types.js';

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error) => {
    console.error('[point-grab] Fatal error:', error);
    process.exit(1);
  });
}
