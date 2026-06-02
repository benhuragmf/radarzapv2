/**
 * Registra slash commands em um servidor Discord (atualização instantânea).
 *
 * Uso:
 *   cp .env.example .env   # preencher DISCORD_* e DISCORD_GUILD_ID
 *   npm run register-commands
 */

import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Defina DISCORD_TOKEN, DISCORD_CLIENT_ID e DISCORD_GUILD_ID no .env');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup WhatsApp integration for this channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to monitor').setRequired(false)),

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
    .addStringOption(o => o.setName('type').setDescription('Destination type').setRequired(true)
      .addChoices({ name: 'Group', value: 'group' }, { name: 'Contact', value: 'contact' }))
    .addStringOption(o => o.setName('identifier').setDescription('Phone number or group ID').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('Display name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('list-destinations')
    .setDescription('List your WhatsApp destinations'),

  new SlashCommandBuilder()
    .setName('remove-destination')
    .setDescription('Remove a WhatsApp destination')
    .addStringOption(o => o.setName('identifier').setDescription('Phone number or group ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('test-message')
    .setDescription('Send a test message to WhatsApp')
    .addStringOption(o => o.setName('message').setDescription('Test message content').setRequired(true))
    .addStringOption(o => o.setName('destination').setDescription('Destination identifier (leave empty = all)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('filters')
    .setDescription('Manage channel filters')
    .addSubcommand(s => s.setName('add-keyword').setDescription('Add a keyword filter')
      .addStringOption(o => o.setName('keyword').setDescription('Keyword').setRequired(true)))
    .addSubcommand(s => s.setName('remove-keyword').setDescription('Remove a keyword filter')
      .addStringOption(o => o.setName('keyword').setDescription('Keyword').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List current filters')),

  new SlashCommandBuilder()
    .setName('list-groups')
    .setDescription('List all WhatsApp groups your session is part of'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information'),

  new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Manage channel rules')
    .addSubcommand(s => s.setName('create').setDescription('Create a new rule for this channel')
      .addStringOption(o => o.setName('name').setDescription('Rule name').setRequired(true))
      .addStringOption(o => o.setName('priority').setDescription('Priority')
        .addChoices({ name: 'High', value: 'high' }, { name: 'Medium', value: 'medium' }, { name: 'Low', value: 'low' }))
      .addStringOption(o => o.setName('template').setDescription('Template name (default: radarzap-padrao)'))
      .addStringOption(o => o.setName('keywords').setDescription('Required keywords, comma-separated'))
      .addStringOption(o => o.setName('destinations').setDescription('Destination identifiers, comma-separated (empty = all)')))
    .addSubcommand(s => s.setName('list').setDescription('List all your rules'))
    .addSubcommand(s => s.setName('toggle').setDescription('Enable or disable a rule')
      .addStringOption(o => o.setName('id').setDescription('Rule ID').setRequired(true)))
    .addSubcommand(s => s.setName('delete').setDescription('Delete a rule')
      .addStringOption(o => o.setName('id').setDescription('Rule ID').setRequired(true))),
];

async function main() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  console.log(`Registrando ${commands.length} comandos no servidor ${GUILD_ID}...`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log('Comandos registrados. Devem aparecer imediatamente no Discord.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
