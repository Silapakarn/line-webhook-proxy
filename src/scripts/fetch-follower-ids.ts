import axios, { AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../helpers/Logger/logger';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChannelConfig {
  name: string;
  token: string;
  outputFile: string;
}

interface FollowerIdsPage {
  userIds: string[];
  next?: string;
}

// ─── CSV Stream Writer ──────────────────────────────────────────────────────
// Streams directly to disk per page — never buffers the full ID list in memory.

class CsvStreamWriter {
  private readonly stream: fs.WriteStream;
  private firstWrite = true;

  constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.stream = fs.createWriteStream(filePath, { encoding: 'utf-8' });
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

// ─── LINE Follower IDs Adapter ─────────────────────────────────────────────
class LineFollowerIdsAdapter {
  private static readonly URL = 'https://api.line.me/v2/bot/followers/ids';

  constructor(
    private readonly channelName: string,
    private readonly token: string,
  ) { }

  // Async generator — yields one page at a time so the caller can stream-write
  // without holding the full result set in memory.
  async *fetchListFollowers(): AsyncGenerator<string[]> {
    let cursor: string;
    let page = 1;

    logger.info({ event: 'adapter.fetch_start', channel: this.channelName });

    do {
      const { userIds, next } = await this.fetchPage(cursor, page);
      yield userIds;
      cursor = next;
      page++;
    } while (cursor);
  }

  private async fetchPage(cursor: string, page: number): Promise<FollowerIdsPage> {
    const params: Record<string, string> = {};
    if (cursor) params.start = cursor; // ถ้ามีหน้าถัดไป ให้ส่งพารามิเตอร์ start ไปบอก LINE

    try {
      const response = await axios.get<FollowerIdsPage>(LineFollowerIdsAdapter.URL, {
        headers: { Authorization: `Bearer ${this.token}` },
        params,
      });
      return response.data;
    } catch (err: unknown) {
      const axiosErr = err instanceof AxiosError ? err : undefined;
      const status = axiosErr?.response?.status;

      logger.error({
        event: 'adapter.fetch_error',
        channel: this.channelName,
        page,
        status,
        message: axiosErr?.response?.data?.message ?? (err instanceof Error ? err.message : String(err)),
      });
      throw err;
    }
  }
}










const PROGRESS_LOG_EVERY_N_PAGES = 100;

// ─── Follower Export Service ───────────────────────────────────────────────

class FollowerExportService {
  async exportChannel(channel: ChannelConfig): Promise<void> {
    const adapter = new LineFollowerIdsAdapter(channel.name, channel.token);
    const writer = new CsvStreamWriter(channel.outputFile);

    let totalIds = 0;
    let page = 0;

    try {
      // ลูปดึงหน้าข้อมูลแบบ Async Iteraterator แล้วเขียนลงไฟล์ทีละหน้า
      for await (const pageIds of adapter.fetchListFollowers()) {
        writer.append(pageIds);  // เอาข้อมูลหน้านี้ส่งไปเขียนลงดิสก์ทันที
        totalIds += pageIds.length;
        page++;


        //  Log ทุกๆ 100 หน้า เพื่อให้รู้ว่าระบบยังทำงานอยู่ ไม่ได้ค้าง
        if (page % PROGRESS_LOG_EVERY_N_PAGES === 0) {
          logger.info({
            event: 'service.export_progress',
            channel: channel.name,
            pagesCompleted: page,
            totalSoFar: totalIds,
          });
        }
      }
    } finally {
      await writer.close(); // ปิดท่อสตรีมไฟล์แน่นอน แม้ว่าระบบจะเกิดเออร์เรอร์กลางคัน
    }

    logger.info({
      event: 'service.export_complete',
      channel: channel.name,
      totalPages: page,
      totalUsers: totalIds,
      outputFile: channel.outputFile,
    });
  }


  async exportAll(channels: ChannelConfig[]): Promise<void> {
    logger.info({ event: 'service.export_start', channels: channels.map((c) => c.name) });


    // รันการดึงข้อมูลของทุกแชนแนลไปพร้อมๆ กันแบบขนาน (Parallel) ** ทำจริงจะมี 2 channels
    const results = await Promise.allSettled(channels.map((c) => this.exportChannel(c)));

    let hasFailure = false;
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        hasFailure = true;
        logger.error({
          event: 'service.export_failed',
          channel: channels[i].name,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });

    if (hasFailure) {
      logger.error({ event: 'service.export_done', status: 'partial_failure' });
      process.exit(1);
    }

    logger.info({ event: 'service.export_done', status: 'success' });
  }
}




// ─── Config ────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(process.cwd(), 'output');

function requireToken(envKey: string): string {
  const value = process.env[envKey];
  if (!value) {
    logger.error({ event: 'config.missing_env', envKey, hint: `Set ${envKey} in your .env file` });
    process.exit(1);
  }
  return value;
}

const CHANNELS: ChannelConfig[] = [
  {
    name: 'king-power',
    token: requireToken('KING_POWER_PROD_TOKEN'),
    outputFile: path.join(OUTPUT_DIR, 'king_power_users.csv'),
  },
];






// ─── Entry point ───────────────────────────────────────────────────────────

const service = new FollowerExportService();
service.exportAll(CHANNELS);
