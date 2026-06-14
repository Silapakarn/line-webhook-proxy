import https from 'https';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../helpers/Logger/logger';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ─── Config ────────────────────────────────────────────────────────────────

const lineClient = axios.create({
  httpsAgent: new https.Agent({ keepAlive: true }),
});

const LINE_FOLLOWERS_URL = 'https://api.line.me/v2/bot/followers/ids';
const OUTPUT_DIR = path.join(process.cwd(), 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'king_power_users.csv');
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, 'king_power_checkpoint.json');
const TOKEN = process.env.KING_POWER_PROD_TOKEN ?? '';
const PROGRESS_LOG_EVERY_N_PAGES = 100;
const BATCH_SIZE = 1000;

// ─── Checkpoint ────────────────────────────────────────────────────────────

interface Checkpoint {
  cursor?: string;
  totalIds: number;
  page: number;
}

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_FILE)) return null;
  return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')) as Checkpoint;
}

function saveCheckpoint(cp: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp));
}

function clearCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
}

// ─── CsvStreamWriter ───────────────────────────────────────────────────────

class CsvStreamWriter {
  private readonly stream: fs.WriteStream;
  private firstWrite: boolean;

  constructor(filePath: string, append = false) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.stream = fs.createWriteStream(filePath, { encoding: 'utf-8', flags: append ? 'a' : 'w' });
    this.firstWrite = !append;
  }

  append(ids: string[]): void {
    if (ids.length === 0) return;
    const chunk = this.firstWrite ? ids.join('\n') : '\n' + ids.join('\n');
    this.firstWrite = false;
    this.stream.write(chunk);
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
  }
}

// ─── Async Generator ───────────────────────────────────────────────────────

async function* fetchListFollowers(
  token: string,
  startCursor?: string,
): AsyncGenerator<{ userIds: string[]; next?: string }> {
  const getFollowers = (cursor?: string) =>
    lineClient.get(LINE_FOLLOWERS_URL, {
      headers: { Authorization: `Bearer ${token}` },
      params: cursor ? { start: cursor } : {},
    });

  let nextRequest = getFollowers(startCursor);

  while (true) {
    const { data } = await nextRequest;

    if (data.next) nextRequest = getFollowers(data.next);

    yield { userIds: data.userIds, next: data.next };

    if (!data.next) break;
  }
}

// ─── Export ────────────────────────────────────────────────────────────────

async function exportFollowers(): Promise<void> {
  const saved = loadCheckpoint();
  const isResuming = saved !== null;

  const writer = new CsvStreamWriter(OUTPUT_FILE, isResuming);
  let page = saved?.page ?? 0;
  let totalIds = saved?.totalIds ?? 0;
  const idsAtStart = totalIds;

  const scriptStart = Date.now();
  let progressClock = Date.now();

  if (isResuming) {
    logger.info({ event: 'fetch.resuming', fromPage: page, fromTotalIds: totalIds });
  }

  try {
    for await (const { userIds, next } of fetchListFollowers(TOKEN, saved?.cursor)) {
      writer.append(userIds);
      totalIds += userIds.length;
      page++;

      if (next) {
        saveCheckpoint({ cursor: next, totalIds, page });
      } else {
        clearCheckpoint();
      }

      if (page % PROGRESS_LOG_EVERY_N_PAGES === 0) {
        const now = Date.now();
        logger.info({
          event: 'fetch.progress',
          pagesCompleted: page,
          totalSoFar: totalIds,
          thisRunIds: totalIds - idsAtStart,
          batchDurationMs: now - progressClock,
          totalElapsedMs: now - scriptStart,
        });
        progressClock = now;
      }

      // Pause after BATCH_SIZE IDs — only if there are more pages left
      if (totalIds - idsAtStart >= BATCH_SIZE && next) {
        break;
      }
    }
  } finally {
    await writer.close();
  }

  const isDone = !fs.existsSync(CHECKPOINT_FILE);

  logger.info({
    event: isDone ? 'fetch.complete' : 'fetch.paused',
    totalPages: page,
    totalUsers: totalIds,
    thisRunIds: totalIds - idsAtStart,
    totalElapsedMs: Date.now() - scriptStart,
    ...(isDone ? { outputFile: OUTPUT_FILE } : { hint: 'Run again to continue from checkpoint' }),
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!TOKEN) {
    logger.error({
      event: 'config.missing_token',
      hint: 'Set KING_POWER_PROD_TOKEN in your .env file',
    });
    process.exit(1);
  }

  logger.info({ event: 'script.start' });
  await exportFollowers();
  logger.info({ event: 'script.done' });
}

main();
