/**
 * Email Service
 * Sends alarm and keep-alive notification emails via SMTP relay.
 * Matches the legacy AlarmReceivedListener and KeepAliveDetectedListener.
 */
import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      // No auth for relay
    });
  }
  return transporter;
}

const MAIL_TO = process.env.MAIL_TO || 'tecnologici@surveye.it';
const MAIL_FROM = `"${process.env.MAIL_FROM_NAME || 'Surveye SIA Manager'}" <${process.env.MAIL_FROM || 'surveye.sia@surveye.it'}>`;

/**
 * Send alarm notification email.
 * Called by checkAlarms.job.js for each unnotified alarm.
 *
 * @param {object} alarm - Alarm record
 * @param {object} customer - Customer record
 * @param {object|null} siaCode - SIA code record with description
 */
export async function sendAlarmEmail(alarm, customer, siaCode) {
  const codeDesc = siaCode?.description ?? 'Codice sconosciuto';
  const subject = `Evento da ${alarm.customerId} - ${alarm.code} - ${alarm.detail}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ebb134; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0;">⚠️ Nuovo Evento da Gestire</h2>
      </div>
      <div style="border: 1px solid #ddd; padding: 20px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Account:</td>
            <td style="padding: 8px;">${alarm.customerId}</td>
          </tr>
          <tr style="background: #f9f9f9;">
            <td style="padding: 8px; font-weight: bold; color: #555;">Cliente:</td>
            <td style="padding: 8px;">${customer?.customer ?? 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Indirizzo:</td>
            <td style="padding: 8px;">${customer?.address ?? 'N/A'}</td>
          </tr>
          <tr style="background: #f9f9f9;">
            <td style="padding: 8px; font-weight: bold; color: #555;">Codice Surveye:</td>
            <td style="padding: 8px;">${customer?.surveyeCode ?? 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Codice Evento:</td>
            <td style="padding: 8px;"><strong style="color: #e53e3e;">${alarm.code}</strong> — ${codeDesc}</td>
          </tr>
          <tr style="background: #f9f9f9;">
            <td style="padding: 8px; font-weight: bold; color: #555;">Dettaglio:</td>
            <td style="padding: 8px;">${alarm.detail}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Data/Ora:</td>
            <td style="padding: 8px;">${alarm.createdAt?.toLocaleString('it-IT') ?? 'N/A'}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 12px; background: #fff3cd; border-left: 4px solid #ebb134; border-radius: 4px;">
          <p style="margin: 0; color: #856404;">Accedi all'applicazione per gestire questo evento.</p>
        </div>
      </div>
      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 16px;">
        Surveye SIA Manager — Sistema automatico di notifica
      </p>
    </div>
  `;

  await getTransporter().sendMail({
    from: MAIL_FROM,
    to: MAIL_TO,
    subject,
    html,
  });
}

/**
 * Send keep-alive lost (device offline) notification email.
 * Called by checkAlive.job.js when a customer goes offline.
 *
 * @param {object} customer - Customer record
 * @param {Date|null} lastSeen - Last keep-alive timestamp
 */
export async function sendKeepAliveEmail(customer, lastSeen) {
  const subject = `Rilevato Mancato Collegamento da ${customer.account} - ${customer.customer} - ${customer.surveyeCode}`;

  const lastSeenStr = lastSeen
    ? lastSeen.toLocaleString('it-IT')
    : 'Mai';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #e53e3e; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0;">🔴 Mancato Collegamento Rilevato</h2>
      </div>
      <div style="border: 1px solid #ddd; padding: 20px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Account:</td>
            <td style="padding: 8px;">${customer.account}</td>
          </tr>
          <tr style="background: #f9f9f9;">
            <td style="padding: 8px; font-weight: bold; color: #555;">Cliente:</td>
            <td style="padding: 8px;">${customer.customer}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Indirizzo:</td>
            <td style="padding: 8px;">${customer.address}</td>
          </tr>
          <tr style="background: #f9f9f9;">
            <td style="padding: 8px; font-weight: bold; color: #555;">Codice Surveye:</td>
            <td style="padding: 8px;">${customer.surveyeCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Ultimo Keep-Alive:</td>
            <td style="padding: 8px; color: #e53e3e;"><strong>${lastSeenStr}</strong></td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 12px; background: #fed7d7; border-left: 4px solid #e53e3e; border-radius: 4px;">
          <p style="margin: 0; color: #742a2a;">Il dispositivo non invia segnali da più di 3 ore. Verificare la connettività.</p>
        </div>
      </div>
      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 16px;">
        Surveye SIA Manager — Sistema automatico di notifica
      </p>
    </div>
  `;

  await getTransporter().sendMail({
    from: MAIL_FROM,
    to: MAIL_TO,
    subject,
    html,
  });
}
