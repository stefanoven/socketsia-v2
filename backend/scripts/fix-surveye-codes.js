/**
 * Fix script: update surveyeCode for customers that were incorrectly migrated.
 *
 * Root cause: the original parseInserts regex failed to handle closing parentheses
 * inside quoted SQL string values (e.g. addresses like 'Brescia (BS)').
 * As a result, surveyeCode and subsequent fields were parsed as undefined → ''.
 *
 * This script:
 *   1. Re-reads socketsia_customers.sql using a correct state-machine parser
 *   2. For each customer, if surveyeCode in DB is '' but dump has a value → UPDATE
 *   3. Also fixes address if it was truncated by the same bug
 *
 * Run with: node scripts/fix-surveye-codes.js
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DUMP_DIR = join(__dirname, '../../../dbdump');
const prisma = new PrismaClient();

/**
 * Parse a MySQL VALUES tuple string into an array of JS values.
 * Handles: NULL, integers, floats, single-quoted strings (with \' and \\ escapes).
 */
function parseValues(raw) {
  const values = [];
  let i = 0;

  while (i < raw.length) {
    while (i < raw.length && (raw[i] === ' ' || raw[i] === ',')) i++;
    if (i >= raw.length) break;

    if (raw[i] === 'N' && raw.startsWith('NULL', i)) {
      values.push(null);
      i += 4;
    } else if (raw[i] === "'") {
      i++; // skip opening quote
      let str = '';
      while (i < raw.length) {
        if (raw[i] === '\\') {
          i++;
          const esc = raw[i];
          if (esc === 'n') str += '\n';
          else if (esc === 't') str += '\t';
          else if (esc === 'r') str += '\r';
          else str += esc;
        } else if (raw[i] === "'") {
          i++; break; // closing quote
        } else {
          str += raw[i];
        }
        i++;
      }
      values.push(str);
    } else {
      let num = '';
      while (i < raw.length && raw[i] !== ',' && raw[i] !== ' ') {
        num += raw[i++];
      }
      if (num === '') continue;
      if (num.includes('.')) values.push(parseFloat(num));
      else values.push(parseInt(num, 10));
    }
  }

  return values;
}

/**
 * State-machine based INSERT parser — correctly handles ')' inside quoted strings.
 */
function parseInserts(filename) {
  const content = readFileSync(join(DUMP_DIR, filename), 'utf8');
  const insertRegex = /INSERT INTO `\w+` VALUES\s*([\s\S]+?);/g;
  const rows = [];

  let match;
  while ((match = insertRegex.exec(content)) !== null) {
    const block = match[1];
    let depth = 0, inStr = false, rowStart = -1;
    for (let i = 0; i < block.length; i++) {
      const ch = block[i];
      if (!inStr) {
        if (ch === '(') {
          if (depth === 0) rowStart = i + 1;
          depth++;
        } else if (ch === ')') {
          depth--;
          if (depth === 0 && rowStart >= 0) {
            rows.push(parseValues(block.slice(rowStart, i)));
            rowStart = -1;
          }
        } else if (ch === "'") {
          inStr = true;
        }
      } else {
        if (ch === '\\') {
          i++; // skip escaped char
        } else if (ch === "'") {
          inStr = false;
        }
      }
    }
  }

  return rows;
}

async function fixSurveyeCodes() {
  console.log('→ Reading socketsia_customers.sql with fixed parser...');
  const rows = parseInserts('socketsia_customers.sql');
  console.log(`  Found ${rows.length} rows in dump`);

  let fixed = 0;
  let alreadyOk = 0;
  let skipped = 0;

  for (const r of rows) {
    // Column order: id, account, customer, address, surveye_code, ...
    const [id, account, customer, address, surveyeCode] = r;
    const accountStr = String(account);

    if (!surveyeCode) {
      skipped++;
      continue; // dump itself has no surveyeCode (shouldn't happen)
    }

    // Check current DB value
    const existing = await prisma.customer.findUnique({
      where: { account: accountStr },
      select: { surveyeCode: true, address: true },
    });

    if (!existing) {
      skipped++;
      continue; // customer not in DB at all
    }

    if (existing.surveyeCode !== '' && existing.surveyeCode !== null) {
      alreadyOk++;
      continue; // already has correct value
    }

    // surveyeCode is '' or null → update it + fix address too (also truncated by the bug)
    await prisma.customer.update({
      where: { account: accountStr },
      data: {
        surveyeCode: String(surveyeCode),
        address: address || existing.address || '',
      },
    });
    console.log(`  ✓ Fixed ${accountStr}: surveyeCode="${surveyeCode}", address="${address}"`);
    fixed++;
  }

  console.log(`\n─── Summary ────────────────────────────────`);
  console.log(`  Already correct : ${alreadyOk}`);
  console.log(`  Fixed           : ${fixed}`);
  console.log(`  Skipped (no data): ${skipped}`);
  console.log(`────────────────────────────────────────────`);

  // Verify: how many still have empty surveyeCode?
  const stillEmpty = await prisma.customer.count({ where: { surveyeCode: '' } });
  if (stillEmpty > 0) {
    console.warn(`  ⚠ ${stillEmpty} customers still have empty surveyeCode`);
  } else {
    console.log(`  ✓ All customers now have surveyeCode set`);
  }

  await prisma.$disconnect();
}

fixSurveyeCodes().catch((err) => {
  console.error('Fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
