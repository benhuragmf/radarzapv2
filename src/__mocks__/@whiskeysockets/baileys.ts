/**
 * Manual stub for @whiskeysockets/baileys.
 * The real package uses native binaries (whatsapp-rust-bridge) that cannot run
 * in the Jest environment. Tests that need WhatsApp socket behaviour mock the
 * sessions Map directly, so this stub only needs to export the shapes that
 * WhatsAppService imports at the module level.
 */

export const makeWASocket = jest.fn();
export const useMultiFileAuthState = jest.fn().mockResolvedValue({
  state: {},
  saveCreds: jest.fn(),
});
export const DisconnectReason = {
  loggedOut: 401,
  connectionClosed: 428,
  connectionLost: 408,
  connectionReplaced: 440,
  timedOut: 408,
  badSession: 500,
  restartRequired: 515,
  multideviceMismatch: 411,
};
export const fetchLatestBaileysVersion = jest.fn().mockResolvedValue({
  version: [2, 3000, 0],
  isLatest: true,
});
export const makeCacheableSignalKeyStore = jest.fn((store: any) => store);
export const isJidGroup = jest.fn((jid: string) => jid.endsWith('@g.us'));
export const isJidUser = jest.fn((jid: string) => jid.endsWith('@s.whatsapp.net'));
export const jidNormalizedUser = jest.fn((jid: string) => jid);
