import mongoose from 'mongoose';
import { WebChatMessage } from '@/models/WebChatMessage';
import { AiProviderService, type AiChatMessage } from '@/services/ai/AiProviderService';
import { AiSettingsService } from '@/services/ai/AiSettingsService';
import { AiPromptBuilderService } from '@/services/ai/AiPromptBuilderService';
import { PlatformAiBlueprintService } from '@/services/ai/PlatformAiBlueprintService';
import type { AiContactContext } from '@/services/ai/AiContextService';

const WEBCHAT_CHANNEL_HINT =
  '\n\nCanal atual: chat do site (visitante no website). Respostas curtas, claras e em português. ' +
  'Não solicite dados que o visitante já informou no pré-chat.';

export class WebChatAiService {
  private static instance: WebChatAiService;

  static getInstance(): WebChatAiService {
    if (!WebChatAiService.instance) {
      WebChatAiService.instance = new WebChatAiService();
    }
    return WebChatAiService.instance;
  }

  async getAvailability(clientId: string): Promise<{ available: boolean; reason?: string }> {
    const settings = await AiSettingsService.getInstance().getSettingsDoc(clientId);
    if (settings.mode === 'disabled' || !settings.enabled) {
      return { available: false, reason: 'IA desativada — configure em Inbox → IA Atendimento' };
    }
    try {
      await AiProviderService.getInstance().resolveApiKey(clientId, settings);
      return { available: true };
    } catch (e) {
      return { available: false, reason: (e as Error).message };
    }
  }

  async generateVisitorReply(
    clientId: string,
    conversationId: string,
    opts: { visitorName?: string; visitorEmail?: string },
  ): Promise<{ body: string; senderName: string; shouldEscalate?: boolean } | null> {
    const availability = await this.getAvailability(clientId);
    if (!availability.available) return null;

    const settings = await AiSettingsService.getInstance().getSettingsDoc(clientId);
    const convOid = new mongoose.Types.ObjectId(conversationId);

    const rows = await WebChatMessage.find({ conversationId: convOid })
      .sort({ createdAt: 1 })
      .limit(24)
      .lean();

    const contactContext: AiContactContext | undefined =
      opts.visitorName || opts.visitorEmail
        ? {
            name: opts.visitorName,
            email: opts.visitorEmail,
            tags: [],
            recentTickets: [],
            knownFields: {
              name: Boolean(opts.visitorName?.trim()),
              email: Boolean(opts.visitorEmail?.trim()),
            },
          }
        : undefined;

    const lastInbound = [...rows].reverse().find(m => m.direction === 'inbound')?.body ?? '';

    const systemPrompt =
      (await AiPromptBuilderService.getInstance().buildSystemPrompt(clientId, {
        contactContext,
        clientText: lastInbound,
      })) + WEBCHAT_CHANNEL_HINT;

    const history: AiChatMessage[] = [{ role: 'system', content: systemPrompt }];

    for (const m of rows) {
      if (m.direction === 'system') continue;
      if (m.direction === 'inbound') {
        history.push({ role: 'user', content: m.body });
      } else if (m.direction === 'outbound') {
        history.push({ role: 'assistant', content: m.body });
      }
    }

    try {
      const provider = AiProviderService.getInstance();
      const result = await provider.complete(
        clientId,
        settings,
        history,
        `webchat:${conversationId}`,
      );
      const reply = result.structured.reply?.trim();
      if (!reply || provider.isUnusableClientReply(result.structured)) return null;

      const blueprint = await PlatformAiBlueprintService.getInstance().getGlobal();
      return {
        body: reply,
        senderName: blueprint.agentName?.trim() || 'Assistente IA',
        shouldEscalate: Boolean(result.structured.shouldEscalate),
      };
    } catch {
      return null;
    }
  }
}
