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
const BATCH_SIZE = 10000;
const LIMIT_PER_PAGE = 1000; // max allowed by LINE API — fewer pages = faster total time
const heapMemory = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

// ─── Checkpoint ────────────────────────────────────────────────────────────

interface Checkpoint {
  cursor?: string;
  totalIds: number;
  page: number;
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

// ─── LineFollowerApiClient ─────────────────────────────────────────────────

class LineFollowerApiClient {
  constructor(
    private readonly token: string
  ) {}

  async *fetchUserIds(startCursor?: string): AsyncGenerator<{ userIds: string[]; next?: string }> {
    
    const getPage = (cursor?: string) =>
      lineClient.get(LINE_FOLLOWERS_URL, {
        headers: { Authorization: `Bearer ${this.token}` },
        params: { limit: LIMIT_PER_PAGE, ...(cursor ? { start: cursor } : {}) },
      });

    let nextRequest = getPage(startCursor);

    while (true) {
      const { data } = await nextRequest;

      if (data.next) nextRequest = getPage(data.next); // prefetch next page before yielding

      yield { userIds: data.userIds, next: data.next };

      if (!data.next) break;
    }
  }
}

// ─── FollowerExportService ─────────────────────────────────────────────────

class FollowerExportService {
  private readonly apiClient: LineFollowerApiClient;
  private readonly writer: CsvStreamWriter;
  private readonly startTime = Date.now();
  private readonly idsAtStart: number;
  private totalIds: number;
  private page: number;

  constructor(private readonly saved: Checkpoint | null) {
    this.apiClient = new LineFollowerApiClient(TOKEN);
    this.totalIds = saved?.totalIds ?? 0;
    this.page = saved?.page ?? 0;
    this.idsAtStart = this.totalIds;
    this.writer = new CsvStreamWriter(OUTPUT_FILE, saved !== null);
  }

  async run(): Promise<void> {
    try {
      for await (const { userIds, next } of this.apiClient.fetchUserIds(this.saved?.cursor)) {
        this.writePage(userIds);
        this.updateCheckpoint(next);

        if (this.shouldPause(next)) break;
      }
    } finally {
      await this.writer.close();
    }


    logger.info({
      event:  !fs.existsSync(CHECKPOINT_FILE) ? 'fetch.complete' : 'fetch.paused',
      totalPages: this.page,
      totalUsers: this.totalIds,
      thisRunIds: this.totalIds - this.idsAtStart,
      heapMB: heapMemory(),
      totalElapsedMs: Date.now() - this.startTime,
      ...( !fs.existsSync(CHECKPOINT_FILE) ? 
      { outputFile: OUTPUT_FILE } : 
      { hint: 'Run again to continue from checkpoint' }),
    });
  }

  private writePage(userIds: string[]): void {
    this.writer.append(userIds);
    this.totalIds += userIds.length;
    this.page++;
  }

  private updateCheckpoint(next?: string): void {
    if (next) {
      checkpointManager.save({ cursor: next, totalIds: this.totalIds, page: this.page });
    } else {
      checkpointManager.clear();
    }
  }

  private shouldPause(next?: string): boolean {
    return this.totalIds - this.idsAtStart >= BATCH_SIZE && !!next;
  }

}

// ─── Export ────────────────────────────────────────────────────────────────

async function exportFollowers(): Promise<void> {
  const saved = checkpointManager.load();

  if (saved) {
    logger.info({ 
      event: 'fetch.resuming', 
      fromPage: saved.page, 
      fromTotalIds: saved.totalIds 
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

  logger.info({ event: 'script.start' });

  await exportFollowers();

  logger.info({ event: 'script.done' });
}

main();
