import { CommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import { logger, createServiceLogger } from '@/utils/logger';
import { User, DiscordChannel, Destination, WhatsAppSession } from '@/models';
import { syncGuildMemberships } from '@/auth/rbac/GuildMembershipSync';
import { Rule } from '@/models/Rule';
import { SessionCache } from '@/cache/SessionCache';
import { QueueManager } from '@/cache/QueueManager';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import mongoose from 'mongoose';

/**
 * Command handler for Discord slash commands
 */
export class CommandHandler {
    private serviceLogger = createServiceLogger('CommandHandler');
    private sessionCache: SessionCache;
    private queueManager: QueueManager;

    constructor() {
        this.sessionCache = SessionCache.getInstance();
        this.queueManager = QueueManager.getInstance();
    }

    /** organizationId usado em WhatsApp, regras e destinos */
    private async tenantClientId(user: { _id: unknown }): Promise<string> {
        const { OrganizationService } = await import('@/services/organization/OrganizationService');
        return OrganizationService.getInstance().resolveClientId(String(user._id));
    }

    /**
     * Handle slash command interactions
     */
    async handleCommand(interaction: CommandInteraction): Promise<void> {
        try {
            this.serviceLogger.info(`Command received: ${interaction.commandName}`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                channelId: interaction.channelId
            });

            // Defer reply immediately — must happen within 3 s of the interaction
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL
                } catch (deferError) {
                    // Interaction already expired or was already acknowledged — log and bail out
                    this.serviceLogger.warn(`deferReply failed for ${interaction.commandName}: ${(deferError as Error).message}`);
                    return;
                }
            }

            switch (interaction.commandName) {
                case 'setup':
                    await this.handleSetup(interaction);
                    break;
                case 'status':
                    await this.handleStatus(interaction);
                    break;
                case 'connect-whatsapp':
                    await this.handleConnectWhatsApp(interaction);
                    break;
                case 'disconnect-whatsapp':
                    await this.handleDisconnectWhatsApp(interaction);
                    break;
                case 'add-destination':
                    await this.handleAddDestination(interaction);
                    break;
                case 'list-destinations':
                    await this.handleListDestinations(interaction);
                    break;
                case 'remove-destination':
                    await this.handleRemoveDestination(interaction);
                    break;
                case 'test-message':
                    await this.handleTestMessage(interaction);
                    break;
                case 'filters':
                    await this.handleFilters(interaction);
                    break;
                case 'rules':
                    await this.handleRules(interaction);
                    break;
                case 'list-groups':
                    await this.handleListGroups(interaction);
                    break;
                case 'help':
                    await this.handleHelp(interaction);
                    break;
                default:
                    await this.editReply(interaction, '❌ Unknown command.');
            }

        } catch (error) {
            this.serviceLogger.error(`Error handling command ${interaction.commandName}: ${(error as Error).message}`, { stack: (error as Error).stack });

            const errorMessage = '❌ An error occurred while processing your command. Please try again later.';

            if (interaction.deferred || interaction.replied) {
                await this.safeErrorReply(interaction, errorMessage);
            }
        }
    }

    /**
     * Handle setup command
     */
    private async handleSetup(interaction: CommandInteraction): Promise<void> {
        if (!interaction.guildId) {
            await this.editReply(interaction, '❌ This command can only be used in a server.');
            return;
        }

        // Check permissions
        if (!interaction.memberPermissions?.has('ManageChannels')) {
            await this.editReply(interaction, '❌ You need "Manage Channels" permission to use this command.');
            return;
        }

        try {
            const channelOption = (interaction as any).options?.get('channel');
            const targetChannelId = channelOption?.channel?.id || interaction.channelId;

            // Get or create user + organization
            const user = await this.getOrCreateUser(interaction.user.id);
            const orgSvc = (await import('@/services/organization/OrganizationService')).OrganizationService.getInstance();
            const clientId = await orgSvc.resolveClientId((user._id as mongoose.Types.ObjectId).toString());
            await orgSvc.linkGuildToOrganization(clientId, interaction.guildId);

            const existingChannel = await DiscordChannel.findOne({
                guildId: interaction.guildId,
                channelId: targetChannelId
            });

            if (existingChannel) {
                await this.editReply(interaction, `❌ Channel <#${targetChannelId}> is already configured for monitoring.`);
                return;
            }

            // Create new Discord channel configuration
            await DiscordChannel.createChannel(
                interaction.guildId,
                targetChannelId,
                new mongoose.Types.ObjectId(clientId),
            );

            // Sincroniza papel Discord (owner/admin) no RadarZap
            syncGuildMemberships(
                (user._id as mongoose.Types.ObjectId).toString(),
                interaction.user.id,
            ).catch(err => this.serviceLogger.warn('Guild sync after setup failed', err));

            const embed = new EmbedBuilder()
                .setTitle('✅ Channel Setup Complete')
                .setDescription(`Channel <#${targetChannelId}> is now configured for Discord → WhatsApp integration.`)
                .addFields([
                    {
                        name: '📋 Next Steps',
                        value: '1. Use `/connect-whatsapp` to link your WhatsApp account\n2. Use `/add-destination` to add WhatsApp groups/contacts\n3. Messages in this channel will be automatically forwarded',
                        inline: false
                    },
                    {
                        name: '⚙️ Configuration',
                        value: 'Use `/filters` to set up keyword filters and price ranges',
                        inline: false
                    }
                ])
                .setColor(0x00ff00)
                .setTimestamp();

            await this.editReply(interaction, { embeds: [embed] });

        } catch (error) {
            this.serviceLogger.error('Error in setup command:', error);
            await this.safeErrorReply(interaction, '❌ Failed to setup channel. Please try again.');
        }
    }

    /**
     * Handle status command
     */
    private async handleStatus(interaction: CommandInteraction): Promise<void> {
        try {
            const user = await User.findByDiscordId(interaction.user.id);

            if (!user) {
                await this.editReply(interaction, '❌ You are not registered. Use `/setup` first.');
                return;
            }

            const clientId = await this.tenantClientId(user);
            const wa = WhatsAppService.getInstance();
            const waConnected = wa.isClientConnected(clientId);

            // Get configured channels
            const channels = await DiscordChannel.findByClientId(new mongoose.Types.ObjectId(clientId));

            // Get destinations
            const destinations = await Destination.findByClientId(new mongoose.Types.ObjectId(clientId));

            const embed = new EmbedBuilder()
                .setTitle('📊 Bot Status')
                .addFields([
                    {
                        name: '👤 User Info',
                        value: `Plan: **${user.plan.toUpperCase()}**\nMessages Used: **${user.usage.messagesUsed}/${user.limits.messagesPerDay === -1 ? '∞' : user.limits.messagesPerDay}**`,
                        inline: true
                    },
                    {
                        name: '📱 WhatsApp Status',
                        value: waConnected ? '**CONNECTED**' : '**DISCONNECTED**',
                        inline: true
                    },
                    {
                        name: '📺 Monitored Channels',
                        value: channels.length > 0 ? channels.map(ch => `<#${ch.channelId}>`).join('\n') : 'None configured',
                        inline: false
                    },
                    {
                        name: '📞 WhatsApp Destinations',
                        value: destinations.length > 0 ? `${destinations.length} configured` : 'None configured',
                        inline: true
                    },
                    {
                        name: '📈 Usage Stats',
                        value: `Usage: ${user.getUsagePercentage()}%\nLast Reset: ${user.usage.lastReset.toLocaleDateString()}`,
                        inline: true
                    }
                ])
                .setColor(waConnected ? 0x00ff00 : 0xff9900)
                .setTimestamp();

            await this.editReply(interaction, { embeds: [embed] });

        } catch (error) {
            this.serviceLogger.error('Error in status command:', error);
            await this.safeErrorReply(interaction, '❌ Failed to get status. Please try again.');
        }
    }

    /**
     * Handle connect WhatsApp command
     */
    private async handleConnectWhatsApp(interaction: CommandInteraction): Promise<void> {
        try {
            const user = await this.getOrCreateUser(interaction.user.id);

            // Check if already connected
            const clientId = await this.tenantClientId(user);
            const wa = WhatsAppService.getInstance();
            if (wa.isClientConnected(clientId)) {
                await this.editReply(interaction, '✅ WhatsApp is already connected!');
                return;
            }

            // Reply first to avoid interaction timeout
            const embed = new EmbedBuilder()
                .setTitle('📱 Connecting to WhatsApp')
                .setDescription('Your WhatsApp connection request has been queued. You will receive a QR code shortly.')
                .addFields([
                    {
                        name: '📋 Instructions',
                        value: '1. Wait for the QR code to appear\n2. Open WhatsApp on your phone\n3. Go to Settings > Linked Devices\n4. Scan the QR code\n5. Your account will be connected!',
                        inline: false
                    },
                    {
                        name: '⏱️ Timeout',
                        value: 'QR codes expire after 2 minutes. If it expires, run this command again.',
                        inline: false
                    }
                ])
                .setColor(0x25d366)
                .setTimestamp();

            await this.editReply(interaction, { embeds: [embed] });

            // Then enqueue
            await this.queueManager.addJob(
                'whatsapp-connection',
                'connect-whatsapp',
                {
                    clientId,
                    discordUserId: interaction.user.id,
                    channelId: interaction.channelId
                },
                {
                    priority: 8,
                    attempts: 3
                }
            );

        } catch (error) {
            this.serviceLogger.error('Error in connect-whatsapp command:', error);
            await this.safeErrorReply(interaction, '❌ Failed to initiate WhatsApp connection. Please try again.');
        }
    }

    /**
     * Get or create user
     */
    private async getOrCreateUser(discordUserId: string): Promise<any> {
        let user = await User.findByDiscordId(discordUserId);

        if (!user) {
            user = await User.createUser(discordUserId);
        }

        return user;
    }

    /**
     * Safe edit reply helper — throws so callers can handle failures
     */
    private async editReply(interaction: CommandInteraction, content: any): Promise<void> {
        try {
            if (typeof content === 'string') {
                await interaction.editReply({ content });
            } else {
                await interaction.editReply(content);
            }
        } catch (error) {
            this.serviceLogger.error('Failed to edit reply (interaction may have expired):', error);
            // Re-throw so the calling handler's catch block can log context
            throw error;
        }
    }

    /**
     * Best-effort edit reply for error handlers — never throws.
     * Use this inside catch blocks where the interaction may already be expired.
     */
    private async safeErrorReply(interaction: CommandInteraction, message: string): Promise<void> {
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: message });
            }
        } catch {
            // Interaction already expired — nothing we can do
        }
    }

    /**
     * Handle disconnect WhatsApp command
     */
    private async handleDisconnectWhatsApp(interaction: CommandInteraction): Promise<void> {
        try {
            const user = await User.findByDiscordId(interaction.user.id);

            if (!user) {
                await this.editReply(interaction, '❌ You are not registered. Use `/setup` first.');
                return;
            }

            // Reply first to avoid interaction timeout
            await this.editReply(interaction, '✅ WhatsApp disconnection initiated. Your session will be terminated shortly.');

            // Then enqueue
            await this.queueManager.addJob(
                'whatsapp-connection',
                'disconnect-whatsapp',
                {
                    clientId: await this.tenantClientId(user),
                    discordUserId: interaction.user.id
                },
                {
                    priority: 7,
                    attempts: 2
                }
            );

        } catch (error) {
            this.serviceLogger.error('Error in disconnect-whatsapp command:', error);
            await this.safeErrorReply(interaction, '❌ Failed to disconnect WhatsApp. Please try again.');
        }
    }

    /**
     * Handle add destination command
     */
    private async handleAddDestination(interaction: CommandInteraction): Promise<void> {
        try {
            const user = await this.getOrCreateUser(interaction.user.id);

            const type = (interaction as any).options?.get('type')?.value as 'group' | 'contact';
            const identifier = (interaction as any).options?.get('identifier')?.value as string;
            const name = (interaction as any).options?.get('name')?.value as string;

            if (!type || !identifier || !name) {
                await this.editReply(interaction, '❌ Please provide all required parameters.');
                return;
            }

            const clientId = await this.tenantClientId(user);
            const clientOid = new mongoose.Types.ObjectId(clientId);

            // Check user limits
            const existingDestinations = await Destination.findByClientId(clientOid);
            if (existingDestinations.length >= user.limits.groupsMax && user.limits.groupsMax !== -1) {
                await this.editReply(interaction, `❌ You have reached your destination limit (${user.limits.groupsMax}). Upgrade your plan for more destinations.`);
                return;
            }

            // Create destination
            await Destination.createDestination(
                clientOid,
                type,
                identifier,
                name,
                'discord-command',
                '127.0.0.1' // Discord commands have no client IP
            );

            const embed = new EmbedBuilder()
                .setTitle('✅ Destination Added')
                .setDescription(`${type === 'group' ? '👥 Group' : '👤 Contact'} **${name}** has been added to your destinations.`)
                .addFields([
                    {
                        name: '📋 Details',
                        value: `Type: ${type}\nIdentifier: ${identifier}\nName: ${name}`,
                        inline: false
                    },
                    {
                        name: '📊 Usage',
                        value: `Destinations: ${existingDestinations.length + 1}/${user.limits.groupsMax === -1 ? '∞' : user.limits.groupsMax}`,
                        inline: false
                    }
                ])
                .setColor(0x00ff00)
                .setTimestamp();

            await this.editReply(interaction, { embeds: [embed] });

        } catch (error) {
            this.serviceLogger.error(`Error in add-destination command: ${(error as Error).message}`, { stack: (error as Error).stack });

            if ((error as Error).message?.includes('already exists')) {
                await this.safeErrorReply(interaction, '❌ This destination already exists in your list.');
            } else {
                await this.safeErrorReply(interaction, `❌ Failed to add destination: ${(error as Error).message}`);
            }
        }
    }

    /**
     * Handle list destinations command
     */
    private async handleListDestinations(interaction: CommandInteraction): Promise<void> {
        try {
            const user = await User.findByDiscordId(interaction.user.id);

            if (!user) {
                await this.editReply(interaction, '❌ You are not registered. Use `/setup` first.');
                return;
            }

            const clientId = await this.tenantClientId(user);
            const destinations = await Destination.findByClientId(new mongoose.Types.ObjectId(clientId));

            if (destinations.length === 0) {
                await this.editReply(interaction, '📭 You have no WhatsApp destinations configured. Use `/add-destination` to add some.');
                return;
            }

            const groups = destinations.filter(d => d.type === 'group');
            const contacts = destinations.filter(d => d.type === 'contact');

            const embed = new EmbedBuilder()
                .setTitle('📞 Your WhatsApp Destinations')
                .setDescription(`Total: ${destinations.length} destinations`)
                .setColor(0x25d366)
                .setTimestamp();

            if (groups.length > 0) {
                embed.addFields([{
                    name: '👥 Groups',
                    value: groups.map(g => `• **${g.name}** (${g.identifier})`).join('\n'),
                    inline: false
                }]);
            }

            if (contacts.length > 0) {
                embed.addFields([{
                    name: '👤 Contacts',
                    value: contacts.map(c => `• **${c.name}** (${c.identifier})`).join('\n'),
                    inline: false
                }]);
            }

            embed.addFields([{
                name: '📊 Usage',
                value: `Used: ${destinations.length}/${user.limits.groupsMax === -1 ? '∞' : user.limits.groupsMax}`,
                inline: true
            }]);

            await this.editReply(interaction, { embeds: [embed] });

        } catch (error) {
            this.serviceLogger.error('Error in list-destinations command:', error);
            await this.safeErrorReply(interaction, '❌ Failed to list destinations. Please try again.');
        }
    }

    /**
     * Handle remove destination command
     */
    private async handleRemoveDestination(interaction: CommandInteraction): Promise<void> {
        try {
            const user = await User.findByDiscordId(interaction.user.id);

            if (!user) {
                await this.editReply(interaction, '❌ You are not registered. Use `/setup` first.');
                return;
            }

            const identifier = (interaction as any).options?.get('identifier')?.value as string;

            if (!identifier) {
                await this.editReply(interaction, '❌ Please provide the identifier to remove.');
                return;
            }

            const clientId = await this.tenantClientId(user);
            const destination = await Destination.findOne({
                clientId: new mongoose.Types.ObjectId(clientId),
                identifier
            });

            if (!destination) {
                await this.editReply(interaction, '❌ Destination not found.');
                return;
            }

            await destination.deleteOne();

            await this.editReply(interaction, `✅ Destination **${destination.name}** has been removed.`);

        } catch (error) {
            this.serviceLogger.error('Error in remove-destination command:', error);
            await this.safeErrorReply(interaction, '❌ Failed to remove destination. Please try again.');
        }
    }

    /**
     * Handle test message command
     */
    private async handleTestMessage(interaction: CommandInteraction): Promise<void> {
        try {
            const user = await this.getOrCreateUser(interaction.user.id);
            const message = (interaction as any).options?.get('message')?.value as string;
            const destination = (interaction as any).options?.get('destination')?.value as string | undefined;

            if (!message) {
                await this.editReply(interaction, '❌ Please provide a test message.');
                return;
            }

            // Check if user can send messages
            if (!user.canSendMessage()) {
                await this.editReply(interaction, `❌ You have reached your daily message limit (${user.limits.messagesPerDay}). Upgrade your plan or wait for the daily reset.`);
                return;
            }

            const destInfo = destination ? `para \`${destination}\`` : 'para todos os destinos';

            // Reply first to avoid interaction timeout
            await this.editReply(interaction, `✅ Test message queued for sending ${destInfo}. Check your WhatsApp!`);

            // Then enqueue
            const clientId = await this.tenantClientId(user);
            await this.queueManager.addJob(
                'whatsapp-sending',
                'send-test-message',
                {
                    clientId,
                    message,
                    destination: destination || null, // null = send to all destinations
                    discordUserId: interaction.user.id,
                    channelId: interaction.channelId
                },
                {
                    priority: 6,
                    attempts: 3
                }
            );

        } catch (error) {
            this.serviceLogger.error('Error in test-message command:', error);
            await this.safeErrorReply(interaction, '❌ Failed to send test message. Please try again.');
        }
    }

    /**
     * Handle filters command
     */
    private async handleFilters(interaction: CommandInteraction): Promise<void> {
        try {
            const subcommand = (interaction as any).options?.getSubcommand();

            switch (subcommand) {
                case 'add-keyword':
                    await this.handleAddKeyword(interaction);
                    break;
                case 'remove-keyword':
                    await this.handleRemoveKeyword(interaction);
                    break;
                case 'list':
                    await this.handleListFilters(interaction);
                    break;
                default:
                    await this.editReply(interaction, '❌ Unknown filter subcommand.');
            }

        } catch (error) {
            this.serviceLogger.error('Error in filters command:', error);
            await this.safeErrorReply(interaction, '❌ Failed to process filter command. Please try again.');
        }
    }

    /**
     * Handle add keyword filter
     */
    private async handleAddKeyword(interaction: CommandInteraction): Promise<void> {
        if (!interaction.guildId) {
            await this.editReply(interaction, '❌ This command can only be used in a server.');
            return;
        }

        const keyword = (interaction as any).options?.get('keyword')?.value as string;

        if (!keyword) {
            await this.editReply(interaction, '❌ Please provide a keyword.');
            return;
        }

        const channel = await DiscordChannel.findOne({
            guildId: interaction.guildId,
            channelId: interaction.channelId
        });

        if (!channel) {
            await this.editReply(interaction, '❌ This channel is not configured for monitoring. Use `/setup` first.');
            return;
        }

        await channel.addKeyword(keyword);
        await this.editReply(interaction, `✅ Keyword **${keyword}** added to channel filters.`);
    }

    /**
     * Handle remove keyword filter
     */
    private async handleRemoveKeyword(interaction: CommandInteraction): Promise<void> {
        if (!interaction.guildId) {
            await this.editReply(interaction, '❌ This command can only be used in a server.');
            return;
        }

        const keyword = (interaction as any).options?.get('keyword')?.value as string;

        if (!keyword) {
            await this.editReply(interaction, '❌ Please provide a keyword.');
            return;
        }

        const channel = await DiscordChannel.findOne({
            guildId: interaction.guildId,
            channelId: interaction.channelId
        });

        if (!channel) {
            await this.editReply(interaction, '❌ This channel is not configured for monitoring. Use `/setup` first.');
            return;
        }

        await channel.removeKeyword(keyword);
        await this.editReply(interaction, `✅ Keyword **${keyword}** removed from channel filters.`);
    }

    /**
     * Handle list filters
     */
    private async handleListFilters(interaction: CommandInteraction): Promise<void> {
        if (!interaction.guildId) {
            await this.editReply(interaction, '❌ This command can only be used in a server.');
            return;
        }

        const channel = await DiscordChannel.findOne({
            guildId: interaction.guildId,
            channelId: interaction.channelId
        });

        if (!channel) {
            await this.editReply(interaction, '❌ This channel is not configured for monitoring. Use `/setup` first.');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🔍 Channel Filters')
            .setDescription(`Filters for <#${interaction.channelId}>`)
            .addFields([
                {
                    name: '✅ Include Keywords',
                    value: channel.filters.keywords.length > 0 ? channel.filters.keywords.map(k => `• ${k}`).join('\n') : 'None',
                    inline: true
                },
                {
                    name: '❌ Exclude Keywords',
                    value: channel.filters.excludeKeywords.length > 0 ? channel.filters.excludeKeywords.map(k => `• ${k}`).join('\n') : 'None',
                    inline: true
                },
                {
                    name: '💰 Price Range',
                    value: `Min: ${channel.filters.minPrice || 'None'}\nMax: ${channel.filters.maxPrice || 'None'}`,
                    inline: true
                }
            ])
            .setColor(0x0099ff)
            .setTimestamp();

        await this.editReply(interaction, { embeds: [embed] });
    }

    private async handleHelp(interaction: CommandInteraction): Promise<void> {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Discord-WhatsApp Bot Help')
            .setDescription('Connect your Discord server to WhatsApp for automatic message forwarding.')
            .addFields([
                {
                    name: '🚀 Setup Commands',
                    value: '`/setup` - Configure a channel for monitoring\n`/connect-whatsapp` - Link your WhatsApp account\n`/add-destination` - Add WhatsApp groups/contacts',
                    inline: false
                },
                {
                    name: '📊 Management Commands',
                    value: '`/status` - Check bot status and usage\n`/list-destinations` - View your destinations\n`/remove-destination` - Remove a destination',
                    inline: false
                },
                {
                    name: '🔍 Filter Commands',
                    value: '`/filters add-keyword` - Add keyword filter\n`/filters remove-keyword` - Remove keyword filter\n`/filters list` - List current filters',
                    inline: false
                },
                {
                    name: '📋 Rules Commands',
                    value: '`/rules create` - Create a new rule\n`/rules list` - List rules\n`/rules toggle` - Enable/disable a rule\n`/rules delete` - Delete a rule',
                    inline: false
                },
                {
                    name: '📱 WhatsApp',
                    value: '`/connect-whatsapp` - Connect WhatsApp\n`/disconnect-whatsapp` - Disconnect\n`/list-groups` - List WhatsApp groups (with IDs)',
                    inline: false
                },
                {
                    name: '🧪 Testing',
                    value: '`/test-message` - Send a test message to WhatsApp',
                    inline: false
                }
            ])
            .setColor(0x25d366)
            .setFooter({ text: 'Discord-WhatsApp Bot | Autonomous Operation' })
            .setTimestamp();

        await this.editReply(interaction, { embeds: [embed] });
    }

    /**
     * Handle rules command
     */
    private async handleRules(interaction: CommandInteraction): Promise<void> {
        try {
            const subcommand = (interaction as any).options?.getSubcommand();

            switch (subcommand) {
                case 'create':
                    await this.handleRuleCreate(interaction);
                    break;
                case 'list':
                    await this.handleRuleList(interaction);
                    break;
                case 'toggle':
                    await this.handleRuleToggle(interaction);
                    break;
                case 'delete':
                    await this.handleRuleDelete(interaction);
                    break;
                default:
                    await this.editReply(interaction, '❌ Unknown rules subcommand.');
            }
        } catch (error) {
            this.serviceLogger.error('Error in rules command:', error);
            await this.safeErrorReply(interaction, '❌ Failed to process rules command. Please try again.');
        }
    }

    private async handleRuleCreate(interaction: CommandInteraction): Promise<void> {
        if (!interaction.guildId) {
            await this.editReply(interaction, '❌ This command can only be used in a server.');
            return;
        }

        const user = await this.getOrCreateUser(interaction.user.id);
        const clientId = await this.tenantClientId(user);
        const clientOid = new mongoose.Types.ObjectId(clientId);
        const opts = (interaction as any).options;

        const name = opts?.get('name')?.value as string;
        const priority = (opts?.get('priority')?.value as 'high' | 'medium' | 'low') ?? 'medium';
        const templateName = (opts?.get('template')?.value as string) ?? 'dw-padrao';
        const requireKeywords = (opts?.get('keywords')?.value as string ?? '')
            .split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
        const destinationsRaw = (opts?.get('destinations')?.value as string ?? '');

        if (!name) {
            await this.editReply(interaction, '❌ Please provide a rule name.');
            return;
        }

        // Resolve destination identifiers to ObjectIds
        let destinationIds: any[] = [];
        if (destinationsRaw.trim()) {
            const identifiers = destinationsRaw.split(',').map((s: string) => s.trim()).filter(Boolean);
            for (const identifier of identifiers) {
                const dest = await Destination.findOne({ clientId: clientOid, identifier });
                if (dest) {
                    destinationIds.push(dest._id);
                } else {
                    await this.editReply(interaction, `❌ Destination \`${identifier}\` not found. Use \`/list-destinations\` to see your destinations.`);
                    return;
                }
            }
        }
        // Empty destinationIds = use all destinations (handled by QueueProcessorService)

        const rule = await Rule.create({
            clientId: clientOid,
            name,
            isActive: true,
            conditions: {
                channelIds: [interaction.channelId],
                requireKeywords,
            },
            action: {
                destinationIds,
                templateName,
                priority,
                addDelay: 0,
            },
        });

        const destLabel = destinationIds.length > 0
            ? `${destinationIds.length} destino(s) específico(s)`
            : 'Todos os destinos ativos';

        const embed = new EmbedBuilder()
            .setTitle('✅ Rule Created')
            .setDescription(`Rule **${name}** created for <#${interaction.channelId}>.`)
            .addFields([
                { name: 'Priority', value: priority, inline: true },
                { name: 'Template', value: templateName, inline: true },
                { name: 'Destinations', value: destLabel, inline: true },
                { name: 'Keywords', value: requireKeywords.length > 0 ? requireKeywords.join(', ') : 'None', inline: false },
                { name: 'ID', value: rule._id.toString(), inline: false },
            ])
            .setColor(0x00ff00)
            .setTimestamp();

        await this.editReply(interaction, { embeds: [embed] });
    }

    private async handleRuleList(interaction: CommandInteraction): Promise<void> {
        const user = await User.findByDiscordId(interaction.user.id);

        if (!user) {
            await this.editReply(interaction, '❌ You are not registered. Use `/setup` first.');
            return;
        }

        const { OrganizationService } = await import('@/services/organization/OrganizationService');
        const relatedIds = await OrganizationService.getInstance().getRelatedClientIds(
            await this.tenantClientId(user),
        );
        const rules = (
            await Promise.all(relatedIds.map(id => Rule.findByClientId(id)))
        ).flat();
        const seen = new Set<string>();
        const uniqueRules = rules.filter(r => {
            const k = r._id.toString();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });

        if (uniqueRules.length === 0) {
            await this.editReply(interaction, '📭 No rules configured. Use `/rules create` to add one.');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Your Rules')
            .setDescription(`${uniqueRules.length} rule(s) configured`)
            .setColor(0x0099ff)
            .setTimestamp();

        for (const rule of uniqueRules.slice(0, 10)) {
            embed.addFields([{
                name: `${rule.isActive ? '🟢' : '🔴'} ${rule.name}`,
                value: `Priority: **${rule.action.priority}** | Template: **${rule.action.templateName}** | Matches: **${rule.matchCount}**\nID: \`${rule._id}\``,
                inline: false,
            }]);
        }

        if (uniqueRules.length > 10) {
            embed.setFooter({ text: `Showing 10 of ${uniqueRules.length} rules` });
        }

        await this.editReply(interaction, { embeds: [embed] });
    }

    private async handleRuleToggle(interaction: CommandInteraction): Promise<void> {
        const user = await User.findByDiscordId(interaction.user.id);

        if (!user) {
            await this.editReply(interaction, '❌ You are not registered. Use `/setup` first.');
            return;
        }

        const ruleId = (interaction as any).options?.get('id')?.value as string;

        if (!ruleId || !mongoose.Types.ObjectId.isValid(ruleId)) {
            await this.editReply(interaction, '❌ Please provide a valid rule ID.');
            return;
        }

        const { OrganizationService } = await import('@/services/organization/OrganizationService');
        const relatedIds = await OrganizationService.getInstance().getRelatedClientIds(
            await this.tenantClientId(user),
        );
        const rule = await Rule.findOne({ _id: ruleId, clientId: { $in: relatedIds } });

        if (!rule) {
            await this.editReply(interaction, '❌ Rule not found.');
            return;
        }

        await rule.toggle();
        await this.editReply(interaction, `${rule.isActive ? '🟢 Rule **' + rule.name + '** enabled.' : '🔴 Rule **' + rule.name + '** disabled.'}`);
    }

    private async handleRuleDelete(interaction: CommandInteraction): Promise<void> {
        const user = await User.findByDiscordId(interaction.user.id);

        if (!user) {
            await this.editReply(interaction, '❌ You are not registered. Use `/setup` first.');
            return;
        }

        const ruleId = (interaction as any).options?.get('id')?.value as string;

        if (!ruleId || !mongoose.Types.ObjectId.isValid(ruleId)) {
            await this.editReply(interaction, '❌ Please provide a valid rule ID.');
            return;
        }

        const { OrganizationService } = await import('@/services/organization/OrganizationService');
        const relatedIds = await OrganizationService.getInstance().getRelatedClientIds(
            await this.tenantClientId(user),
        );
        const rule = await Rule.findOneAndDelete({ _id: ruleId, clientId: { $in: relatedIds } });

        if (!rule) {
            await this.editReply(interaction, '❌ Rule not found.');
            return;
        }

        await this.editReply(interaction, `✅ Rule **${rule.name}** deleted.`);
    }

    /**
     * Handle list-groups command — lists all WhatsApp groups the session is part of
     */
    private async handleListGroups(interaction: CommandInteraction): Promise<void> {
        try {
            const user = await User.findByDiscordId(interaction.user.id);

            if (!user) {
                await this.editReply(interaction, '❌ You are not registered. Use `/setup` first.');
                return;
            }

            const whatsappService = WhatsAppService.getInstance();
            const clientId = await this.tenantClientId(user);

            let groups: Array<{ id: string; name: string; participantsCount: number; isAdmin: boolean }>;

            try {
                groups = await whatsappService.listGroups(clientId);
            } catch (err: any) {
                if (err.message?.includes('session not found')) {
                    await this.editReply(interaction, '❌ WhatsApp not connected. Use `/connect-whatsapp` first.');
                } else {
                    await this.editReply(interaction, `❌ Failed to list groups: ${err.message}`);
                }
                return;
            }

            if (groups.length === 0) {
                await this.editReply(interaction, '📭 No groups found. Make sure your WhatsApp account is part of at least one group.');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('👥 WhatsApp Groups')
                .setDescription(`Found **${groups.length}** group(s). Use the ID with \`/add-destination\`.`)
                .setColor(0x25d366)
                .setTimestamp();

            // Discord embed fields are limited to 25, and field values to 1024 chars
            for (const group of groups.slice(0, 20)) {
                embed.addFields([{
                    name: `${group.isAdmin ? '👑 ' : ''}${group.name}`,
                    value: `ID: \`${group.id}\`\nParticipants: **${group.participantsCount}**`,
                    inline: true,
                }]);
            }

            if (groups.length > 20) {
                embed.setFooter({ text: `Showing 20 of ${groups.length} groups` });
            }

            await this.editReply(interaction, { embeds: [embed] });

        } catch (error) {
            this.serviceLogger.error('Error in list-groups command:', error);
            await this.safeErrorReply(interaction, '❌ Failed to list groups. Please try again.');
        }
    }
}