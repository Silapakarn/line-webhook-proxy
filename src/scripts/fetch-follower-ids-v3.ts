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
const API_GET_FOLLOWERS_URL = process.env.API_GET_FOLLOWERS_URL ?? 'https://api.line.me/v2/bot/followers/ids';
const OUTPUT_DIR = path.join(process.cwd(), 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'king_power_users_v3.csv');
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'king_power_v3_progress.json');
const TOKEN = process.env.KING_POWER_PROD_TOKEN ?? '';
const BATCH_SIZE = 5000;
const LIMIT_PER_PAGE = 1000
const heapMemory = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024);



// ─── Progress ────────────────────────────────────────────────────────────

interface Progress {
  cursor?: string;
  totalUserIds: number;
}

function loadSavedProgress(): Progress | null {
  if (!fs.existsSync(PROGRESS_FILE)) return null;
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')) as Progress;
}

function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
}

function clearProgress(): void {
  if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
}




// ─── CsvBatchWriter ────────────────────────────────────────────────────────

class CsvBatchWriter {
  private readonly filePath: string;
  private isFirstWrite: boolean;

  constructor(filePath: string, isResuming: boolean) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.filePath = filePath;
    this.isFirstWrite = !isResuming;
  }

  writeFile(userIds: string[]): void {
    if (userIds.length === 0) return;
    const line = this.isFirstWrite ? userIds.join('\n') : '\n' + userIds.join('\n');
    this.isFirstWrite = false;
    fs.appendFileSync(this.filePath, line, 'utf-8');
  }
}




// ─── LineFollowerApiClient ─────────────────────────────────────────────────

interface BatchResult {
  userIds: string[];
  nextCursor?: string;
}

class LineFollowerApiClient {
  constructor(private readonly token: string) {}

  async fetchOneBatch(startCursor?: string): Promise<BatchResult> {
    const userIds: string[] = [];
    let cursor = startCursor;

    while (true) {
      const { data } = await lineClient.get(API_GET_FOLLOWERS_URL, {
        headers: { Authorization: `Bearer ${this.token}` },
        params: { limit: LIMIT_PER_PAGE, ...(cursor ? { start: cursor } : {}) },
      });

      userIds.push(...data.userIds);

      // If we've collected enough for one batch, or there are no more pages, return what we have so far.
      if (userIds.length >= BATCH_SIZE || !data.next) {
        return { userIds, nextCursor: data.next };
      }

      cursor = data.next;
    }
  }
}

// ─── FollowerExportService ─────────────────────────────────────────────────

class FollowerExportService {
  private readonly apiClient: LineFollowerApiClient;
  private readonly writer: CsvBatchWriter;
  private readonly startTime = Date.now();
  private totalUserIds: number;
  private cursor: string | undefined;
  private batchNumber = 0;

  constructor(saved: Progress | null) {
    this.apiClient = new LineFollowerApiClient(TOKEN);
    this.totalUserIds = saved?.totalUserIds ?? 0;
    this.cursor = saved?.cursor;
    this.writer = new CsvBatchWriter(OUTPUT_FILE, saved !== null);
  }

  
  async run(): Promise<void> {
    let isDone: boolean = false;
    while (!isDone) {
      isDone = await this.processBatch();
    }

    logger.info({
      event: 'fetch.complete',
      totalUserIds: this.totalUserIds,
      totalElapsedMs: Date.now() - this.startTime,
      outputFile: OUTPUT_FILE,
    });
  }



  private async processBatch(): Promise<boolean> {
    this.batchNumber++;
    logger.info({
      event: 'fetch.batch_start',
      batchNumber: this.batchNumber,
      totalUserIdsSoFar: this.totalUserIds,
    });

    const { userIds, nextCursor } = await this.apiClient.fetchOneBatch(this.cursor);
    this.writer.writeFile(userIds);
    this.totalUserIds += userIds.length;
    this.cursor = nextCursor;

    this.updateProgress(nextCursor);

    logger.info({
      event: 'fetch.batch_done',
      batchNumber: this.batchNumber,
      totalUserIds: this.totalUserIds,
      heapMB: heapMemory(),
      totalElapsedMs: Date.now() - this.startTime,
      ...(nextCursor ? { hint: 'Run again to continue' } : { outputFile: OUTPUT_FILE }),
    });

    return !nextCursor; // true = last page, stop the loop
  }

  private updateProgress(nextCursor?: string): void {
    if (nextCursor) {
      saveProgress({ cursor: nextCursor, totalUserIds: this.totalUserIds });
    } else {
      clearProgress();
    }
  }
}




// ─── Export ────────────────────────────────────────────────────────────────

async function exportFollowerIds(): Promise<void> {
  const saved = loadSavedProgress();

  if (saved) {
    logger.info({ 
      event: 'fetch.resuming', 
      fromTotalUserIds: saved.totalUserIds 
    });
  }

  await new FollowerExportService(saved).run();
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

  logger.info({ 
    event: 'script.start', 
    version: '(regular async — no generator)' 
  });
  
  await exportFollowerIds();

  logger.info({ 
    event: 'script.done' 
  });
}

main();
