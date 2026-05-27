/**
 * Data Migration Script: MySQL dumps → PostgreSQL (socketsia_v2)
 *
 * Reads SQL dump files from ../../dbdump/ and imports data into PostgreSQL.
 * Run with: node scripts/migrate-data.js
 *
 * Order: users → customers → alarms → sia_messages → keep_alives → abboattivi → statistics
 *
 * NOTE: This script parses the MySQL INSERT statements directly.
 * It handles the critical issue where alarms.customer_id is stored as bigint
 * in MySQL but represents the string account number (7-digit padded).
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
 * Parse MySQL INSERT VALUES from a SQL dump file.
 * Returns array of arrays (each row is an array of values).
 *
 * Uses a state-machine to find row boundaries, correctly handling
 * closing parentheses inside quoted strings (e.g. addresses like 'Brescia (BS)').
 */
function parseInserts(filename) {
  const content = readFileSync(join(DUMP_DIR, filename), 'utf8');
  const insertRegex = /INSERT INTO `\w+` VALUES\s*([\s\S]+?);/g;
  const rows = [];

  let match;
  while ((match = insertRegex.exec(content)) !== null) {
    const block = match[1];
    // Walk char-by-char tracking string context so we only count
    // parentheses that are NOT inside a quoted string value.
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
        // Inside a quoted string: skip escape sequences, detect closing quote
        if (ch === '\\') {
          i++; // skip the escaped character
        } else if (ch === "'") {
          inStr = false;
        }
      }
    }
  }

  return rows;
}

/**
 * Parse a MySQL VALUES tuple string into an array of JavaScript values.
 * Handles: NULL, integers, floats, quoted strings (with escape sequences).
 */
function parseValues(raw) {
  const values = [];
  let i = 0;

  while (i < raw.length) {
    // Skip whitespace and commas
    while (i < raw.length && (raw[i] === ' ' || raw[i] === ',')) i++;
    if (i >= raw.length) break;

    if (raw[i] === 'N' && raw.startsWith('NULL', i)) {
      values.push(null);
      i += 4;
    } else if (raw[i] === "'") {
      // Quoted string
      i++; // skip opening quote
      let str = '';
      while (i < raw.length && raw[i] !== "'") {
        if (raw[i] === '\\') {
          i++;
          const esc = raw[i];
          if (esc === 'n') str += '\n';
          else if (esc === 't') str += '\t';
          else if (esc === 'r') str += '\r';
          else str += esc;
        } else {
          str += raw[i];
        }
        i++;
      }
      i++; // skip closing quote
      values.push(str);
    } else {
      // Number
      let num = '';
      while (i < raw.length && raw[i] !== ',' && raw[i] !== ' ') {
        num += raw[i];
        i++;
      }
      if (num.includes('.')) values.push(parseFloat(num));
      else values.push(parseInt(num, 10));
    }
  }

  return values;
}

function parseDate(val) {
  if (!val || val === '0000-00-00 00:00:00') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Pad account number to 7 digits (MySQL stored as integer, we need string).
 */
function padAccount(val) {
  if (val === null || val === undefined) return null;
  return String(val).padStart(7, '0');
}

async function migrateUsers() {
  console.log('\n→ Migrating users...');
  const rows = parseInserts('socketsia_users.sql');

  for (const r of rows) {
    // id, name, email, email_verified_at, password, type, 2fa_secret, 2fa_codes, 2fa_confirmed_at, remember_token, created_at, updated_at
    const [id, name, email, , , type, , , , , createdAt, updatedAt] = r;

    await prisma.user.upsert({
      where: { email },
      create: {
        id,
        name,
        email,
        type: type || 'viewer',
        createdAt: parseDate(createdAt) || new Date(),
        updatedAt: parseDate(updatedAt) || new Date(),
      },
      update: { name, type: type || 'viewer' },
    });
  }

  console.log(`  ✓ ${rows.length} users migrated`);
}

async function migrateCustomers() {
  console.log('\n→ Migrating customers...');
  const rows = parseInserts('socketsia_customers.sql');

  let count = 0;
  for (const r of rows) {
    // id, account, customer, address, surveye_code, created_by, is_alive, is_alarms_snoozed,
    // alarms_snoozed_by, is_alive_snoozed, alive_snoozed_by, tested_by, tested_at,
    // freezed_by, freezed_at, subscription, subscription_date, created_at, updated_at
    const [
      id, account, customer, address, surveyeCode, createdBy,
      isAlive, isAlarmsSnoozed, alarmsSnoozedBy, isAliveSnoozed, aliveSnoozedBy,
      testedBy, testedAt, freezedBy, freezedAt, subscription, subscriptionDate,
      createdAt, updatedAt,
    ] = r;

    try {
      await prisma.customer.upsert({
        where: { account: String(account) },
        create: {
          id,
          account: String(account),
          customer: customer || '',
          address: address || '',
          surveyeCode: surveyeCode || '',
          createdBy: createdBy || 1,
          isAlive: Boolean(isAlive),
          isAlarmsSnoozed: Boolean(isAlarmsSnoozed),
          alarmsSnoozedBy: alarmsSnoozedBy || null,
          isAliveSnoozed: Boolean(isAliveSnoozed),
          aliveSnoozedBy: aliveSnoozedBy || null,
          testedBy: testedBy || null,
          testedAt: parseDate(testedAt),
          freezedBy: freezedBy || null,
          freezedAt: parseDate(freezedAt),
          subscription: subscription || 1,
          subscriptionDate: parseDate(subscriptionDate),
          createdAt: parseDate(createdAt) || new Date(),
          updatedAt: parseDate(updatedAt) || new Date(),
        },
        update: {
          surveyeCode:      surveyeCode      || '',
          customer:         customer         || '',
          address:          address          || '',
          testedBy:         testedBy         || null,
          testedAt:         parseDate(testedAt),
          freezedBy:        freezedBy        || null,
          freezedAt:        parseDate(freezedAt),
          subscription:     subscription     || 1,
          subscriptionDate: parseDate(subscriptionDate),
        },
      });
      count++;
    } catch (err) {
      console.warn(`  ✗ Customer ${account}: ${err.message}`);
    }
  }

  console.log(`  ✓ ${count} customers migrated`);
}

async function migrateAlarms() {
  console.log('\n→ Migrating alarms (this may take a while — 11,441 records)...');
  const rows = parseInserts('socketsia_alarms.sql');

  let count = 0;
  const BATCH = 500;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const data = batch.map((r) => {
      const [id, customerId, code, detail, siaRawMessage, mailSent, managedBy, createdAt, updatedAt] = r;
      return {
        id,
        customerId: padAccount(customerId),
        code: code || null,
        detail: detail || null,
        siaRawMessage: siaRawMessage || null,
        mailSent: Boolean(mailSent),
        managedBy: managedBy || null,
        createdAt: parseDate(createdAt) || new Date(),
        updatedAt: parseDate(updatedAt) || new Date(),
      };
    });

    // Filter out records where customer doesn't exist
    const validAccounts = new Set(
      (await prisma.customer.findMany({ select: { account: true } })).map((c) => c.account)
    );

    const validData = data.filter((d) => validAccounts.has(d.customerId));

    if (validData.length > 0) {
      await prisma.alarm.createMany({ data: validData, skipDuplicates: true });
      count += validData.length;
    }

    if ((i / BATCH) % 5 === 0) {
      process.stdout.write(`  ${count}/${rows.length} alarms...\r`);
    }
  }

  console.log(`\n  ✓ ${count} alarms migrated`);
}

