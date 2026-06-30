import {
  isDiscordDryRunEnabled,
  isDiscordMultiRuleEnabled,
  normalizeDiscordDryRunInput,
  selectDiscordRuleMatches,
  buildDiscordWaDedupSeed,
  DISCORD_MULTI_RULE_MAX,
} from '../discord-dry-run.util';

describe('discord-dry-run.util', () => {
  it('detecta dry-run na organização', () => {
    expect(isDiscordDryRunEnabled(null)).toBe(false);
    expect(isDiscordDryRunEnabled({ discordSettings: { dryRun: false } })).toBe(false);
    expect(isDiscordDryRunEnabled({ discordSettings: { dryRun: true } })).toBe(true);
  });

  it('detecta multi-regra na organização', () => {
    expect(isDiscordMultiRuleEnabled(null)).toBe(false);
    expect(isDiscordMultiRuleEnabled({ discordSettings: { multiRulePerMessage: true } })).toBe(true);
  });

  it('normaliza input booleano', () => {
    expect(normalizeDiscordDryRunInput(true)).toBe(true);
    expect(normalizeDiscordDryRunInput('true')).toBe(true);
    expect(normalizeDiscordDryRunInput(false)).toBe(false);
    expect(normalizeDiscordDryRunInput('false')).toBe(false);
  });

  it('selectDiscordRuleMatches — padrão uma regra por prioridade', () => {
    const matches = [
      { priority: 'low', id: 'a' },
      { priority: 'high', id: 'b' },
      { priority: 'medium', id: 'c' },
    ];
    const out = selectDiscordRuleMatches(matches, { discordSettings: { multiRulePerMessage: false } });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b');
  });

  it(`selectDiscordRuleMatches — multi-regra até ${DISCORD_MULTI_RULE_MAX}`, () => {
    const matches = Array.from({ length: 7 }, (_, i) => ({
      priority: i % 2 === 0 ? 'high' : 'medium',
      id: String(i),
    }));
    const out = selectDiscordRuleMatches(matches, { discordSettings: { multiRulePerMessage: true } });
    expect(out).toHaveLength(DISCORD_MULTI_RULE_MAX);
  });

  it('buildDiscordWaDedupSeed inclui ruleId só em multi-regra', () => {
    const base = {
      clientId: 'c1',
      destinationId: 'd1',
      eventId: 'e1',
      ruleId: 'r1',
    };
    expect(buildDiscordWaDedupSeed({ ...base, multiRule: false })).toBe('c1:d1:e1');
    expect(buildDiscordWaDedupSeed({ ...base, multiRule: true })).toBe('c1:d1:e1:r1');
  });
});
