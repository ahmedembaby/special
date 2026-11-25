/**
 * WhatsApp OTP delivery (whatsapp-web.js).
 * The server logs in once as a normal WhatsApp account (scan the QR code, see /api/whatsapp/setup);
 * the session is stored in .wwebjs_auth and re-used on every start.
 */
const fs = require('fs');
const path = require('path');
const qrcodeTerminal = require('qrcode-terminal');
const { WHATSAPP_ENABLED, CHROME_PATH } = require('../config');

let QRCode = null;
try { QRCode = require('qrcode'); } catch { /* optional: the terminal QR still works */ }

const STATUS = { DISABLED: 'disabled', STARTING: 'starting', QR: 'qr', AUTHENTICATED: 'authenticated', READY: 'ready', DISCONNECTED: 'disconnected', ERROR: 'error' };

let Client;
let LocalAuth;
let client = null;
let status = WHATSAPP_ENABLED ? STATUS.STARTING : STATUS.DISABLED;
let lastQr = null;
let lastError = WHATSAPP_ENABLED ? null : 'WhatsApp disabled (WHATSAPP_ENABLED=false)';
let restartTimer = null;
let starting = false;

/** CHROME_PATH from .env, otherwise the first Chrome / Edge / Chromium found in the usual places. */
function findBrowser() {
  if (CHROME_PATH) return fs.existsSync(CHROME_PATH) ? CHROME_PATH : null;
  const env = process.env;
  const candidates = {
    win32: [
      path.join(env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/snap/bin/chromium'],
  }[process.platform] || [];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function scheduleRestart(ms, reason) {
  if (restartTimer || !WHATSAPP_ENABLED) return;
  console.log(`WhatsApp: restarting in ${Math.round(ms / 1000)}s (${reason})`);
  restartTimer = setTimeout(() => { restartTimer = null; start(); }, ms);
}

// WhatsApp Web changes its internal code often. When the newest build breaks whatsapp-web.js
// (sends fail with the minified "t: t" error even though the client is "ready"), pin a build
// that is known to work. Set WA_WEB_VERSION in .env to try another one, or to "latest" to disable the pin.
// Builds come from https://github.com/wppconnect-team/wa-version/tree/main/html
const DEFAULT_WA_WEB_VERSION = '2.3000.1055790926-alpha';
function webVersionOptions() {
  const version = (process.env.WA_WEB_VERSION || DEFAULT_WA_WEB_VERSION).trim();
  if (!version || version.toLowerCase() === 'latest') return {};
  console.log(`WhatsApp: pinning WhatsApp Web build ${version}`);
  return {
    webVersion: version,
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
      strict: false,
    },
  };
}

async function destroyClient() {
  const c = client;
  client = null;
  if (c) { try { await c.destroy(); } catch { /* browser already gone */ } }
}

async function start() {
  if (!WHATSAPP_ENABLED || starting) return;
  starting = true;
  status = STATUS.STARTING;
  lastError = null;
  lastQr = null;
  try {
    ({ Client, LocalAuth } = require('whatsapp-web.js'));
    const browser = findBrowser();
    if (!browser) {
      throw Object.assign(new Error(
        CHROME_PATH
          ? `CHROME_PATH does not exist: ${CHROME_PATH}`
          : 'Chrome / Edge was not found. Install Chrome or set CHROME_PATH in .env (chromedriver is not a browser).'
      ), { fatal: true });
    }
    console.log(`WhatsApp: starting with ${browser}`);

    await destroyClient();
    client = new Client({
      authStrategy: new LocalAuth({ clientId: 'echat-whatsapp' }),
      ...webVersionOptions(),
      puppeteer: {
        headless: true,
        executablePath: browser,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      },
    });

    client.on('qr', async (qr) => {
      status = STATUS.QR;
      lastQr = qr;
      console.log('=== WhatsApp: scan this QR with the phone that will send the codes (WhatsApp > Linked devices) ===');
      qrcodeTerminal.generate(qr, { small: true });
      console.log('    or open http://localhost:<PORT>/api/whatsapp/setup');
    });
    client.on('authenticated', () => { status = STATUS.AUTHENTICATED; lastQr = null; console.log('WhatsApp: authenticated'); });
    client.on('auth_failure', (msg) => {
      status = STATUS.ERROR;
      lastError = `Authentication failed: ${msg}`;
      console.error('WhatsApp:', lastError, '- delete the .wwebjs_auth folder and scan again');
    });
    client.on('ready', () => { status = STATUS.READY; lastQr = null; lastError = null; console.log('WhatsApp: ready, OTP codes will be sent from', client.info?.wid?.user || 'the linked account'); });
    client.on('disconnected', (reason) => {
      status = STATUS.DISCONNECTED;
      lastError = `Disconnected: ${reason}`;
      console.warn('WhatsApp:', lastError);
      destroyClient().finally(() => scheduleRestart(10000, 'disconnected'));
    });

    await client.initialize();
  } catch (err) {
    status = STATUS.ERROR;
    lastError = String(err.message || err).split('\n')[0];
    console.error('WhatsApp initialization failed:', lastError);
    if (err.fatal) console.error('     -> or set WHATSAPP_ENABLED=false and use OTP_DEV_MODE=true for development.');
    await destroyClient();
    if (!err.fatal) scheduleRestart(30000, 'init error');
  } finally {
    starting = false;
  }
}

async function restart() {
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  await destroyClient();
  starting = false;
  return start();
}

/** Unlink the account and wipe the saved session (a new QR is shown afterwards). */
async function logout() {
  const c = client;
  if (c) { try { await c.logout(); } catch { /* not logged in */ } }
  await destroyClient();
  try { fs.rmSync(path.join(process.cwd(), '.wwebjs_auth', 'session-echat-whatsapp'), { recursive: true, force: true }); } catch { /* ignore */ }
  starting = false;
  return start();
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('WhatsApp timed out')), ms))]);

