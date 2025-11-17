const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Charge et valide un fichier JSON
 * @param {string} filename - Nom du fichier à charger
 * @returns {Object} Objet JSON chargé ou objet vide en cas d'erreur
 */
function loadJSONFile(filename) {
  try {
    const filePath = path.join(__dirname, '..', 'Configuration', filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[WARN] Missing file: ${filename}`);
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) {
      console.warn(`[WARN] Empty file: ${filename}`);
      return {};
    }
    return JSON.parse(content);
  } catch (error) {
    console.error(`[ERROR] Error loading ${filename}:`, error.message);
    return {};
  }
}

const channels = loadJSONFile('channels.json');
const assets = loadJSONFile('assets.json');
const collabs = loadJSONFile('workwith.json');
const clients = loadJSONFile('clients.json');
const identities = loadJSONFile('identities.json');

const channelChoices = Object.keys(channels).length > 0 
  ? Object.keys(channels).map(key => ({ name: channels[key].title, value: key }))
  : [];
const assetChoices = Object.keys(assets).length > 0
  ? Object.keys(assets).map(key => ({ name: assets[key].name, value: key }))
  : [];
const collabChoices = Object.keys(collabs).length > 0
  ? Object.keys(collabs).map(key => ({ name: collabs[key].name, value: key }))
  : [];
const clientChoices = Object.keys(clients).length > 0
  ? Object.keys(clients).map(key => ({ name: clients[key].name, value: key }))
  : [];
const identityChoices = Object.keys(identities).length > 0
  ? Object.keys(identities).map(key => ({ name: identities[key].name, value: key }))
  : [];

const commands = [
  new SlashCommandBuilder()
    .setName('present')
    .setDescription('Prometheus presents an asset')
    .addStringOption(o => o.setName('asset').setDescription('ID of the asset to present').setRequired(true))
    .addAttachmentOption(o => o.setName('preview').setDescription('Image/GIF preview').setRequired(false))
    .addAttachmentOption(o => o.setName('video').setDescription('Video file').setRequired(false))
    .addAttachmentOption(o => o.setName('attachment1').setDescription('Attach a file').setRequired(false))
    .addAttachmentOption(o => o.setName('attachment2').setDescription('Attach another file').setRequired(false))
    .addAttachmentOption(o => o.setName('attachment3').setDescription('Attach another file').setRequired(false))
    .addAttachmentOption(o => o.setName('attachment4').setDescription('Attach another file').setRequired(false))
    .addAttachmentOption(o => o.setName('attachment5').setDescription('Attach another file').setRequired(false))
    .addAttachmentOption(o => o.setName('attachment6').setDescription('Attach another file').setRequired(false))
    .addAttachmentOption(o => o.setName('attachment7').setDescription('Attach another file').setRequired(false))
    .addAttachmentOption(o => o.setName('attachment8').setDescription('Attach another file').setRequired(false))
    .addAttachmentOption(o => o.setName('attachment9').setDescription('Attach another file').setRequired(false))
    .addAttachmentOption(o => o.setName('attachment10').setDescription('Attach another file').setRequired(false)),

  new SlashCommandBuilder()
    .setName('work')
    .setDescription('Showcase a collaboration project')
    .addStringOption(o => o.setName('asset').setDescription('ID of the collaborative project').setRequired(true))
    .addAttachmentOption(o => o.setName('preview').setDescription('Image/GIF of your work').setRequired(false))
    .addAttachmentOption(o => o.setName('video').setDescription('Video of your contribution').setRequired(false)),

  new SlashCommandBuilder()
    .setName('client')
    .setDescription("Présente un client et son travail.")
    .addStringOption(o => o.setName('id').setDescription('ID of the client to present').setRequired(true))
    .addAttachmentOption(o => o.setName('proof').setDescription('Preuve du travail').setRequired(false)),

  new SlashCommandBuilder()
    .setName('warning')
    .setDescription('Warn the channel of incoming assets')
    .addIntegerOption(o => o.setName('count').setDescription('Number of assets incoming').setRequired(true))
    .addIntegerOption(o => o.setName('seconds').setDescription('Delay in seconds').setRequired(true)),

  new SlashCommandBuilder()
    .setName('identity')
    .setDescription('Displays Prometheus identity and purpose'),

  new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Present a channel of the ecosystem.')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Channel to present')
        .setRequired(true)
        .addChoices(...channelChoices)
    ),

  new SlashCommandBuilder()
    .setName('whois')
    .setDescription("Affiche la carte de présentation d'une personne.")
    .addStringOption(option =>
      option.setName('personne')
        .setDescription('La personne dont afficher la carte.')
        .setRequired(true)
        .addChoices(...identityChoices)
    ),

  new SlashCommandBuilder()
    .setName('setup-welcome')
    .setDescription('Sets up the welcome embed with automatic commission status updates.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('channel')
        .setDescription('Channel ID or mention where the welcome embed will be posted.')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Sets up the ticket system and sends the control panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('category')
        .setDescription('The category where new tickets will be created.')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildCategory)
    )
    .addRoleOption(option =>
      option.setName('support_role')
        .setDescription('The role that will have access to tickets.')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('log_channel')
        .setDescription('The channel where ticket transcripts will be sent.')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
    ),

  new SlashCommandBuilder()
    .setName('pricing')
    .setDescription('Displays information about services and pricing.')
    .addChannelOption(o =>
        o.setName('ticket_channel')
        .setDescription('Le salon où les utilisateurs doivent créer des tickets.')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('com')
    .setDescription('Définit le statut des commissions.')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Le statut à définir')
        .setRequired(true)
        .addChoices(
          { name: 'Open', value: 'open' },
          { name: 'Closed', value: 'closed' },
        )
    ),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Vérifie la latence du bot.'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche la liste de toutes les commandes disponibles.'),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Affiche les statistiques du bot et du serveur.'),

  new SlashCommandBuilder()
    .setName('list-assets')
    .setDescription('Liste tous les assets disponibles dans les archives.'),

  new SlashCommandBuilder()
    .setName('list-clients')
    .setDescription('Liste tous les clients enregistrés.'),

  new SlashCommandBuilder()
    .setName('list-collabs')
    .setDescription('Liste toutes les collaborations.'),

  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Recherche dans les archives.')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Terme de recherche')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type de recherche')
        .setRequired(false)
        .addChoices(
          { name: 'Tout', value: 'all' },
          { name: 'Assets', value: 'assets' },
          { name: 'Clients', value: 'clients' },
          { name: 'Collaborations', value: 'collabs' }
        )
    ),

  new SlashCommandBuilder()
    .setName('reload')
    .setDescription('Recharge les fichiers JSON sans redémarrer le bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Crée une sauvegarde de tous les fichiers JSON.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Display server rules.'),

  new SlashCommandBuilder()
    .setName('payment')
    .setDescription('Display payment information and methods.')
].map(command => command.toJSON());

// Vérification des variables d'environnement requises
if (!process.env.DISCORD_TOKEN) {
  console.error('[ERROR] DISCORD_TOKEN missing in .env file');
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error('[ERROR] CLIENT_ID missing in .env file');
  process.exit(1);
}

if (!process.env.GUILD_ID) {
  console.error('[ERROR] GUILD_ID missing in .env file');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('[INFO] Deploying slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('[SUCCESS] Commands successfully registered!');
  } catch (error) {
    console.error('[ERROR] Deployment error:', error);
    process.exit(1);
  }
})();
