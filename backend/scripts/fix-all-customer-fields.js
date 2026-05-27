/**
 * Fix All Customer Fields
 *
 * Aggiorna testedBy, testedAt, freezedBy, freezedAt, subscription, subscriptionDate
 * per TUTTI i 522 clienti usando il parser corretto (state-machine).
 *
 * Il bug parseInserts (regex) troncava le righe al primo ')' in indirizzi come
 * 'Brescia (BS)', lasciando null tutte le colonne dalla quinta in poi (indice 3+).
 * Lo script precedente (fix-surveye-codes.js) aveva fixato solo surveyeCode e address.
 *
 * Run: node scripts/fix-all-customer-fields.js
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
 * State-machine parser — handles ')' inside quoted strings correctly.
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
        if (ch === '\\') { i++; }
        else if (ch === "'") { inStr = false; }
      }
    }
  }

  return rows;
}

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
      i++;
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
      i++;
      values.push(str);
    } else {
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

async function main() {
  console.log('🔄 Fix-all-customer-fields: aggiornamento campi testedBy/testedAt/freezedBy/freezedAt/subscription/testedByName...');
  console.log(`   Dump directory: ${DUMP_DIR}\n`);

  // Carica tutti gli utenti dal DB (ID → nome) per risolvere testedBy/freezedBy
  const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));
  console.log(`   Utenti in DB: ${allUsers.length} (${allUsers.map(u => `${u.id}:${u.name}`).join(', ')})`);

  const rows = parseInserts('socketsia_customers.sql');
  console.log(`   Righe trovate nel dump: ${rows.length}`);

  let updated = 0;
  let skipped = 0;
  let errors  = 0;

  for (const r of rows) {
    // id, account, customer, address, surveye_code(4), created_by(5),
    // is_alive(6), is_alarms_snoozed(7), alarms_snoozed_by(8),
    // is_alive_snoozed(9), alive_snoozed_by(10),
    // tested_by(11), tested_at(12), freezed_by(13), freezed_at(14),
    // subscription(15), subscription_date(16), created_at(17), updated_at(18)
    const [
      , account, customer, address, surveyeCode, ,
      , , , , ,
      testedBy, testedAt, freezedBy, freezedAt, subscription, subscriptionDate,
    ] = r;

    const accountStr = String(account);

    // Verify customer exists in DB
    const existing = await prisma.customer.findUnique({ where: { account: accountStr } });
    if (!existing) {
      console.warn(`  ⚠ Account ${accountStr} non trovato nel DB — skip`);
      skipped++;
      continue;
    }

    try {
      await prisma.customer.update({
        where: { account: accountStr },
        data: {
          surveyeCode: surveyeCode || '',
          customer:    customer    || '',
          address:     address     || '',
          testedBy:     testedBy  || null,
          testedByName: testedBy  != null ? (userMap[Number(testedBy)] ?? null) : null,
          testedAt:     parseDate(testedAt),
          freezedBy:    freezedBy || null,
          freezedByName: freezedBy != null ? (userMap[Number(freezedBy)] ?? null) : null,
          freezedAt:    parseDate(freezedAt),
          subscription:     subscription     || 1,
          subscriptionDate: parseDate(subscriptionDate),
        },
      });
      updated++;
    } catch (err) {
      console.warn(`  ✗ Account ${accountStr}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Completato!`);
  console.log(`   Aggiornati:  ${updated}`);
  console.log(`   Saltati:     ${skipped}`);
  console.log(`   Errori:      ${errors}`);

  // Verification: count customers with testedAt
  const testedCount = await prisma.customer.count({ where: { testedAt: { not: null } } });
  const freezedCount = await prisma.customer.count({ where: { freezedAt: { not: null } } });
  console.log(`\n📊 Verifica DB:`);
  console.log(`   Clienti con testedAt:  ${testedCount}`);
  console.log(`   Clienti con freezedAt: ${freezedCount}`);
}

main()
  .catch((err) => {
    console.error('\n❌ Errore:', err.message);
    console.error(err.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