/**
 * Send the code. Returns { success, code? }:
 *  NOT_READY, NOT_ON_WHATSAPP, SEND_FAILED when it could not be delivered.
 */
async function sendOTP(phoneNumber, code) {
  if (!client || status !== STATUS.READY) {
    console.warn(`WhatsApp not ready (${status}); OTP delivery skipped for destination ending ${String(phoneNumber).replace(/\D/g, '').slice(-2) || '**'}`);
    return { success: false, code: 'NOT_READY', message: 'WhatsApp is not connected. Open /api/whatsapp/setup and scan the QR code.' };
  }
  const digits = String(phoneNumber).replace(/\D/g, '');
  const text = `*E-Chat*\n\nرمز التحقق الخاص بك: *${code}*\nYour verification code: *${code}*\n\nصالح لمدة 5 دقائق · Valid for 5 minutes.\nلا تشاركه مع أي شخص · Do not share it with anyone.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // Resolves the real WhatsApp id (and tells us if the number has WhatsApp at all).
      // WhatsApp Web updates sometimes break this lookup inside the page (an opaque "t: t" error, e.g. when the
      // `_serialized` property is renamed). A thrown lookup error is not proof that the number is unregistered,
      // so in that case fall back to addressing the chat directly instead of failing the whole OTP.
      let id = null;
      let lookupFailed = false;
      try {
        id = await withTimeout(client.getNumberId(digits), 20000);
      } catch (lookupErr) {
        lookupFailed = true;
        console.warn(`WhatsApp: getNumberId failed (${String(lookupErr && lookupErr.message || lookupErr).split('\n')[0]}); sending to ${'*'.repeat(Math.max(digits.length - 2, 0))}${digits.slice(-2)}@c.us directly`);
      }
      if (!lookupFailed && !id) return { success: false, code: 'NOT_ON_WHATSAPP', message: 'This number is not registered on WhatsApp' };
      // `_serialized` may have been renamed to `$1` by WhatsApp Web
      const chatId = (id && (id._serialized || id.$1)) || `${digits}@c.us`;
      await withTimeout(client.sendMessage(chatId, text), 20000);
      console.log(`WhatsApp: OTP sent to +${digits}`);
      return { success: true, message: 'OTP sent via WhatsApp' };
    } catch (err) {
      const detail = err instanceof Error ? (err.stack || err.message) : (typeof err === 'string' ? err : JSON.stringify(err));
      console.error(`WhatsApp send failed (attempt ${attempt}, client status=${status}, state=${await client?.getState?.().catch((e) => `getState error: ${e && e.message}`)}):`, detail);
      if (attempt === 2) return { success: false, code: 'SEND_FAILED', message: String(err && err.message || err) };
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { success: false, code: 'SEND_FAILED' };
}

async function getState() {
  let qrImage = null;
  if (lastQr && QRCode) {
    try { qrImage = await QRCode.toDataURL(lastQr, { margin: 1, width: 300 }); } catch { /* ignore */ }
  }
  return { status, ready: status === STATUS.READY, qr: lastQr, qrImage, error: lastError, account: client?.info?.wid?.user || null };
}

module.exports = { start, restart, logout, sendOTP, getState, isClientReady: () => status === STATUS.READY, STATUS };
