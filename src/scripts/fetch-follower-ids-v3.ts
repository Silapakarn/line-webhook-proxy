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
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, 'king_power_v3_checkpoint.json');
const TOKEN = process.env.KING_POWER_PROD_TOKEN ?? '';
const BATCH_SIZE = 100_000;
const LIMIT_PER_PAGE = 1000
const heapMemory = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024);



// ─── Checkpoint ────────────────────────────────────────────────────────────

interface Checkpoint {
  cursor?: string;
  totalUserIds: number;
}

class CheckpointManager {
  constructor(private readonly filePath: string) {}

  load(): Checkpoint | null {
    if (!fs.existsSync(this.filePath)) return null;
    return JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as Checkpoint;
  }

  save(cp: Checkpoint): void {
    fs.writeFileSync(this.filePath, JSON.stringify(cp));
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
  }
}

const checkpointManager = new CheckpointManager(CHECKPOINT_FILE);




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

      if (userIds.length >= BATCH_SIZE || !data.next) {
        return { userIds, nextCursor: data.next };
      }

      cursor = data.next;
    }
  }
}



// ─── BatchProcessor ────────────────────────────────────────────────────────

interface BatchProcessResult {
  nextCursor?: string;
  fetchedIds: number;
  isDone: boolean;
}

class BatchProcessor {
  constructor(
    private readonly apiClient: LineFollowerApiClient,
    private readonly writer: CsvBatchWriter,
  ) {}

  async process(
    cursor: string | undefined,
    batchNumber: number,
    totalUserIds: number,
    startTime: number,
  ): Promise<BatchProcessResult> {
    logger.info({ 
      event: 'fetch.batch_start', 
      batchNumber, 
      totalUserIdsSoFar: totalUserIds 
    });

    const { userIds, nextCursor } = await this.apiClient.fetchOneBatch(cursor);
    this.writer.writeFile(userIds);


    logger.info({
      event: 'fetch.batch_done',
      batchNumber,
      totalUserIds: totalUserIds + userIds.length,
      heapMB: heapMemory(),
      totalElapsedMs: Date.now() - startTime,
      ...(nextCursor ? { hint: 'Run again to continue' } : 
        { outputFile: OUTPUT_FILE }),
    });

    return { 
      nextCursor, 
      fetchedIds: userIds.length, 
      isDone: !nextCursor 
    };
  }
}



// ─── FollowerExportService ─────────────────────────────────────────────────

class FollowerExportService {
  private readonly batch: BatchProcessor;
  private readonly startTime = Date.now();
  private totalUserIds: number;
  private cursor: string | undefined;
  private batchNumber = 0;

  constructor(checkpoint: Checkpoint | null) {
    this.totalUserIds = checkpoint?.totalUserIds ?? 0;
    this.cursor = checkpoint?.cursor;
    this.batch = new BatchProcessor(
      new LineFollowerApiClient(TOKEN),
      new CsvBatchWriter(OUTPUT_FILE, checkpoint !== null),
    );
  }

  async run(): Promise<void> {
    this.batchNumber++;

    const { nextCursor, fetchedIds, isDone } = await this.batch.process(
      this.cursor,
      this.batchNumber,
      this.totalUserIds,
      this.startTime,
    );

    this.totalUserIds += fetchedIds;
    this.cursor = nextCursor;
    this.updateCheckpoint(nextCursor);

    if (isDone) {
      logger.info({
        event: 'fetch.complete',
        totalUserIds: this.totalUserIds,
        totalElapsedMs: Date.now() - this.startTime,
        outputFile: OUTPUT_FILE,
      });
    }
  }

  private updateCheckpoint(nextCursor?: string): void {
    if (nextCursor) {
      checkpointManager.save({ 
        cursor: nextCursor, 
        totalUserIds: this.totalUserIds 
      });
    } else {
      checkpointManager.clear();
    }
  }
}




// ─── Export ────────────────────────────────────────────────────────────────

async function exportFollowerIds(): Promise<void> {
  const checkpoint = checkpointManager.load();

  if (checkpoint) {
    logger.info({ 
      event: 'fetch.resuming', 
      fromTotalUserIds: checkpoint.totalUserIds 
    });
  }

  await new FollowerExportService(checkpoint).run();
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

  logger.info({ event: 'script.done' });
}

main();
