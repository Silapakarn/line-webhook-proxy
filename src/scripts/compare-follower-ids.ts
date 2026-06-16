import fs from 'fs';
import path from 'path';
import { logger } from '../helpers/Logger/logger';

// ─── Config ────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(process.cwd(), 'output');

const KING_POWER_FILE   = path.join(OUTPUT_DIR, 'king_power_users_v3.csv');
const CHAT_TO_SHOP_FILE = path.join(OUTPUT_DIR, 'chat_to_shop_users_v3.csv');
const OVERLAP_FILE      = path.join(OUTPUT_DIR, 'overlap_users.csv');
const ONLY_CTS_FILE     = path.join(OUTPUT_DIR, 'only_chat_to_shop_users.csv');

// ─── Reader ────────────────────────────────────────────────────────────────

function readIds(filePath: string): Set<string> {
  if (!fs.existsSync(filePath)) {
    logger.error({ event: 'compare.file_not_found', filePath });
    process.exit(1);
  }

  const lines = fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return new Set(lines);
}

// ─── Compare ───────────────────────────────────────────────────────────────

interface CompareResult {
  overlap:  string[];
  onlyKP:   string[];
  onlyCTS:  string[];
}

function compare(kingPower: Set<string>, chatToShop: Set<string>): CompareResult {
  const overlap = [...kingPower].filter(id => chatToShop.has(id));
  const onlyKP  = [...kingPower].filter(id => !chatToShop.has(id));
  const onlyCTS = [...chatToShop].filter(id => !kingPower.has(id));

  return { overlap, onlyKP, onlyCTS };
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  logger.info({ event: 'compare.start' });

  const kingPower  = readIds(KING_POWER_FILE);
  const chatToShop = readIds(CHAT_TO_SHOP_FILE);

  logger.info({
    event: 'compare.loaded',
    kingPowerTotal:  kingPower.size,
    chatToShopTotal: chatToShop.size,
  });

  const { overlap, onlyKP, onlyCTS } = compare(kingPower, chatToShop);

  logger.info({
    event: 'compare.result',
    inBothChannels:        overlap.length,
    onlyInKingPower:       onlyKP.length,
    onlyInChatToShop:      onlyCTS.length,
    totalUniqueAcrossBoth: onlyKP.length + onlyCTS.length + overlap.length,
  });

  if (overlap.length > 0) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OVERLAP_FILE, overlap.join('\n'), 'utf-8');
    logger.info({ event: 'compare.overlap_saved', outputFile: OVERLAP_FILE });
  }

  if (onlyCTS.length > 0) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(ONLY_CTS_FILE, onlyCTS.join('\n'), 'utf-8');
    logger.info({ event: 'compare.only_chat_to_shop_saved', outputFile: ONLY_CTS_FILE });
  }

  logger.info({ event: 'compare.done' });
}

main();
