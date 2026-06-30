import {
  CSAT_MAX_INVALID_REMINDERS,
  emptyWaAutomatedPeerState,
  evaluateAutomatedPeerSuppression,
  isEchoOfRecentOutbound,
  looksLikeAutomatedPeerMessage,
  recordPeerInbound,
  recordPeerOutbound,
  WA_PEER_BURST_MAX_INBOUND,
} from '@/utils/wa-automated-peer.util';

describe('wa-automated-peer.util', () => {
  const t0 = 1_700_000_000_000;

  it('detecta eco de outbound recente', () => {
    let state = emptyWaAutomatedPeerState();
    state = recordPeerOutbound(state, 'Para avaliar, responda só com um número de 1 a 5.', t0);

    expect(
      isEchoOfRecentOutbound(
        'Para avaliar, responda só com um número de 1 a 5.',
        state,
        t0 + 5_000,
      ),
    ).toBe(true);
    expect(
      isEchoOfRecentOutbound(
        'Para avaliar, responda só com um número de 1 a 5.',
        state,
        t0 + 120_000,
      ),
    ).toBe(false);
  });

  it('detecta frases típicas de bot', () => {
    expect(looksLikeAutomatedPeerMessage('Para começar, qual é o seu *nome completo*?')).toBe(true);
    expect(looksLikeAutomatedPeerMessage('boa noite')).toBe(false);
  });

  it('suprime burst após limite de inbound', () => {
    let state = emptyWaAutomatedPeerState();
    for (let i = 0; i < WA_PEER_BURST_MAX_INBOUND - 1; i++) {
      state = recordPeerInbound(state, t0 + i * 1_000);
    }
    expect(evaluateAutomatedPeerSuppression('msg', state, t0 + 4_000).suppress).toBe(false);

    state = recordPeerInbound(state, t0 + 5_000);
    const result = evaluateAutomatedPeerSuppression('msg', state, t0 + 5_000);
    expect(result.suppress).toBe(true);
    expect(result.reason).toBe('burst');
  });

  it('suprime template automatizado com burst moderado', () => {
    let state = emptyWaAutomatedPeerState();
    state = recordPeerInbound(state, t0);
    state = recordPeerInbound(state, t0 + 2_000);

    const result = evaluateAutomatedPeerSuppression(
      'Para começar, qual é o seu nome completo?',
      state,
      t0 + 3_000,
    );
    expect(result.suppress).toBe(true);
    expect(result.reason).toBe('automated_burst');
  });

  it('exporta teto CSAT de lembretes', () => {
    expect(CSAT_MAX_INVALID_REMINDERS).toBe(2);
  });
});
