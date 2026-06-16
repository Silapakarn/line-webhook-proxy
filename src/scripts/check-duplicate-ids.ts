import fs from 'fs';
import path from 'path';
import { logger } from '../helpers/Logger/logger';

// ─── Config ────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(process.cwd(), 'output');
const TARGET_FILE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(OUTPUT_DIR, 'king_power_users_v3.csv');

const DUPLICATE_REPORT_FILE = path.join(OUTPUT_DIR, 'duplicate_ids_report_(king_power).csv');

// ─── Reader ────────────────────────────────────────────────────────────────

function readIds(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    logger.error({ event: 'duplicate_check.file_not_found', filePath });
    process.exit(1);
  }

  return fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

// ─── Duplicate Finder ──────────────────────────────────────────────────────

function findDuplicates(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const duplicates = new Map<string, number>();
  for (const [id, count] of counts) {
    if (count > 1) duplicates.set(id, count);
  }

  return duplicates;
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  logger.info({ event: 'duplicate_check.start', targetFile: TARGET_FILE });

  const ids = readIds(TARGET_FILE);
  const duplicates = findDuplicates(ids);

  logger.info({
    event: 'duplicate_check.result',
    totalLines: ids.length,
    uniqueIds: ids.length - [...duplicates.values()].reduce((sum, count) => sum + (count - 1), 0),
    duplicateIds: duplicates.size,
    duplicateLinesExtra: [...duplicates.values()].reduce((sum, count) => sum + (count - 1), 0),
  });

  if (duplicates.size > 0) {
    const report = [...duplicates.entries()]
      .map(([id, count]) => `${id},${count}`)
      .join('\n');

    fs.writeFileSync(DUPLICATE_REPORT_FILE, `userId,count\n${report}`, 'utf-8');
    logger.info({ event: 'duplicate_check.report_saved', outputFile: DUPLICATE_REPORT_FILE });
  } else {
    logger.info({ event: 'duplicate_check.no_duplicates_found' });
  }

  logger.info({ event: 'duplicate_check.done' });
}

main();
