import {
  buildDynamicWhatsappAgentHelp,
  isSystemCommandAvailable,
  listWhatsappBridgeCommandsForAgent,
  parseCustomWhatsappCommand,
  renderCommandTemplate,
  validateCustomCommandName,
} from '@/services/inbox/whatsapp-bridge-commands.service';
import { DEFAULT_WHATSAPP_BRIDGE_COMMANDS_CONFIG } from '@/types/whatsapp-bridge-commands';

describe('whatsapp-bridge-commands.service', () => {
  it('lists all system commands by default', () => {
    const items = listWhatsappBridgeCommandsForAgent(DEFAULT_WHATSAPP_BRIDGE_COMMANDS_CONFIG);
    expect(items.some(i => i.command === 'assumir')).toBe(true);
    expect(items.some(i => i.command === 'ajuda')).toBe(true);
  });

  it('respects paused system command', () => {
    const config = {
      ...DEFAULT_WHATSAPP_BRIDGE_COMMANDS_CONFIG,
      systemOverrides: [{ commandId: 'assumir' as const, enabled: true, paused: true }],
    };
    expect(isSystemCommandAvailable(config, 'assumir')).toBe(false);
    const helpLines = buildDynamicWhatsappAgentHelp(config).split('\n');
    expect(helpLines.some(line => line.startsWith('!assumir —'))).toBe(false);
  });

  it('parses custom command with ticket ref', () => {
    const custom = [
      {
        id: '1',
        command: '2via',
        label: '2ª via',
        description: 'Boleto',
        syntax: '!2via TK-…',
        enabled: true,
        paused: false,
        requiresTicketRef: true,
        responseTemplate: '{{ticketRef}}',
        sendToVisitor: false,
        actionPreset: 'invoice_2via' as const,
      },
    ];
    expect(parseCustomWhatsappCommand('!2via ABC123', custom)?.arg).toBe('ABC123');
    expect(parseCustomWhatsappCommand('!2via', custom)).toBeNull();
  });

  it('renders template placeholders', () => {
    const out = renderCommandTemplate('TK {{ticketRef}} — {{clientName}} — {{paymentLink}}', {
      ticketRef: 'TK-ABC',
      clientName: 'Maria',
      paymentLink: 'https://pay.example/boleto',
    });
    expect(out).toContain('TK-ABC');
    expect(out).toContain('Maria');
    expect(out).toContain('https://pay.example/boleto');
  });

  it('rejects reserved command names', () => {
    expect(validateCustomCommandName('assumir')).toMatch(/sistema/);
    expect(validateCustomCommandName('2via')).toBeNull();
  });
});
