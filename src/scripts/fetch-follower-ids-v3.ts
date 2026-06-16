import https from 'https';
import axios, { AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../helpers/Logger/logger';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });




// ─── Config ────────────────────────────────────────────────────────────────

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ keepAlive: true }),
});
const API_GET_FOLLOWERS_URL = process.env.API_GET_FOLLOWERS_URL ?? 'https://api.line.me/v2/bot/followers/ids';
const OUTPUT_DIR = path.join(process.cwd(), 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'king_power_users_v3.csv');
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, 'king_power_v3_checkpoint.json');
const TOKEN = process.env.KING_POWER_PROD_TOKEN ?? '';
const BATCH_SIZE = 500000
const LIMIT = 1000
const heapMemory = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024);



// ─── Checkpoint ────────────────────────────────────────────────────────────

interface Checkpoint {
  cursor?: string;
  totalUserIds: number;
  isAllFollowers: boolean;
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




// ─── LineAPI ──────────────────────────────────────────────────────

interface UserFollowersResult {
  userIds: string[];
  nextCursor?: string;
}

class LineAPI {
  constructor() {}

  async fetchUserFollowers(
    startCursor: string | undefined
  ): Promise<UserFollowersResult> {

    const userIds: string[] = [];
    let cursor = startCursor;

    while (true) {
      const { data } = await axiosInstance.get(API_GET_FOLLOWERS_URL, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        params: { limit: LIMIT, ...(cursor ? { start: cursor } : {}) },
      });

      logger.info({
        event: 'data',
        data: data,
      });
      

      userIds.push(...data.userIds);

      // condition finish loop
      if (userIds.length >= BATCH_SIZE || !data.next) {
        return { userIds, nextCursor: data.next };
      }

      cursor = data.next;
    }
  }


}



// ─── BatchProcessor ────────────────────────────────────────────────────────

interface BatchProcessResult {
  countUserIds: number;
  isAllFollowersFetched: boolean;
}

class BatchProcessor {
  constructor(
    private readonly lineAPI: LineAPI,
    private readonly writer: CsvBatchWriter,
    private readonly checkpointManager: CheckpointManager,
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

    const { userIds, nextCursor } = await this.lineAPI.fetchUserFollowers(cursor);
    this.writer.writeFile(userIds);


    this.checkpointManager.save({
      cursor: nextCursor,
      totalUserIds: totalUserIds + userIds.length,
      isAllFollowers: !nextCursor,
    });


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
      countUserIds: userIds.length, 
      isAllFollowersFetched: !nextCursor 
    };
  }
}



// ─── ExportFollowerService ─────────────────────────────────────────────────

class ExportFollowerService {
  private readonly batch: BatchProcessor;
  private readonly startTime = Date.now();

  private totalUserIds: number;
  private cursor: string | undefined;
  private batchNumber = 0;

  constructor(
    checkpoint: Checkpoint | null,
    checkpointManager: CheckpointManager,
  ) {
    this.totalUserIds = checkpoint?.totalUserIds ?? 0;
    this.cursor = checkpoint?.cursor;
    this.batch = new BatchProcessor(
      new LineAPI(),
      new CsvBatchWriter(OUTPUT_FILE, checkpoint !== null),
      checkpointManager,
    );
  }

  async run(): Promise<void> {
    this.batchNumber++;

    const { countUserIds, isAllFollowersFetched } = await this.batch.process(
      this.cursor,
      this.batchNumber,
      this.totalUserIds,
      this.startTime,
    );

    this.totalUserIds += countUserIds;

    if (isAllFollowersFetched) {
      logger.info({
        event: 'fetch.complete',
        totalUserIds: this.totalUserIds,
        totalElapsedMs: Date.now() - this.startTime,
        outputFile: OUTPUT_FILE,
      });
    }
  }
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

  const checkpointManager = new CheckpointManager(CHECKPOINT_FILE);
  const checkpoint = checkpointManager.load();

  if (checkpoint) {
    logger.info({
      event: 'fetch.resuming',
      fromTotalUserIds: checkpoint.totalUserIds
    });
  }

  await new ExportFollowerService(checkpoint, checkpointManager).run();

  logger.info({ event: 'script.done' });
}

main();
