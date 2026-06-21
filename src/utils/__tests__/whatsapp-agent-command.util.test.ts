import {
  normalizeCommandTicketRef,
  parseCommandTicketArg,
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
    expect(parseWhatsappAgentCommand('!token O6CAYO')).toEqual({
      command: 'token',
      arg: 'O6CAYO',
    });
    expect(parseWhatsappAgentCommand('!abrir O6CAYO')).toEqual({
      command: 'abrir',
      arg: 'O6CAYO',
    });
    expect(parseWhatsappAgentCommand('!abrirchamado TK-ABC')).toEqual({
      command: 'abrirchamado',
      arg: 'TK-ABC',
    });
  });

  it('parses list commands without arg', () => {
    expect(parseWhatsappAgentCommand('!abertos')).toEqual({ command: 'abertos', arg: undefined });
    expect(parseWhatsappAgentCommand('!chamados')).toEqual({ command: 'chamados', arg: undefined });
    expect(parseWhatsappAgentCommand('!meus')).toEqual({ command: 'meus', arg: undefined });
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

  it('splits ticket ref and free text message', () => {
    expect(parseCommandTicketArg('O6CAYO')).toEqual({ ticketRef: 'TK-O6CAYO' });
    expect(parseCommandTicketArg('TK-ABC Cliente precisa @suporte2, @financeiro')).toEqual({
      ticketRef: 'TK-ABC',
      message: 'Cliente precisa @suporte2, @financeiro',
    });
    expect(parseCommandTicketArg('TK-XYZ  texto  com  espaços')).toEqual({
      ticketRef: 'TK-XYZ',
      message: 'texto  com  espaços',
    });
  });

  it('parses encerrarchat aliases', () => {
    expect(parseWhatsappAgentCommand('!encerrarchat L4O2V2')).toEqual({
      command: 'encerrarchat',
      arg: 'L4O2V2',
    });
    expect(parseWhatsappAgentCommand('!sairchat TK-ABC')).toEqual({
      command: 'sairchat',
      arg: 'TK-ABC',
    });
  });

  it('includes help text for all commands', () => {
    expect(WHATSAPP_AGENT_COMMAND_HELP).toContain('!assumir');
    expect(WHATSAPP_AGENT_COMMAND_HELP).toContain('!abrir');
    expect(WHATSAPP_AGENT_COMMAND_HELP).toContain('!abertos');
    expect(WHATSAPP_AGENT_COMMAND_HELP).toContain('!meus');
    expect(WHATSAPP_AGENT_COMMAND_HELP).toContain('!nota');
    expect(WHATSAPP_AGENT_COMMAND_HELP).toContain('!encerrarchat');
    expect(WHATSAPP_AGENT_COMMAND_HELP).toContain('!encerrar');
  });
});
