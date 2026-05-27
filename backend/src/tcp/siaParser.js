/**
 * SIA IP DC09 Protocol Parser
 * Ported faithfully from the PHP SiaIP.php class in socketsia_legacy.
 *
 * Message format:
 *   <LF:0x0A> CCCC LLLL "TYPE" PAYLOAD [] <CR:0x0D>
 *
 * - CCCC: CRC16-IBM checksum (4 hex uppercase chars)
 * - LLLL: payload length formatted as sprintf('%04d', dechex(len))
 *         NOTE: this is dechex(len) zero-padded to 4 decimal digits — unusual!
 * - TYPE: "SIA-DCS" | "NULL" | "ACK"
 */

/**
 * CRC16-IBM checksum — exact port of the PHP SiaIP::crc16ibm() method.
 *
 * The PHP code calls: hash(str, 0x8005, initValue=0, xOrValue=0, inputReverse=true, outputReverse=true)
 *
 * Algorithm:
 *   - For each byte: bit-reverse it (inputReverse), XOR with crc<<8, then 8 rounds with poly 0x8005
 *   - Output: pack CRC as (lo, hi), bit-reverse each byte and swap them (reverseString), unpack as LE uint16
 *
 * Test vector:
 *   Input:  '"NULL"0000R000001L010000#99123456[]_06:39:58,08-16-2022'
 *   Output: '7D29'
 */

/** Bit-reverse a single byte (mirrors PHP reverseChar) */
function reverseChar(byte) {
  let tmp = 0;
  for (let i = 0; i < 8; i++) {
    if (byte & (1 << i)) tmp |= (1 << (7 - i));
  }
  return tmp;
}

export function crc16ibm(str) {
  const polynomial = 0x8005;
  let crc = 0; // initValue = 0

  for (let i = 0; i < str.length; i++) {
    // inputReverse = true: bit-reverse each input byte before XOR
    const c = reverseChar(str.charCodeAt(i) & 0xff);
    crc ^= c << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) & 0xffff) ^ polynomial;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  // xOrValue = 0 (no XOR needed)

  // outputReverse = true:
  //   PHP: pack('cc', lo, hi) → reverseString (swaps AND bit-reverses) → unpack('vshort')
  //   reverseString on 2 chars: str[0]=reverseChar(hi), str[1]=reverseChar(lo)
  //   unpack('vshort') little-endian: result = str[0] | str[1]<<8
  //   = reverseChar(hi) | reverseChar(lo)<<8
  const lo = crc & 0xff;
  const hi = (crc >> 8) & 0xff;
  const result = reverseChar(hi) | (reverseChar(lo) << 8);

  return result.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Formats the length field exactly as PHP does:
 *   sprintf('%04d', dechex(len))
 * i.e., convert length to hex, then zero-pad that hex string as decimal digits.
 * Example: len=34 → dechex(34)='22' → '0022'
 */
function formatLength(len) {
  const hexStr = len.toString(16); // dechex equivalent
  return hexStr.padStart(4, '0');  // sprintf('%04d', hexStr)
}

/**
 * Parse a raw SIA IP buffer received from a TCP connection.
 * Returns a parsed message object or null if the buffer is invalid/incomplete.
 *
 * @param {Buffer} rawBuffer - Raw bytes from TCP socket
 * @returns {SiaMessage|null}
 */
export function parseSiaMessage(rawBuffer) {
  // Need at least LF + 8 chars (CCCC+LLLL) + CR
  if (rawBuffer.length < 10) return null;

  // First byte must be 0x0A (LF), last byte 0x0D (CR)
  if (rawBuffer[0] !== 0x0a || rawBuffer[rawBuffer.length - 1] !== 0x0d) {
    return null;
  }

  // Decode the inner content (between LF and CR) as latin1 to preserve byte values
  const inner = rawBuffer.slice(1, rawBuffer.length - 1).toString('latin1');

  if (inner.length < 8) return null;

  const siaCRC = inner.substring(0, 4);
  const siaLength = inner.substring(4, 8);
  const siaPayload = inner.substring(8);

  // Validate CRC
  const computedCRC = crc16ibm(siaPayload);
  if (computedCRC !== siaCRC.toUpperCase()) {
    return {
      valid: false,
      error: `CRC mismatch: expected ${computedCRC}, got ${siaCRC}`,
      rawMessage: inner,
      payload: siaPayload,
    };
  }

  // Validate length: the stored length field is dechex(actual_length) zero-padded
  // So to verify: parseInt(siaLength, 16) should NOT be done — it's already a decimal-formatted hex
  // The field is dechex(len) → e.g. len=34 → stored as '0022'
  // To reverse: siaLength is a hex string, so parseInt(siaLength, 16) gives back the actual length
  const expectedLength = parseInt(siaLength, 16);
  if (siaPayload.length !== expectedLength) {
    // Some panels may have slight length differences — log but continue
    console.warn(`[SIA] Length mismatch: declared ${expectedLength}, actual ${siaPayload.length}`);
  }

  // Determine message type
  let messageType = null;
  if (siaPayload.includes('"NULL"')) {
    messageType = 'Keep-Alive';
  } else if (siaPayload.includes('"SIA-DCS"')) {
    messageType = 'SIA-Alarm';
  } else if (siaPayload.includes('"ACK"')) {
    messageType = 'ACK';
  } else {
    messageType = 'Unknown';
  }

  // Extract account number: appears after '#' before '['
  const account = extractAccount(siaPayload);

  return {
    valid: true,
    siaCRC,
    siaLength,
    siaPayload,
    rawMessage: inner,
    messageType,
    account,
  };
}

