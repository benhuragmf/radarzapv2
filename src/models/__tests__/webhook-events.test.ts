import mongoose from 'mongoose';
import { WEBHOOK_EVENTS } from '@/models/WebhookEndpoint';

describe('WEBHOOK_EVENTS — ticket e bridge', () => {
  it('inclui eventos de ticket e bridge WA', () => {
    expect(WEBHOOK_EVENTS).toEqual(
      expect.arrayContaining([
        'ticket.created',
        'ticket.client_replied',
        'ticket.closed',
        'webchat.bridge.started',
        'webchat.bridge.closed',
        'discord.voice.join',
        'discord.member.kick',
      ]),
    );
  });
});

describe('ticket webhook payload shape (contrato)', () => {
  it('ticket.created usa snake_case estável', () => {
    const payload = {
      ticket_ref: 'TK-TEST01',
      conversation_id: new mongoose.Types.ObjectId().toString(),
      status: 'open',
      contact_identifier: '5511999999999',
      contact_name: 'Cliente',
      assigned_user_id: null,
      opened_by_user_id: 'user-1',
    };
    expect(payload).toHaveProperty('ticket_ref');
    expect(payload).toHaveProperty('conversation_id');
  });
});
