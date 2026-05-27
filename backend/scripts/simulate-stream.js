/**
 * simulate-stream.js
 *
 * 1. Invia subito 1 allarme di test → push notification immediata
 * 2. Poi invia 10 keepalive + 10 allarmi alternati, 5 secondi l'uno dall'altro
 *    → la dashboard si aggiorna in tempo reale via SSE
 *
 * Run: node scripts/simulate-stream.js
 */
import 'dotenv/config';
import net from 'net';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TCP_HOST = 'localhost';
const TCP_PORT = parseInt(process.env.TCP_PORT || '23683');

/* ─── CRC16-IBM ─── */
function reverseChar(byte) {
  let tmp = 0;
  for (let i = 0; i < 8; i++) {
    if (byte & (1 << i)) tmp |= (1 << (7 - i));
  }
  return tmp;
}
function crc16ibm(str) {
  const polynomial = 0x8005;
  let crc = 0;
  for (let i = 0; i < str.length; i++) {
    const c = reverseChar(str.charCodeAt(i) & 0xff);
    crc ^= c << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = ((crc << 1) & 0xffff) ^ polynomial;
      else crc = (crc << 1) & 0xffff;
    }
  }
  const lo = crc & 0xff;
  const hi = (crc >> 8) & 0xff;
  return (reverseChar(hi) | (reverseChar(lo) << 8)).toString(16).toUpperCase().padStart(4, '0');
}
function fmtLen(len) { return len.toString(16).padStart(4, '0'); }

function siaTs() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())},${p(d.getMonth()+1)}-${p(d.getDate())}-${d.getFullYear()}`;
}

function sendSia(payload) {
  return new Promise((resolve, reject) => {
    const crc = crc16ibm(payload);
    const frame = Buffer.from(`\n${crc}${fmtLen(payload.length)}${payload}\r`, 'latin1');
    const sock = net.createConnection(TCP_PORT, TCP_HOST);
    sock.setTimeout(5000);
    sock.on('connect', () => sock.write(frame));
    sock.on('data', () => { sock.destroy(); resolve(); });
    sock.on('timeout', () => { sock.destroy(); reject(new Error('Timeout')); });
    sock.on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ─── Codici SIA allarme con descrizioni leggibili ─── */
const ALARM_CODES = [
  { code: 'BA', zone: 1, label: 'Allarme intrusione zona 1' },
  { code: 'FA', zone: 2, label: 'Rilevatore fumo zona 2' },
  { code: 'PA', zone: 3, label: 'Allarme panico zona 3' },
  { code: 'TA', zone: 4, label: 'Manomissione zona 4' },
  { code: 'BA', zone: 5, label: 'Allarme intrusione zona 5' },
  { code: 'WA', zone: 6, label: 'Allarme alluvione zona 6' },
  { code: 'FA', zone: 7, label: 'Rilevatore calore zona 7' },
  { code: 'PA', zone: 1, label: 'Allarme emergenza zona 1' },
  { code: 'TA', zone: 3, label: 'Sabotaggio zona 3' },
  { code: 'BA', zone: 2, label: 'Allarme perimetrale zona 2' },
];

async function main() {
  console.log(`\n🎯  Simulazione stream SIA → ${TCP_HOST}:${TCP_PORT}\n`);

  // Prendi 10 clienti reali dal DB
  const customers = await prisma.customer.findMany({
    where: { freezedAt: null },
    take: 10,
    orderBy: { account: 'asc' },
    select: { account: true, customer: true },
  });

  if (customers.length === 0) {
    console.error('❌ Nessun cliente nel DB');
    process.exit(1);
  }

  // Cicla se meno di 10 clienti
  const accounts = Array.from({ length: 10 }, (_, i) => customers[i % customers.length]);

  // ──────────────────────────────────────────────────────
  // FASE 0 — Allarme singolo immediato → push notification
  // ──────────────────────────────────────────────────────
  const c0 = accounts[0];
  const a0 = ALARM_CODES[0];
  console.log('━'.repeat(55));
  console.log(`📲  PUSH TEST — allarme immediato`);
  console.log(`    Cliente : ${c0.customer}`);
  console.log(`    Account : ${c0.account}`);
  console.log(`    Codice  : N${a0.code}${a0.zone} — ${a0.label}`);
  console.log('━'.repeat(55));

  const p0 = `"SIA-DCS"0001R000001L010000#${c0.account}[|N${a0.code}${a0.zone}^${a0.label}^]_${siaTs()}`;
  await sendSia(p0);
  console.log('    ✅ Inviato — notifica push in arrivo!\n');
  await sleep(2000);

  // ──────────────────────────────────────────────────────
  // FASE 1 — 10 keepalive + 10 allarmi alternati, 5 s ciascuno
  // ──────────────────────────────────────────────────────
  console.log('━'.repeat(55));
  console.log(`📊  STREAM: 20 messaggi alternati (KA/Allarme) ogni 5s`);
  console.log('━'.repeat(55));

  for (let i = 0; i < 10; i++) {
    const c = accounts[i];
    const now = new Date().toLocaleTimeString('it-IT');

    // ── KeepAlive ──
    const kaPay = `"NULL"0000R000001L010000#${c.account}[]_${siaTs()}`;
    process.stdout.write(`[${now}] 📡  KA  #${String(i+1).padStart(2,' ')} — ${c.customer.substring(0,35).padEnd(35)} `);
    await sendSia(kaPay);
    console.log('✓');
    await sleep(5000);

    // ── Allarme ──
    const al = ALARM_CODES[i];
    const alPay = `"SIA-DCS"${String(i+10).padStart(4,'0')}R000001L010000#${c.account}[|N${al.code}${al.zone}^${al.label}^]_${siaTs()}`;
    const alNow = new Date().toLocaleTimeString('it-IT');
    process.stdout.write(`[${alNow}] 🚨  AL  #${String(i+1).padStart(2,' ')} — ${c.customer.substring(0,35).padEnd(35)} `);
    await sendSia(alPay);
    console.log(`✓  (${al.code}${al.zone} — ${al.label})`);

    if (i < 9) await sleep(5000);
  }

  console.log('\n' + '━'.repeat(55));
  console.log('✅  Stream completato!');
  console.log('   • 1 push notification immediata (fase 0)');
  console.log('   • 10 KeepAlive registrati');
  console.log('   • 10 Allarmi registrati (codici: BA, FA, PA, TA, WA)');
  console.log('   • Dashboard aggiornata in tempo reale via SSE');
  console.log('━'.repeat(55));
}

main()
  .catch(err => {
    console.error('\n❌', err.message);
    if (err.message.includes('ECONNREFUSED')) {
      console.error('   Backend non attivo su', TCP_HOST + ':' + TCP_PORT);
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