async function migrateKeepAlives() {
  console.log('\n→ Migrating keep_alives...');
  const rows = parseInserts('socketsia_keep_alives.sql');

  let count = 0;
  const validAccounts = new Set(
    (await prisma.customer.findMany({ select: { account: true } })).map((c) => c.account)
  );

  for (const r of rows) {
    const [id, customerId, siaRawMessage, createdAt, updatedAt] = r;
    const account = padAccount(customerId);

    if (!validAccounts.has(account)) continue;

    try {
      await prisma.keepAlive.upsert({
        where: { customerId: account },
        create: {
          id,
          customerId: account,
          siaRawMessage: siaRawMessage || null,
          createdAt: parseDate(createdAt) || new Date(),
          updatedAt: parseDate(updatedAt) || new Date(),
        },
        update: {
          siaRawMessage: siaRawMessage || null,
          updatedAt: parseDate(updatedAt) || new Date(),
        },
      });
      count++;
    } catch (err) {
      console.warn(`  ✗ KeepAlive ${customerId}: ${err.message}`);
    }
  }

  console.log(`  ✓ ${count} keep_alives migrated`);
}

async function migrateAbboAttivi() {
  console.log('\n→ Migrating abboattivi...');
  const rows = parseInserts('socketsia_abboattivi.sql');

  if (rows.length === 0) {
    console.log('  (no data)');
    return;
  }

  await prisma.abboAttivi.deleteMany({});

  const data = rows.map((r) => {
    const [destinazione, scadenza] = r;
    return {
      destinazione: String(destinazione),
      scadenza: parseDate(scadenza) || new Date('2099-12-31'),
    };
  });

  await prisma.abboAttivi.createMany({ data, skipDuplicates: true });
  console.log(`  ✓ ${data.length} abboattivi migrated`);
}

async function migrateStatistics() {
  console.log('\n→ Migrating statistics...');
  const rows = parseInserts('socketsia_statistics.sql');

  if (rows.length === 0) {
    console.log('  (no data — using defaults)');
    return;
  }

  const [r] = rows;
  const [keepAlives, alarms] = r;

  const existing = await prisma.statistic.findFirst();
  if (existing) {
    await prisma.statistic.update({
      where: { id: existing.id },
      data: {
        keepAlives: BigInt(keepAlives || 0),
        alarms: BigInt(alarms || 0),
      },
    });
  } else {
    await prisma.statistic.create({
      data: {
        keepAlives: BigInt(keepAlives || 0),
        alarms: BigInt(alarms || 0),
      },
    });
  }
  console.log(`  ✓ Statistics: keepAlives=${keepAlives}, alarms=${alarms}`);
}

async function main() {
  console.log('🔄 Starting data migration from MySQL dumps → PostgreSQL (socketsia_v2)...');
  console.log(`   Dump directory: ${DUMP_DIR}\n`);

  await migrateUsers();
  await migrateCustomers();
  await migrateAlarms();
  await migrateKeepAlives();
  await migrateAbboAttivi();
  await migrateStatistics();

  // Verify counts
  console.log('\n📊 Verification:');
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.customer.count(),
    prisma.alarm.count(),
    prisma.keepAlive.count(),
    prisma.abboAttivi.count(),
    prisma.siaCode.count(),
  ]);
  console.log(`  Users: ${counts[0]}`);
  console.log(`  Customers: ${counts[1]}`);
  console.log(`  Alarms: ${counts[2]}`);
  console.log(`  KeepAlives: ${counts[3]}`);
  console.log(`  AbboAttivi: ${counts[4]}`);
  console.log(`  SIA Codes: ${counts[5]}`);

  console.log('\n✅ Migration complete!');
}

main()
  .catch((err) => {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
