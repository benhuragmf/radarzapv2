import {
  assertBridgeClientMatch,
  buildBridgeIdempotencyKey,
  BRIDGE_FORWARD_DEDUP_MS,
  isBridgeAlertBodySafe,
  isBridgeForwardedVisitorFormat,
  isBridgeLoopRisk,
  isDuplicateBridgeForward,
  normalizeBridgeProductStatus,
  shouldForwardBridgeMessage,
  shouldProcessBridgeAgentReply,
} from '@/utils/webchat-bridge.util';
import { buildWhatsAppFallbackAlertBody } from '@/services/webchat/webchat-whatsapp-fallback.service';

describe('webchat-bridge.util', () => {
  it('normalizeBridgeProductStatus mapeia estados', () => {
    expect(normalizeBridgeProductStatus({ whatsappBridgeActive: true })).toBe('active');
    expect(normalizeBridgeProductStatus({ conversationStatus: 'closed' })).toBe('closed');
    expect(
      normalizeBridgeProductStatus({
        queueStatus: 'waiting_human',
        fallbackEnabled: true,
      }),
    ).toBe('pending');
    expect(normalizeBridgeProductStatus({ fallbackEnabled: true })).toBe('available');
    expect(normalizeBridgeProductStatus({})).toBe('disabled');
  });

  it('buildBridgeIdempotencyKey normaliza espaços', () => {
    const k1 = buildBridgeIdempotencyKey('org1', 'conv1', '  olá   mundo  ');
    const k2 = buildBridgeIdempotencyKey('org1', 'conv1', 'olá mundo');
    expect(k1).toBe(k2);
  });

  it('shouldForwardBridgeMessage bloqueia duplicata recente', () => {
    const key = 'org:conv:oi';
    expect(shouldForwardBridgeMessage(key, 1000)).toBe(true);
    expect(shouldForwardBridgeMessage(key, 2000)).toBe(false);
    expect(shouldForwardBridgeMessage(key, 1000 + BRIDGE_FORWARD_DEDUP_MS + 1)).toBe(true);
  });

  it('isDuplicateBridgeForward versão pura', () => {
    expect(isDuplicateBridgeForward('k', undefined, 5000)).toBe(false);
    expect(isDuplicateBridgeForward('k', 4000, 5000)).toBe(true);
    expect(isDuplicateBridgeForward('k', 4000, 4000 + BRIDGE_FORWARD_DEDUP_MS)).toBe(false);
  });

  it('detecta formato encaminhado visitante e risco de loop', () => {
    expect(isBridgeForwardedVisitorFormat('*[Site · TK-ABC123] Maria*\nOi')).toBe(true);
    expect(isBridgeLoopRisk('Novo chamado no Radar Chat')).toBe(true);
    expect(isBridgeLoopRisk('Resposta normal do atendente')).toBe(false);
  });

  it('shouldProcessBridgeAgentReply rejeita comando e eco', () => {
    expect(shouldProcessBridgeAgentReply('!ajuda')).toBe(false);
    expect(shouldProcessBridgeAgentReply('*[Site] João*\nOi')).toBe(false);
    expect(shouldProcessBridgeAgentReply('Olá, posso ajudar?')).toBe(true);
  });

  it('assertBridgeClientMatch impede cross-tenant', () => {
    expect(() => assertBridgeClientMatch('org-a', 'org-a')).not.toThrow();
    expect(() => assertBridgeClientMatch('org-a', 'org-b')).toThrow(/organização/);
  });

  it('alerta fallback não expõe tokens sensíveis', () => {
    const body = buildWhatsAppFallbackAlertBody({
      ticketRef: 'TK-TEST01',
      visitorName: 'Maria',
      initialMessage: 'Preciso de orçamento',
    });
    expect(isBridgeAlertBodySafe(body)).toBe(true);
    expect(body).not.toMatch(/wck_/i);
    expect(body.toLowerCase()).not.toContain('clientid');
    expect(body).toContain('!assumir');
  });
});
