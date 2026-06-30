import type { Server as SocketIOServer } from 'socket.io';
import {
  emitWebChatToVisitor,
  setWebChatSocketServer,
} from '@/services/webchat/WebChatRealtime';

describe('WebChatRealtime — isolamento chat interno', () => {
  afterEach(() => {
    setWebChatSocketServer(null as unknown as SocketIOServer);
  });

  it('não emite webchat:message internal para sala do visitante', () => {
    const emit = jest.fn();
    setWebChatSocketServer({ to: () => ({ emit }) } as unknown as SocketIOServer);

    emitWebChatToVisitor('conv1', 'webchat:message', {
      clientId: 'client1',
      conversationId: 'conv1',
      message: {
        id: 'm1',
        direction: 'internal',
        body: 'Me ajude @supervisor',
        createdAt: new Date().toISOString(),
      },
    });

    expect(emit).not.toHaveBeenCalled();
  });

  it('emite webchat:message outbound para sala do visitante', () => {
    const emit = jest.fn();
    setWebChatSocketServer({ to: () => ({ emit }) } as unknown as SocketIOServer);

    emitWebChatToVisitor('conv1', 'webchat:message', {
      clientId: 'client1',
      conversationId: 'conv1',
      message: {
        id: 'm2',
        direction: 'outbound',
        body: 'Como posso ajudar?',
        createdAt: new Date().toISOString(),
      },
    });

    expect(emit).toHaveBeenCalledWith(
      'webchat:message',
      expect.objectContaining({
        message: expect.objectContaining({ direction: 'outbound' }),
      }),
    );
  });
});
