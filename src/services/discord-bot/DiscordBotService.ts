/*
 * RadarZap / RadarGamer
 * Copyright (c) 2026 Benhur Augusto Gomes Monteiro Faria
 * Todos os direitos reservados.
 * Uso, cópia, distribuição ou modificação sem autorização é proibido.
 */

import { 
  Client, 
  GatewayIntentBits, 
  Events, 
  Message, 
  CommandInteraction, 
  SlashCommandBuilder,
  REST,
  Routes,
  ActivityType,
  PresenceUpdateStatus,
  VoiceState,
  GuildMember,
  PartialGuildMember,
  AuditLogEvent,
} from 'discord.js';
import { config } from '@/config/environment';
import { logger, createServiceLogger } from '@/utils/logger';
import { QueueManager } from '@/cache/QueueManager';
import { SessionCache } from '@/cache/SessionCache';
import { RateLimiter } from '@/cache/RateLimiter';
import { RedisManager } from '@/cache/RedisManager';
import { DiscordChannel, User, MessageQueue } from '@/models';
import { MessageExtractor } from './MessageExtractor';
import {
  shouldSkipBotWebhookPreamble,
  shouldSkipNonPrimaryLivePost,
  waitForStreamEmbed,
  collectPrimaryLink,
} from '@/utils/discord-wa-format';
import { contentSourceMessage, isDiscordForwardMessage } from '@/utils/discord-forward';
import { logPipeline } from '@/utils/pipeline-log';
import { buildPipelineTrackingMeta } from '@/utils/pipeline-tracking';
import { CommandHandler } from './CommandHandler';
import { CircuitBreaker } from '../common/CircuitBreaker';
import type { DiscordEventPayload, DiscordRuleTrigger } from '@/types/discord-monitor';
import crypto from 'crypto';
import {
  discordEventCooldownKey,
  getDiscordEventCooldownSec,
} from '@/utils/discord-event-cooldown';
import { DiscordMonitorEventService } from '@/services/discord/DiscordMonitorEventService';
import type { IDiscordChannel } from '@/models/DiscordChannel';

/**
 * Discord Bot Service with autonomous operation
 */
