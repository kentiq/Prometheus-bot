const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('present')
    .setDescription('Prometheus presents an asset')
    .addStringOption(o => o.setName('asset').setDescription('ID of the asset to present').setRequired(true))
    .addAttachmentOption(o => o.setName('preview').setDescription('Image/GIF preview').setRequired(false))
    .addAttachmentOption(o => o.setName('video').setDescription('Video file').setRequired(false)),

  new SlashCommandBuilder()
    .setName('work')
    .setDescription('Showcase a collaboration project')
    .addStringOption(o => o.setName('asset').setDescription('ID of the collaborative project').setRequired(true))
    .addAttachmentOption(o => o.setName('preview').setDescription('Image/GIF of your work').setRequired(false))
    .addAttachmentOption(o => o.setName('video').setDescription('Video of your contribution').setRequired(false)),

  new SlashCommandBuilder()
    .setName('warning')
    .setDescription('Warn the channel of incoming assets')
    .addIntegerOption(o => o.setName('count').setDescription('Number of assets incoming').setRequired(true))
    .addIntegerOption(o => o.setName('seconds').setDescription('Delay in seconds').setRequired(true)),

  new SlashCommandBuilder()
    .setName('identity')
    .setDescription('Displays Prometheus identity and purpose')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🚀 Deploying slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Commands successfully registered!');
  } catch (error) {
    console.error('❌ Deployment error:', error);
  }
})();