/**
 * Extract the account number from a SIA payload.
 * Account appears as #XXXXXXX in the payload.
 * Example: "...R000001L010000#99123456[..." → "99123456"
 */
function extractAccount(payload) {
  const hashIdx = payload.lastIndexOf('#');
  if (hashIdx === -1) return null;
  const bracketIdx = payload.indexOf('[', hashIdx);
  if (bracketIdx === -1) return payload.substring(hashIdx + 1);
  return payload.substring(hashIdx + 1, bracketIdx);
}

/**
 * Build the ACK response for a received SIA message.
 * Matches the PHP SiaIP::ack() method exactly.
 *
 * @param {string} siaPayload - The original payload string (after CCCC+LLLL)
 * @param {string} messageType - 'Keep-Alive' | 'SIA-Alarm'
 * @returns {Buffer} - Raw ACK bytes to send back to device
 */
export function buildAck(siaPayload, messageType) {
  // Find the protocol type marker position
  let typeMarker, typeLen;
  if (messageType === 'Keep-Alive') {
    typeMarker = '"NULL"';
  } else {
    typeMarker = '"SIA-DCS"';
  }

  const typePos = siaPayload.indexOf(typeMarker);
  if (typePos === -1) {
    // Fallback: return minimal ACK
    const fallback = '"ACK"0000[]';
    const ackPayload = fallback;
    const ackCRC = crc16ibm(ackPayload);
    const ackLen = formatLength(ackPayload.length);
    return Buffer.from(`\n${ackCRC}${ackLen}${ackPayload}\r`, 'latin1');
  }

  // Extract from after the type marker to the first '[', then append '[]'
  const afterType = siaPayload.substring(typePos + typeMarker.length);
  const bracketIdx = afterType.indexOf('[');
  const messageAssembled = bracketIdx !== -1
    ? afterType.substring(0, bracketIdx) + '[]'
    : afterType + '[]';

  const ackPayload = `"ACK"${messageAssembled}`;
  const ackCRC = crc16ibm(ackPayload);
  const ackLen = formatLength(ackPayload.length);

  const ackStr = `\n${ackCRC}${ackLen}${ackPayload}\r`;
  return Buffer.from(ackStr, 'latin1');
}

/**
 * Parse alarm code and detail from SIA-DCS raw message.
 * Ported from AlarmController::store() in the legacy PHP app.
 *
 * The code is extracted from between '|' and '^' (or '|' and ']' if no '^')
 * handling nested '/' separators.
 *
 * @param {string} rawMessage - The full SIA payload string
 * @returns {{ code: string, detail: string }}
 */
export function parseAlarmCodeAndDetail(rawMessage) {
  if (rawMessage.includes('^')) {
    // Has detail section between ^ delimiters
    let code = rawMessage.substring(
      rawMessage.indexOf('|') + 1,
      rawMessage.indexOf('^')
    );
    if (code.includes('/')) {
      code = code.substring(code.indexOf('/') + 1);
      if (code.includes('/')) {
        code = code.substring(code.indexOf('/') + 1);
      }
    } else {
      // Remove the leading zone/partition prefix character
      code = code.substring(1);
    }

    const detail = rawMessage.substring(
      rawMessage.indexOf('^') + 1,
      rawMessage.lastIndexOf('^')
    );
    return { code: code.trim(), detail: detail.trim() };
  } else {
    // No detail section
    let code = rawMessage.substring(
      rawMessage.indexOf('|') + 1,
      rawMessage.indexOf(']')
    );
    if (code.includes('/')) {
      code = code.substring(code.indexOf('/') + 1);
      if (code.includes('/')) {
        code = code.substring(code.indexOf('/') + 1);
      }
    } else {
      code = code.substring(1);
    }
    return { code: code.trim(), detail: 'Nessun Dettaglio Aggiuntivo' };
  }
}

/**
 * Validate the CRC16-IBM implementation using real messages from production.
 * Called on startup — if this fails the server refuses to accept connections.
 *
 * Test vectors extracted from real panel messages in the database:
 *  1. Keep-Alive: payload "NULL"0000R000001L010000#2104814[]_09:31:47,05-27-2026 → 13B1
 *  2. SIA-DCS:   payload "SIA-DCS"0222R000001L010000#3096589[...]_18:54:51 → A494
 */
export function validateCrcTestVector() {
  const tests = [
    {
      payload: '"NULL"0000R000001L010000#2104814[]_09:31:47,05-27-2026',
      expected: '13B1',
      label: 'Keep-Alive (real panel message)',
    },
    {
      payload: '"SIA-DCS"0222R000001L010000#3096589[#3096589|NEM4^Auxi 3 In Opis 1^][MA4580F952A70]_18:54:51,05-15-2026',
      expected: 'A494',
      label: 'SIA-DCS (real alarm message)',
    },
  ];

  let allOk = true;
  for (const t of tests) {
    const computed = crc16ibm(t.payload);
    if (computed !== t.expected) {
      console.error(`[SIA] CRC FAILED (${t.label}): expected ${t.expected}, got ${computed}`);
      allOk = false;
    } else {
      console.log(`[SIA] CRC OK (${t.label}): ${computed}`);
    }
  }
  return allOk;
}