export class DiscordBotService {
  private client: Client;
  private messageExtractor: MessageExtractor;
  private commandHandler: CommandHandler;
  private circuitBreaker: CircuitBreaker;
  private queueManager: QueueManager;
  private sessionCache: SessionCache;
  private rateLimiter: RateLimiter;
  private redisManager: RedisManager;
  private serviceLogger = createServiceLogger('DiscordBotService');
  private isReady = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
      ],
      presence: {
        status: PresenceUpdateStatus.Online,
        activities: [{
          name: 'Discord → WhatsApp Bridge',
          type: ActivityType.Watching
        }]
      }
    });

    this.messageExtractor = new MessageExtractor();
    this.commandHandler = new CommandHandler();
    this.circuitBreaker = new CircuitBreaker('discord-api', {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitorTimeout: 60000
    });
    
    this.queueManager = QueueManager.getInstance();
    this.sessionCache = SessionCache.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
    this.redisManager = RedisManager.getInstance();

    this.setupEventHandlers();
  }

  /**
   * Start the Discord bot service
   */
  async start(): Promise<void> {
    try {
      this.serviceLogger.info('🚀 Starting Discord Bot Service...');

      // Validate configuration
      this.validateConfiguration();

      // Register slash commands
      await this.registerSlashCommands();

      // Login to Discord
      await this.loginWithRetry();

      // Store session information
      await this.storeSession();

      this.serviceLogger.info('✅ Discord Bot Service started successfully');

    } catch (error) {
      this.serviceLogger.error('❌ Failed to start Discord Bot Service:', error);
      throw error;
    }
  }

  /**
   * Stop the Discord bot service
   */
  async stop(): Promise<void> {
    try {
      this.serviceLogger.info('🛑 Stopping Discord Bot Service...');

      if (this.client) {
        await this.client.destroy();
      }

      // Clear session
      await this.sessionCache.deleteSession(`discord:${config.DISCORD.CLIENT_ID}`);

      this.isReady = false;
      this.serviceLogger.info('✅ Discord Bot Service stopped');

    } catch (error) {
      this.serviceLogger.error('Error stopping Discord Bot Service:', error);
    }
  }

  /**
   * Validate Discord configuration
   */
  private validateConfiguration(): void {
    if (!config.DISCORD.TOKEN) {
      throw new Error('Discord bot token is required');
    }

    if (!config.DISCORD.CLIENT_ID) {
      throw new Error('Discord client ID is required');
    }

    if (!config.DISCORD.CLIENT_SECRET) {
      throw new Error('Discord client secret is required');
    }

    this.serviceLogger.info('✅ Discord configuration validated');
  }

  /**
   * Setup Discord event handlers
   */
  private setupEventHandlers(): void {
    this.client.on(Events.ClientReady, async () => {
      this.serviceLogger.info(`🤖 Discord bot logged in as ${this.client.user?.tag}`);
      this.isReady = true;
      this.reconnectAttempts = 0;

      // Update session
      await this.updateSessionStatus('connected');

      // Set up periodic health checks
      this.setupHealthChecks();
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      await this.handleMessage(message);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isCommand()) {
        await this.handleCommand(interaction);
      }
    });

    this.client.on(Events.Error, (error) => {
      this.serviceLogger.error('Discord client error:', error);
      this.circuitBreaker.recordFailure();
    });

    this.client.on(Events.Warn, (warning) => {
      this.serviceLogger.warn('Discord client warning:', warning);
    });

    this.client.on(Events.ShardDisconnect, () => {
      this.serviceLogger.warn('🔌 Discord bot disconnected');
      this.isReady = false;
      this.scheduleReconnect();
    });

    this.client.on(Events.ShardReconnecting, () => {
      this.serviceLogger.info('🔄 Discord bot reconnecting...');
    });

    this.client.on(Events.ShardResume, () => {
      this.serviceLogger.info('▶️ Discord bot resumed');
      this.isReady = true;
    });

    this.client.on(Events.GuildCreate, async (guild) => {
      this.serviceLogger.info(`➕ Bot added to guild: ${guild.name} (${guild.id})`);
      await this.handleGuildJoin(guild);
    });

    this.client.on(Events.GuildDelete, async (guild) => {
      this.serviceLogger.info(`➖ Bot removed from guild: ${guild.name} (${guild.id})`);
      await this.handleGuildLeave(guild);
    });

    this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      await this.handleVoiceStateUpdate(oldState, newState);
    });

    this.client.on(Events.GuildMemberAdd, async (member) => {
      await this.handleMemberJoin(member);
    });

    this.client.on(Events.GuildMemberRemove, async (member) => {
      await this.handleMemberRemove(member);
    });

    this.client.on(Events.GuildBanAdd, async (ban) => {
      await this.handleMemberBan(ban);
    });
  }

  /**
   * Login with retry mechanism
   */
  private async loginWithRetry(): Promise<void> {
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        await this.client.login(config.DISCORD.TOKEN);
        return;
      } catch (error) {
        attempt++;
        this.serviceLogger.error(`Login attempt ${attempt} failed:`, error);
        
        if (attempt >= maxAttempts) {
          throw new Error(`Failed to login after ${maxAttempts} attempts`);
        }
        
        await this.sleep(this.reconnectDelay * attempt);
      }
    }
  }

  /**
   * Register slash commands
   */
  private async registerSlashCommands(): Promise<void> {
    try {
      const commands = [
        new SlashCommandBuilder()
          .setName('setup')
          .setDescription('Setup WhatsApp integration for this channel')
          .addChannelOption(option =>
            option.setName('channel')
              .setDescription('Channel to monitor (defaults to current channel)')
              .setRequired(false)
          ),

        new SlashCommandBuilder()
          .setName('status')
          .setDescription('Check bot status and configuration'),

        new SlashCommandBuilder()
          .setName('connect-whatsapp')
          .setDescription('Connect your WhatsApp account'),

        new SlashCommandBuilder()
          .setName('disconnect-whatsapp')
          .setDescription('Disconnect your WhatsApp account'),

        new SlashCommandBuilder()
          .setName('add-destination')
          .setDescription('Add a WhatsApp destination')
          .addStringOption(option =>
            option.setName('type')
              .setDescription('Destination type')
              .setRequired(true)
              .addChoices(
                { name: 'Group', value: 'group' },
                { name: 'Contact', value: 'contact' }
              )
          )
          .addStringOption(option =>
            option.setName('identifier')
              .setDescription('Phone number or group ID')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('name')
              .setDescription('Display name for this destination')
              .setRequired(true)
          ),

        new SlashCommandBuilder()
          .setName('list-destinations')
          .setDescription('List your WhatsApp destinations'),

        new SlashCommandBuilder()
          .setName('remove-destination')
          .setDescription('Remove a WhatsApp destination')
          .addStringOption(option =>
            option.setName('identifier')
              .setDescription('Phone number or group ID to remove')
              .setRequired(true)
          ),

        new SlashCommandBuilder()
          .setName('test-message')
          .setDescription('Send a test message to WhatsApp')
          .addStringOption(option =>
            option.setName('message')
              .setDescription('Test message content')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('destination')
              .setDescription('Destination identifier (phone number or group ID). Leave empty to send to all.')
              .setRequired(false)
          ),

        new SlashCommandBuilder()
          .setName('filters')
          .setDescription('Manage channel filters')
          .addSubcommand(subcommand =>
            subcommand
              .setName('add-keyword')
              .setDescription('Add a keyword filter')
              .addStringOption(option =>
                option.setName('keyword')
                  .setDescription('Keyword to filter for')
                  .setRequired(true)
              )
          )
          .addSubcommand(subcommand =>
            subcommand
              .setName('remove-keyword')
              .setDescription('Remove a keyword filter')
              .addStringOption(option =>
                option.setName('keyword')
                  .setDescription('Keyword to remove')
                  .setRequired(true)
              )
          )
          .addSubcommand(subcommand =>
            subcommand
              .setName('list')
              .setDescription('List current filters')
          ),

        new SlashCommandBuilder()
          .setName('list-groups')
          .setDescription('List all WhatsApp groups your session is part of'),

        new SlashCommandBuilder()
          .setName('help')
          .setDescription('Show help information'),

        new SlashCommandBuilder()
          .setName('rules')
          .setDescription('Manage channel rules')
          .addSubcommand(sub =>
            sub.setName('create')
              .setDescription('Create a new rule for this channel')
              .addStringOption(opt =>
                opt.setName('name').setDescription('Rule name').setRequired(true)
              )
              .addStringOption(opt =>
                opt.setName('priority').setDescription('Message priority')
                  .addChoices(
                    { name: 'High', value: 'high' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'Low', value: 'low' }
                  )
              )
              .addStringOption(opt =>
                opt.setName('template').setDescription('Template name (default: radarzap-padrao)')
              )
              .addStringOption(opt =>
                opt.setName('keywords').setDescription('Required keywords, comma-separated')
              )
              .addStringOption(opt =>
                opt.setName('destinations').setDescription('Destination identifiers, comma-separated (leave empty = all destinations)')
              )
          )
          .addSubcommand(sub =>
            sub.setName('list').setDescription('List all your rules')
          )
          .addSubcommand(sub =>
            sub.setName('toggle')
              .setDescription('Enable or disable a rule')
              .addStringOption(opt =>
                opt.setName('id').setDescription('Rule ID').setRequired(true)
              )
          )
          .addSubcommand(sub =>
            sub.setName('delete')
              .setDescription('Delete a rule')
              .addStringOption(opt =>
                opt.setName('id').setDescription('Rule ID').setRequired(true)
              )
          ),
      ];

      const rest = new REST({ version: '10' }).setToken(config.DISCORD.TOKEN);

      this.serviceLogger.info('🔄 Registering slash commands...');

      await rest.put(
        Routes.applicationCommands(config.DISCORD.CLIENT_ID),
        { body: commands.map(command => command.toJSON()) }
      );

      this.serviceLogger.info('✅ Slash commands registered successfully');

    } catch (error) {
      this.serviceLogger.error('❌ Failed to register slash commands:', error);
      throw error;
    }
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(message: Message): Promise<void> {
    try {
      // Ignorar mensagens do próprio bot para evitar loops
      if (message.author.id === this.client.user?.id) return;

      // Verificar se canal está monitorado
      const discordChannel = await DiscordChannel.findByChannelId(message.channelId);
      if (!discordChannel || !discordChannel.isActive) return;

      // Atualiza nomes se ainda não foram salvos
      if (!discordChannel.channelName && message.channel) {
        const chName = (message.channel as any).name ?? '';
        const gName  = message.guild?.name ?? '';
        if (chName || gName) {
          await DiscordChannel.findByIdAndUpdate(discordChannel._id, {
            channelName: chName,
            guildName:   gName,
          });
        }
      }

      // Verificar filtros de tipo de mensagem (bot/link/imagem/embed; forwards usam snapshot)
      const contentSrc = contentSourceMessage(message);
      const hasLink =
        /https?:\/\//.test(message.content ?? '') ||
        /https?:\/\//.test(contentSrc.content ?? '') ||
        message.embeds.some(e => e.url) ||
        contentSrc.embeds.some(e => e.url);
      const hasImage =
        message.attachments.some(a => a.contentType?.startsWith('image/')) ||
        contentSrc.attachments.some(a => a.contentType?.startsWith('image/')) ||
        message.embeds.some(e => e.image || e.thumbnail) ||
        contentSrc.embeds.some(e => e.image || e.thumbnail);
      const hasEmbed = message.embeds.length > 0 || contentSrc.embeds.length > 0;

      if (!discordChannel.matchesMessageFilters(message.author.bot, hasLink, hasImage, hasEmbed)) {
        return;
      }

      // Se há lista de bots permitidos, verificar se este bot está na lista
      if (message.author.bot && discordChannel.filters.allowedBotIds.length > 0) {
        if (!discordChannel.filters.allowedBotIds.includes(message.author.id)) return;
      }

      // Se há lista de usuários permitidos, verificar
      if (!message.author.bot && discordChannel.filters.allowedUserIds.length > 0) {
        if (!discordChannel.filters.allowedUserIds.includes(message.author.id)) return;
      }

      // Rate limiting global
      const rateLimitResult = await this.rateLimiter.checkGlobalLimit('message-processing', 100, 60000);
      if (!rateLimitResult.allowed) {
        this.serviceLogger.warn('Message processing rate limit exceeded');
        return;
      }

      const workMessage = await waitForStreamEmbed(message);
      const workSrc = contentSourceMessage(workMessage);
      const workHasEmbed = workMessage.embeds.length > 0 || workSrc.embeds.length > 0;

      if (
        shouldSkipBotWebhookPreamble({
          isBot: workMessage.author.bot,
          hasEmbed: workHasEmbed,
          content: workMessage.content ?? '',
        })
      ) {
        await logPipeline('DiscordBotService', 'skip', 'Webhook preamble ignorado', {
          messageId: workMessage.id,
          channelId: workMessage.channelId,
          reason: 'aguardando embed do bot',
        });
        return;
      }

      const extractedData = this.messageExtractor.extract(workMessage);
      const primaryLink = collectPrimaryLink(extractedData);

      if (shouldSkipNonPrimaryLivePost(extractedData)) {
        await logPipeline('DiscordBotService', 'skip', 'Post intermediário #live-on', {
          messageId: workMessage.id,
          channelId: workMessage.channelId,
          captureKind: extractedData.captureKind,
          reason: 'só card live/vídeo/short',
        });
        return;
      }

      // Filtro de palavras-chave (inclui título/descrição/fields do embed)
      const filterText = extractedData.searchText ?? message.content ?? '';
      if (!discordChannel.matchesFilters(filterText)) return;

      // Adicionar na fila de processamento
      const streamerSlug = primaryLink.match(/twitch\.tv\/([^/?]+)/i)?.[1] ?? '';

      await logPipeline('DiscordBotService', 'capture', 'Mensagem capturada', {
        messageId: workMessage.id,
        channelId: workMessage.channelId,
        clientId: discordChannel.clientId.toString(),
        ...buildPipelineTrackingMeta(extractedData, {
          hasEmbed: workHasEmbed,
          hasLink: Boolean(primaryLink),
          streamer: streamerSlug || extractedData.embedAuthorName,
          embedTitle: extractedData.embedTitles?.[0],
          waitedEmbed: !hasEmbed && workHasEmbed,
          forwarded: isDiscordForwardMessage(workMessage),
        }),
      }, discordChannel.clientId.toString());

      await this.queueManager.addJob(
        'message-processing',
        'process-discord-message',
        {
          messageId: workMessage.id,
          channelId: workMessage.channelId,
          guildId: workMessage.guildId,
          clientId: discordChannel.clientId.toString(),
          extractedData,
          timestamp: new Date(),
        },
        {
          priority: discordChannel.rulePriority === 'high' ? 8 : discordChannel.rulePriority === 'low' ? 2 : 5,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }
      );

      this.serviceLogger.info('Message queued for processing', {
        messageId: workMessage.id,
        channelId: workMessage.channelId,
        isBot: workMessage.author.bot,
        hasEmbed: workHasEmbed,
        hasLink: Boolean(primaryLink),
        captureKind: extractedData.captureKind,
      });

    } catch (error) {
      this.serviceLogger.error('Error handling message:', error);
      this.circuitBreaker.recordFailure();
    }
  }

  /**
   * Handle slash commands
   */
  private async handleCommand(interaction: CommandInteraction): Promise<void> {
    try {
      await this.commandHandler.handleCommand(interaction);
      this.circuitBreaker.recordSuccess();
    } catch (error) {
      this.serviceLogger.error('Error handling command:', error);
      this.circuitBreaker.recordFailure();
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing your command. Please try again later.',
          ephemeral: true
        });
      }
    }
  }

  /**
   * Calculate message priority based on extracted data
   */
  private calculateMessagePriority(extractedData: any): number {
    let priority = 5; // Default priority

    // Higher priority for discounted items
    if (extractedData.discount && extractedData.discount > 50) {
      priority += 3;
    } else if (extractedData.discount && extractedData.discount > 25) {
      priority += 2;
    }

    // Higher priority for free games
    if (extractedData.price === 0 || extractedData.price === '0' || 
        extractedData.title?.toLowerCase().includes('free')) {
      priority += 5;
    }

    // Higher priority for popular stores
    const popularStores = ['steam', 'epic', 'gog'];
    if (extractedData.store && popularStores.includes(extractedData.store.toLowerCase())) {
      priority += 1;
    }

    return Math.min(priority, 10); // Cap at 10
  }

  /**
   * Handle guild join
   */
  private async handleGuildJoin(guild: any): Promise<void> {
    try {
      // Send welcome message to system channel or first available channel
      const systemChannel = guild.systemChannel || guild.channels.cache.find((ch: any) => 
        ch.type === 0 && ch.permissionsFor(guild.members.me).has('SendMessages')
      );

      if (systemChannel) {
        await systemChannel.send({
          embeds: [{
            title: '🤖 Discord-WhatsApp Bot',
            description: 'Thanks for adding me to your server! Use `/setup` to configure WhatsApp integration.',
            color: 0x00ff00,
            fields: [
              {
                name: '🚀 Getting Started',
                value: '1. Use `/setup` in the channel you want to monitor\n2. Use `/connect-whatsapp` to link your WhatsApp\n3. Use `/add-destination` to add WhatsApp groups/contacts',
                inline: false
              },
              {
                name: '📚 Commands',
                value: 'Use `/help` to see all available commands',
                inline: false
              }
            ],
            footer: {
              text: 'Discord-WhatsApp Bot | Autonomous Operation'
            },
            timestamp: new Date().toISOString()
          }]
        });
      }

      this.serviceLogger.info(`Welcome message sent to guild: ${guild.name}`);

    } catch (error) {
      this.serviceLogger.error('Error handling guild join:', error);
    }
  }

  /**
   * Handle guild leave
   */
  private async handleGuildLeave(guild: any): Promise<void> {
    try {
      // Clean up guild-related data
      await DiscordChannel.deleteMany({ guildId: guild.id });
      
      this.serviceLogger.info(`Cleaned up data for guild: ${guild.name} (${guild.id})`);

    } catch (error) {
      this.serviceLogger.error('Error handling guild leave:', error);
    }
  }

  /**
   * Store session information
   */
  private async storeSession(): Promise<void> {
    try {
      const guilds = this.client.guilds.cache.map(guild => guild.id);
      
      await this.sessionCache.setDiscordSession(config.DISCORD.CLIENT_ID, {
        status: 'connected',
        guilds,
        lastActivity: new Date(),
        reconnectAttempts: this.reconnectAttempts
      });

    } catch (error) {
      this.serviceLogger.error('Failed to store session:', error);
    }
  }

  /**
   * Update session status
   */
  private async updateSessionStatus(status: 'connecting' | 'connected' | 'disconnected'): Promise<void> {
    try {
      const existingSession = await this.sessionCache.getDiscordSession(config.DISCORD.CLIENT_ID);
      
      await this.sessionCache.setDiscordSession(config.DISCORD.CLIENT_ID, {
        ...existingSession,
        status,
        lastActivity: new Date(),
        reconnectAttempts: this.reconnectAttempts
      });

    } catch (error) {
      this.serviceLogger.error('Failed to update session status:', error);
    }
  }

  /**
   * Setup periodic health checks
   */
  private setupHealthChecks(): void {
    setInterval(async () => {
      try {
        if (this.isReady) {
          await this.updateSessionStatus('connected');
          this.circuitBreaker.recordSuccess();
        }
      } catch (error) {
        this.serviceLogger.error('Health check failed:', error);
        this.circuitBreaker.recordFailure();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Schedule reconnection
   */
  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.serviceLogger.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    this.serviceLogger.info(`⏳ Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.updateSessionStatus('connecting');
        await this.loginWithRetry();
      } catch (error) {
        this.serviceLogger.error('Reconnection attempt failed:', error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      ready: this.isReady,
      guilds: this.client.guilds.cache.size,
      users: this.client.users.cache.size,
      uptime: this.client.uptime,
      reconnectAttempts: this.reconnectAttempts,
      circuitBreakerState: this.circuitBreaker.getState(),
      lastActivity: new Date()
    };
  }

  /**
   * Get health check status
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const status = this.getStatus();
      const circuitBreakerHealthy = this.circuitBreaker.getState() !== 'open';
      
      return {
        healthy: this.isReady && circuitBreakerHealthy,
        details: {
          ...status,
          circuitBreakerHealthy,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private displayName(member: GuildMember | PartialGuildMember): string {
    return (
      member.displayName?.trim() ||
      member.user.globalName?.trim() ||
      member.user.username
    );
  }

  private async enqueueDiscordEvent(
    monitor: IDiscordChannel,
    payload: Omit<DiscordEventPayload, 'clientId' | 'eventId' | 'monitorId' | 'monitorType'>,
  ): Promise<void> {
    const eventId = crypto.randomUUID();
    const clientId = monitor.clientId.toString();
    const cooldownSec = getDiscordEventCooldownSec(
      payload.trigger,
      monitor.eventCooldownSec,
    );
    const cooldownKey = discordEventCooldownKey(
      payload.trigger,
      payload.guildId,
      payload.channelId,
      payload.userId,
    );

    const allowed = await this.redisManager.setIfNotExists(
      cooldownKey,
      eventId,
      cooldownSec,
    );

    if (!allowed) {
      await DiscordMonitorEventService.getInstance().recordSkippedCooldown(
        monitor,
        payload,
        eventId,
        clientId,
        cooldownSec,
      );
      return;
    }

    const fullPayload: DiscordEventPayload = {
      ...payload,
      eventId,
      clientId,
      monitorId: monitor._id.toString(),
      monitorType: monitor.monitorType ?? 'guild',
    };

    await DiscordMonitorEventService.getInstance().recordCaptured(
      monitor,
      payload,
      eventId,
      clientId,
    );

    await this.queueManager.addJob(
      'message-processing',
      'process-discord-event',
      { event: fullPayload, timestamp: new Date() },
      {
        priority: 6,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    await logPipeline('DiscordBotService', 'capture', `Evento Discord: ${payload.trigger}`, {
      eventId,
      trigger: payload.trigger,
      guildId: payload.guildId,
      channelId: payload.channelId,
      userId: payload.userId,
      cooldownSec,
    }, clientId);
  }

  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    try {
      if (newState.member?.user.bot || oldState.member?.user.bot) return;

      const joined = !oldState.channelId && newState.channelId;
      const left = oldState.channelId && !newState.channelId;
      const moved = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

      if (!joined && !left && !moved) return;

      const guild = newState.guild ?? oldState.guild;
      if (!guild) return;

      if (joined || (moved && newState.channelId)) {
        const channelId = newState.channelId!;
        const monitor = await DiscordChannel.findVoiceMonitor(channelId);
        if (!monitor) return;

        const channel = newState.channel;
        const members = channel?.members?.filter(m => !m.user.bot).size ?? 0;

        await this.enqueueDiscordEvent(monitor, {
          trigger: 'voice_join',
          guildId: guild.id,
          guildName: guild.name,
          channelId,
          channelName: channel?.name ?? monitor.channelName ?? channelId,
          userId: newState.id,
          userName: this.displayName(newState.member!),
          userTag: newState.member?.user.tag ?? newState.id,
          memberCount: members,
          timestamp: new Date().toISOString(),
        });
      }

      if (left || (moved && oldState.channelId)) {
        const channelId = oldState.channelId!;
        const monitor = await DiscordChannel.findVoiceMonitor(channelId);
        if (!monitor) return;

        const channel = oldState.channel;
        const members = channel?.members?.filter(m => !m.user.bot).size ?? 0;

        await this.enqueueDiscordEvent(monitor, {
          trigger: 'voice_leave',
          guildId: guild.id,
          guildName: guild.name,
          channelId,
          channelName: channel?.name ?? monitor.channelName ?? channelId,
          userId: oldState.id,
          userName: this.displayName(oldState.member!),
          userTag: oldState.member?.user.tag ?? oldState.id,
          memberCount: members,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.serviceLogger.error('Error handling voice state update:', error);
    }
  }

  private async handleMemberJoin(member: GuildMember): Promise<void> {
    try {
      if (member.user.bot) return;
      const monitor = await DiscordChannel.findGuildMonitor(member.guild.id);
      if (!monitor) return;

      await this.enqueueDiscordEvent(monitor, {
        trigger: 'member_join',
        guildId: member.guild.id,
        guildName: member.guild.name,
        channelId: member.guild.id,
        channelName: monitor.channelName || 'Eventos do servidor',
        userId: member.id,
        userName: this.displayName(member),
        userTag: member.user.tag,
        memberCount: member.guild.memberCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.serviceLogger.error('Error handling member join:', error);
    }
  }

  private async handleMemberRemove(member: GuildMember | PartialGuildMember): Promise<void> {
    try {
      if (member.user.bot) return;
      const monitor = await DiscordChannel.findGuildMonitor(member.guild.id);
      if (!monitor) return;

      let trigger: DiscordRuleTrigger = 'member_leave';
      let moderatorName: string | undefined;
      let reason: string | undefined;

      try {
        const logs = await member.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberKick });
        const kick = logs.entries.find(
          e => e.target?.id === member.id && Date.now() - e.createdTimestamp < 8000,
        );
        if (kick) {
          trigger = 'member_kick';
          moderatorName = kick.executor?.username;
          reason = kick.reason ?? undefined;
        }
      } catch {
        /* sem permissão de audit log */
      }

      await this.enqueueDiscordEvent(monitor, {
        trigger,
        guildId: member.guild.id,
        guildName: member.guild.name,
        channelId: member.guild.id,
        channelName: monitor.channelName || 'Eventos do servidor',
        userId: member.id,
        userName: this.displayName(member),
        userTag: member.user.tag ?? member.id,
        moderatorName,
        reason,
        memberCount: member.guild.memberCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.serviceLogger.error('Error handling member remove:', error);
    }
  }

  private async handleMemberBan(ban: { guild: GuildMember['guild']; user: { id: string; bot: boolean; tag: string; username: string; globalName?: string | null } }): Promise<void> {
    try {
      if (ban.user.bot) return;
      const monitor = await DiscordChannel.findGuildMonitor(ban.guild.id);
      if (!monitor) return;

      let moderatorName: string | undefined;
      let reason: string | undefined;

      try {
        const logs = await ban.guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.MemberBanAdd });
        const entry = logs.entries.find(
          e => e.target?.id === ban.user.id && Date.now() - e.createdTimestamp < 8000,
        );
        if (entry) {
          moderatorName = entry.executor?.username;
          reason = entry.reason ?? undefined;
        }
      } catch {
        /* sem audit */
      }

      await this.enqueueDiscordEvent(monitor, {
        trigger: 'member_ban',
        guildId: ban.guild.id,
        guildName: ban.guild.name,
        channelId: ban.guild.id,
        channelName: monitor.channelName || 'Eventos do servidor',
        userId: ban.user.id,
        userName: ban.user.globalName?.trim() || ban.user.username,
        userTag: ban.user.tag,
        moderatorName,
        reason,
        memberCount: ban.guild.memberCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.serviceLogger.error('Error handling member ban:', error);
    }
  }
}