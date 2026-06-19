import {
  normalizeCommandTicketRef,
  parseWhatsappAgentCommand,
  WHATSAPP_AGENT_COMMAND_HELP,
} from '@/utils/whatsapp-agent-command.util';

describe('whatsapp-agent-command.util', () => {
  it('parses assumir with ticket ref', () => {
    expect(parseWhatsappAgentCommand('!assumir ABC123')).toEqual({
      command: 'assumir',
      arg: 'ABC123',
    });
    expect(parseWhatsappAgentCommand('!ticket TK-88CHYX')).toEqual({
      command: 'ticket',
      arg: 'TK-88CHYX',
    });
  });

  it('parses ajuda without arg', () => {
    expect(parseWhatsappAgentCommand('!ajuda')).toEqual({ command: 'ajuda', arg: undefined });
    expect(parseWhatsappAgentCommand('!help')).toEqual({ command: 'help', arg: undefined });
  });

  it('rejects unknown or incomplete commands', () => {
    expect(parseWhatsappAgentCommand('!assumir')).toBeNull();
    expect(parseWhatsappAgentCommand('!foo bar')).toBeNull();
    expect(parseWhatsappAgentCommand('ola')).toBeNull();
  });

  it('normalizes ticket ref', () => {
    expect(normalizeCommandTicketRef('abc123')).toBe('TK-ABC123');
    expect(normalizeCommandTicketRef('TK-XYZ')).toBe('TK-XYZ');
  });

  it('includes help text for all commands', () => {
    expect(WHATSAPP_AGENT_COMMAND_HELP).toContain('!assumir');
    expect(WHATSAPP_AGENT_COMMAND_HELP).toContain('!encerrar');
  });
});
