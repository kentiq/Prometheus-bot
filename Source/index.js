// ✅ index.js — English-only public presentation with collab & warning system
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, WebhookClient, AttachmentBuilder, StringSelectMenuBuilder, MessageFlags, Partials } = require('discord.js');
const fs = require('fs');
const discordTranscripts = require('discord-html-transcripts');
require('dotenv').config();

const path = require('path');

/**
 * Charge et valide un fichier JSON
 * @param {string} filename - Nom du fichier à charger
 * @returns {Object} Objet JSON chargé ou objet vide en cas d'erreur
 */
function loadJSONFile(filename) {
  try {
    const filePath = path.join(__dirname, '..', 'Configuration', filename);
    if (!fs.existsSync(filePath)) {
      console.error(`[ERROR] Missing file: ${filename}`);
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

/**
 * Sauvegarde un objet JSON dans le dossier Configuration
 * @param {string} filename - Nom du fichier JSON
 * @param {Object} data - Données à sauvegarder
 */
function saveJSONFile(filename, data) {
  try {
    const filePath = path.join(__dirname, '..', 'Configuration', filename);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`[ERROR] Error saving ${filename}:`, error.message);
  }
}

/**
 * Sanitize les messages de log pour masquer les tokens Discord
 * @param {string} message - Message à sanitizer
 * @returns {string} Message avec tokens masqués
 */
function sanitizeLogMessage(message) {
  if (typeof message !== 'string') return message;
  // Masquer les tokens Discord (format: [a-zA-Z0-9]{24,}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27,38})
  return message.replace(/[a-zA-Z0-9]{24,}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27,38}/g, '[TOKEN_MASQUÉ]');
}

// Configuration (chargée avant le rate limiting)
const config = loadJSONFile('config.json');

// Rate limiting simple (par utilisateur)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = config.rateLimit?.window || 60000; // 1 minute par défaut
const RATE_LIMIT_MAX = config.rateLimit?.max || 10; // 10 commandes par minute par défaut

/**
 * Vérifie si un utilisateur a dépassé la limite de rate limiting
 * @param {string} userId - ID de l'utilisateur Discord
 * @returns {boolean} true si la limite n'est pas dépassée, false sinon
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const userLimits = rateLimitMap.get(userId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

  if (now > userLimits.resetTime) {
    userLimits.count = 0;
    userLimits.resetTime = now + RATE_LIMIT_WINDOW;
  }

  if (userLimits.count >= RATE_LIMIT_MAX) {
    return false;
  }

  userLimits.count++;
  rateLimitMap.set(userId, userLimits);
  return true;
}

// Nettoyer le rate limit map toutes les heures
setInterval(() => {
  const now = Date.now();
  for (const [userId, limits] of rateLimitMap.entries()) {
    if (now > limits.resetTime + RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(userId);
    }
  }
}, 3600000); // 1 heure

// Données
const assets  = loadJSONFile('assets.json');
const collabs = loadJSONFile('workwith.json');
const channels = loadJSONFile('channels.json');
const clients = loadJSONFile('clients.json');
const identities = loadJSONFile('identities.json');
const kCredits = loadJSONFile('credits.json');

// Tiers & K-Crédits (structure simplifiée V1)
const INVITE_TIERS = [
  { id: 'associate',      name: 'Associate',      minInvites: 2,   multiplier: 1.00 },
  { id: 'contributor',    name: 'Contributor',    minInvites: 5,   multiplier: 1.00 },
  { id: 'advocate',       name: 'Advocate',       minInvites: 10,  multiplier: 1.05 },
  { id: 'partner',        name: 'Partner',        minInvites: 15,  multiplier: 1.07 },
  { id: 'senior_partner', name: 'Senior Partner', minInvites: 20,  multiplier: 1.10 },
  { id: 'ambassador',     name: 'Ambassador',     minInvites: 30,  multiplier: 1.12 },
  { id: 'strategist',     name: 'Strategist',     minInvites: 40,  multiplier: 1.15 },
  { id: 'executive',      name: 'Executive',      minInvites: 55,  multiplier: 1.18 },
  { id: 'director',       name: 'Director',       minInvites: 75,  multiplier: 1.20 },
  { id: 'architect',      name: 'Architect',      minInvites: 100, multiplier: 1.25 }
];

/**
 * Retourne le Tier correspondant au nombre d'invites
 * @param {number} invites
 * @returns {{id: string, name: string, minInvites: number, multiplier: number}|null}
 */
function getTierForInvites(invites) {
  let currentTier = null;

  for (const tier of INVITE_TIERS) {
    if (invites >= tier.minInvites) {
      if (!currentTier || tier.minInvites > currentTier.minInvites) {
        currentTier = tier;
      }
    }
  }

  return currentTier;
}

/**
 * Applique +1 invite et +K-Crédits à un utilisateur
 * @param {string} userId
 */
function applyInviteReward(userId) {
  if (!userId) return;

  const record = kCredits[userId] || {
    invites: 0,
    kcredits: 0,
    tierId: null
  };

  record.invites += 1;

  const tier = getTierForInvites(record.invites);
  const multiplier = tier?.multiplier ?? 1.0;

  const baseCreditsGain = 1;
  const creditsGain = baseCreditsGain * multiplier;

  record.kcredits = parseFloat((record.kcredits + creditsGain).toFixed(2));
  record.tierId = tier ? tier.id : null;

  kCredits[userId] = record;

  saveJSONFile('credits.json', kCredits);
}

// Rôles & canaux système
const MEMBER_ROLE_ID     = '1440194456476450886';
const UNVERIFIED_ROLE_ID = '1440194557995122748';
const ACCESS_LOG_CHANNEL_ID = '1440200183655698432';

// Cache des invitations par serveur (code → uses)
const guildInvitesCache = new Map();

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

/**
 * Met en cache les invitations d'un serveur
 * @param {import('discord.js').Guild} guild
 */
async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();

    const codeUsesMap = new Map();

    invites.forEach(invite => {
      codeUsesMap.set(invite.code, invite.uses ?? 0);
    });

    guildInvitesCache.set(guild.id, codeUsesMap);
  } catch (error) {
    console.error('[ERROR] Failed to cache invites for guild:', guild.id, error);
  }
}

/**
 * Détecte le statut actuel des commissions en lisant le nom du canal
 * @returns {Promise<string>} 'open' ou 'closed'
 */
async function getCommsStatus() {
  try {
    const channelId = config.channels?.commsStatus;
    if (!channelId) return 'closed';
    
    const channel = await client.channels.fetch(channelId);
    if (!channel) return 'closed';
    
    const channelName = channel.name.toLowerCase();
    return channelName.includes('open') ? 'open' : 'closed';
  } catch (error) {
    console.error('[ERROR] Error getting comms status:', error);
    return 'closed';
  }
}

/**
 * Génère les embeds Welcome avec le statut des commissions dynamique
 * @param {string} commsStatus - 'open' ou 'closed'
 * @returns {EmbedBuilder[]}
 */
function createWelcomeEmbed(commsStatus) {
  const isOpen = commsStatus === 'open';
  const statusEmoji = isOpen ? '🟢' : '🔴';
  const statusText = isOpen ? 'Open' : 'Closed';
  
  const welcomeEmbed = new EmbedBuilder()
    .setAuthor({
      name: '〚✨〛 Welcome to Kentiq Universe'
    })
    .setTitle('Hello! Welcome to my digital workspace where I showcase my work, collaborate with teams, and share insights about Roblox development.')
    .setColor(0x5865F2);
  
  const spacerEmbed1 = new EmbedBuilder()
    .setDescription('\u200B')
    .setColor(0x2f3136);
  
  const contentEmbed = new EmbedBuilder()
    .addFields({
      name: 'What you\'ll find here:',
      value: '• 〚📦〛 Kentiq Area — Explore my latest projects and assets\n• 〚🤝〛 Work-with — See the teams I work with\n• 〚🎫〛 Tickets — Open a ticket for my development services',
      inline: false
    })
    .setColor(0x5B6EE8);
  
  const spacerEmbed2 = new EmbedBuilder()
    .setDescription('\u200B')
    .setColor(0x2f3136);
  
  const quickLinksEmbed = new EmbedBuilder()
    .addFields({
      name: '〚🔗〛 Quick Links',
      value: '> Portal: [kentiq.tech/portal](https://www.kentiq.tech/portal)\n> Portfolio: [kentiq.tech/portfolio](https://www.kentiq.tech/portfolio)\n> Services: [kentiq.tech/home](https://www.kentiq.tech/home)',
      inline: false
    })
    .setColor(0x6077DE);
  
  const spacerEmbed3 = new EmbedBuilder()
    .setDescription('\u200B')
    .setColor(0x2f3136);
  
  const statusEmbed = new EmbedBuilder()
    .addFields({
      name: '〚💼〛 Commissions Status',
      value: `〚${statusEmoji}〛 ${statusText}`,
      inline: false
    })
    .setColor(isOpen ? 0x2ecc71 : 0xe74c3c)
    .setFooter({
      text: 'Kentiq Universe'
    })
    .setTimestamp();
  
  const spacerEmbed4 = new EmbedBuilder()
    .setDescription('\u200B')
    .setColor(0x2f3136);
  
  const confirmationEmbed = new EmbedBuilder()
    .setDescription('Click the <a:Check:926902236691460126> reaction below to confirm you have read this message')
    .setColor(0x5865F2);
  
  return [welcomeEmbed, spacerEmbed1, contentEmbed, spacerEmbed2, quickLinksEmbed, spacerEmbed3, statusEmbed, spacerEmbed4, confirmationEmbed];
}

/**
 * Met à jour l'embed Welcome via webhook
 * @param {string} commsStatus - 'open' ou 'closed'
 */
async function updateWelcomeEmbed(commsStatus) {
  try {
    const webhookConfig = config.webhooks?.welcome;
    if (!webhookConfig?.id || !webhookConfig?.token) {
      console.warn('[WARN] Welcome webhook not configured. Skipping update.');
      return;
    }

    const webhook = new WebhookClient({ id: webhookConfig.id, token: webhookConfig.token });
    const embeds = createWelcomeEmbed(commsStatus);
    
    // Utiliser l'ID du message stocké dans la config, ou chercher dans le canal
    let messageId = webhookConfig.messageId;
    
    if (!messageId) {
      // Si pas d'ID stocké, chercher dans le canal
      const welcomeChannelId = config.channels?.welcome;
      if (welcomeChannelId) {
        try {
          const channel = await client.channels.fetch(welcomeChannelId);
          if (channel) {
            // Chercher le message Welcome dans les 50 derniers messages
            const messages = await channel.messages.fetch({ limit: 50 });
            const welcomeMessage = messages.find(msg => 
              msg.webhookId === webhookConfig.id &&
              msg.embeds.length > 0 && 
              msg.embeds[0].author?.name?.includes('Welcome')
            );
            
            if (welcomeMessage) {
              messageId = welcomeMessage.id;
              // Sauvegarder l'ID pour la prochaine fois
              const currentConfig = loadJSONFile('config.json');
              if (!currentConfig.webhooks) currentConfig.webhooks = {};
              if (!currentConfig.webhooks.welcome) currentConfig.webhooks.welcome = {};
              currentConfig.webhooks.welcome.messageId = messageId;
              fs.writeFileSync(
                path.join(__dirname, '..', 'Configuration', 'config.json'),
                JSON.stringify(currentConfig, null, 2)
              );
              Object.assign(config, currentConfig);
            }
          }
        } catch (error) {
          console.warn('[WARN] Could not search for welcome message in channel:', error.message);
        }
      }
    }

    if (messageId) {
      // Mettre à jour le message existant
      await webhook.editMessage(messageId, {
        embeds: embeds,
        username: 'Kentiq Universe',
        avatarURL: client.user?.displayAvatarURL()
      });
    } else {
      // Créer un nouveau message si aucun n'existe
      const sentMessage = await webhook.send({
        embeds: embeds,
        username: 'Kentiq Universe',
        avatarURL: client.user?.displayAvatarURL()
      });
      
      // Sauvegarder l'ID du nouveau message
      const currentConfig = loadJSONFile('config.json');
      if (!currentConfig.webhooks) currentConfig.webhooks = {};
      if (!currentConfig.webhooks.welcome) currentConfig.webhooks.welcome = {};
      currentConfig.webhooks.welcome.messageId = sentMessage.id;
      fs.writeFileSync(
        path.join(__dirname, '..', 'Configuration', 'config.json'),
        JSON.stringify(currentConfig, null, 2)
      );
      Object.assign(config, currentConfig);
    }
  } catch (error) {
    console.error('[ERROR] Error updating welcome embed:', error);
  }
}

client.once('clientReady', async () => {
  const botName = config.bot?.name || 'PROMETHEUS';
  
  // Démarrer le serveur de monitoring de déploiement
  try {
    const startDeploymentServer = require(path.join(__dirname, 'deployment', 'server'));
    startDeploymentServer(client);
  } catch (error) {
    console.error('[ERROR] Failed to start deployment server:', error);
  }
  console.log(`[${botName}] Bot active and ready to transmit digital artifacts.`);
  console.log(`[${botName}] Connected as: ${client.user.tag}`);
  console.log(`[${botName}] Serving ${client.guilds.cache.size} server(s)`);
  
  // Mettre à jour l'embed Welcome avec le statut actuel au démarrage
  try {
    const currentStatus = await getCommsStatus();
    await updateWelcomeEmbed(currentStatus);
    console.log(`[${botName}] Welcome embed updated with status: ${currentStatus}`);
  } catch (error) {
    console.warn(`[WARN] Could not update welcome embed on startup:`, error.message);
  }

  // Mettre en cache les invitations de tous les serveurs
  try {
    for (const [, guild] of client.guilds.cache) {
      await cacheGuildInvites(guild);
    }
    console.log('[INFO] Initial guild invites cache loaded.');
  } catch (error) {
    console.error('[ERROR] Failed to load initial invites cache:', error);
  }
});

// Gestion de la reconnexion automatique
client.on('error', error => {
  console.error('[ERROR] Discord.js error:', error);
});

client.on('disconnect', () => {
  console.warn('[WARN] Bot disconnected. Reconnecting...');
});

client.on('reconnecting', () => {
  console.log('[INFO] Reconnecting to Discord...');
});

// Message de bienvenue personnalisé pour les nouveaux membres
// NOTE: Requires "SERVER MEMBERS INTENT" to be enabled in Discord Developer Portal
// Go to: https://discord.com/developers/applications > Your Bot > Bot > Privileged Gateway Intents > Enable "SERVER MEMBERS INTENT"
client.on('guildMemberAdd', async (member) => {
  try {
    // Ignorer les bots
    if (member.user.bot) return;
    
    // Attribuer automatiquement le rôle "unverified" à l'arrivée
    try {
      const guild = member.guild;
      
      const unverifiedRole =
        guild.roles.cache.get(UNVERIFIED_ROLE_ID) ||
        await guild.roles.fetch(UNVERIFIED_ROLE_ID).catch(() => null);
      
      if (unverifiedRole && !member.roles.cache.has(unverifiedRole.id)) {
        await member.roles.add(unverifiedRole);
      }
    } catch (roleError) {
      console.error('[ERROR] Failed to assign unverified role on join:', roleError);
    }
    
    // Attendre un peu pour éviter les problèmes de cache
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Crédits d'invitation pour le parrain (si détectable)
    try {
      const guild = member.guild;
      const previousInvites = guildInvitesCache.get(guild.id);

      const newInvites = await guild.invites.fetch();

      let usedInvite = null;

      newInvites.forEach(invite => {
        const previousUses = previousInvites?.get(invite.code) ?? 0;
        const currentUses = invite.uses ?? 0;

        if (currentUses > previousUses) {
          usedInvite = invite;
        }
      });

      await cacheGuildInvites(guild);

      if (usedInvite && usedInvite.inviter) {
        applyInviteReward(usedInvite.inviter.id);
        console.log(`[INVITES] Credited invite to ${usedInvite.inviter.tag} (${usedInvite.inviter.id})`);
      }
    } catch (inviteError) {
      console.error('[ERROR] Failed to process invite credits on member join:', inviteError);
    }
    
    // Créer un embed de bienvenue personnalisé
    const welcomeEmbed = new EmbedBuilder()
      .setTitle('〚👋〛 Welcome to **Kentiq Universe**')
      .setDescription('Here\'s everything you need to know to get started:')
      .addFields(
        {
          name: '〚📜〛 Rules',
          value: 'Read the server rules: <#1400056802128826448>',
          inline: false
        },
        {
          name: '〚💰〛 Payment Information',
          value: 'Payment terms & billing info: <#1386358140462956624>',
          inline: false
        },
        {
          name: '〚📂〛 Skills & Expertise',
          value: 'Discover my full skillset: <#1358465216806912060>',
          inline: false
        },
        {
          name: '〚🎫〛 Tickets',
          value: 'For commissions or project requests, open a ticket in <#1386352662563393578>',
          inline: false
        },
        {
          name: '\u200B',
          value: 'This server acts as my official workspace and portfolio hub.\n\nFeel free to explore, ask questions, or just look around.',
          inline: false
        }
      )
      .setColor(0x5865F2)
      .setFooter({ text: 'Kentiq Universe • Welcome' })
      .setTimestamp();
    
    // Envoyer le message en DM
    try {
      await member.send({ embeds: [welcomeEmbed] });
    } catch (error) {
      // Si les DMs sont désactivés, on ignore l'erreur silencieusement
      console.warn(`[WARN] Could not send welcome DM to ${member.user.tag}: DMs may be disabled`);
    }
  } catch (error) {
    console.error('[ERROR] Error in guildMemberAdd:', error);
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  try {
    console.log('[REACTION] messageReactionAdd received:', {
      userTag: user?.tag,
      userId: user?.id,
      emojiId: reaction?.emoji?.id,
      emojiName: reaction?.emoji?.name,
      messageId: reaction?.message?.id
    });
    
    // Ignore bot reactions
    if (user.bot) return;
    
    // Fetch reaction if partial
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('[ERROR] Error fetching reaction:', error);
        return;
      }
    }
    
    // Fetch message if partial
    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch (error) {
        console.error('[ERROR] Error fetching message:', error);
        return;
      }
    }
    
    // Check if reaction is the custom Check emoji (ID: 926902236691460126)
    const checkEmojiId = '926902236691460126';
    const reactionEmojiId = reaction.emoji.id;
    
    if (reactionEmojiId !== checkEmojiId) return;
    
    // Check if message is the welcome message
    const welcomeMessageId = config.webhooks?.welcome?.messageId;
    if (!welcomeMessageId || reaction.message.id !== welcomeMessageId) {
      return;
    }
    
    console.log('[REACTION] Welcome message reaction detected for user:', user.tag, user.id);
    
    const guild = reaction.message.guild;
    if (!guild) return;
    
    // Récupérer le membre
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;
    
    let addedMemberRole = false;
    let removedUnverifiedRole = false;
    let errorDetails = null;
    
    try {
      // Rôle membre
      const memberRole =
        guild.roles.cache.get(MEMBER_ROLE_ID) ||
        await guild.roles.fetch(MEMBER_ROLE_ID).catch(() => null);
      
      if (memberRole && !member.roles.cache.has(memberRole.id)) {
        await member.roles.add(memberRole);
        addedMemberRole = true;
      }
      
      // Rôle unverified
      const unverifiedRole =
        guild.roles.cache.get(UNVERIFIED_ROLE_ID) ||
        await guild.roles.fetch(UNVERIFIED_ROLE_ID).catch(() => null);
      
      if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
        await member.roles.remove(unverifiedRole);
        removedUnverifiedRole = true;
      }
    } catch (roleError) {
      errorDetails = roleError;
      console.error('[ERROR] Failed to update roles on welcome reaction:', roleError);
    }
    
    // Log dans le canal d’accès
    try {
      const logChannel = await client.channels.fetch(ACCESS_LOG_CHANNEL_ID).catch(() => null);
      
      if (logChannel && logChannel.isTextBased && logChannel.isTextBased()) {
        const lines = [
          `✅ **Access granted via welcome reaction**`,
          `• User  : ${user.tag} (${user.id})`,
          `• Member: ${addedMemberRole ? 'role added' : 'already had role or missing role'}`,
          `• Unverified: ${removedUnverifiedRole ? 'role removed' : 'no unverified role to remove'}`
        ];
        
        if (errorDetails) {
          lines.push(`• Error: \`${errorDetails.message || 'Unknown error'}\``);
        }
        
        await logChannel.send(lines.join('\n'));
      }
    } catch (logError) {
      console.error('[ERROR] Failed to log access event:', logError);
    }
  } catch (error) {
    console.error('[ERROR] Error in reaction test handler:', error);
  }
});

// Gestion globale des erreurs non capturées (avec sanitization)
process.on('unhandledRejection', (reason, promise) => {
  const safeReason = typeof reason === 'string' ? sanitizeLogMessage(reason) : reason;
  console.error('[ERROR] Unhandled rejection:', safeReason);
});

process.on('uncaughtException', error => {
  const safeError = error.message ? { ...error, message: sanitizeLogMessage(error.message) } : error;
  console.error('[ERROR] Uncaught exception:', safeError);
  process.exit(1);
});

// --- DM command: /credits ---
client.on('messageCreate', async (message) => {
  try {
    // Only react in DMs, ignore bots
    if (message.author.bot) return;
    if (message.channel.type !== ChannelType.DM) return;

    const content = message.content.trim().toLowerCase();
    if (!content.startsWith('/credits')) return;

    const userId = message.author.id;
    const record = kCredits[userId] || { invites: 0, kcredits: 0, tierId: null };

    const tier = getTierForInvites(record.invites || 0);
    const multiplier = tier?.multiplier ?? 1.0;

    const embed = new EmbedBuilder()
      .setTitle('〚₭〛 K-Credits — Invite Profile')
      .setDescription('Current status of your invite contributions and K-Credits inside **Kentiq Universe**.')
      .addFields(
        {
          name: 'Valid invites',
          value: `\`${record.invites || 0}\``,
          inline: true
        },
        {
          name: 'K-Credits balance',
          value: `\`${(record.kcredits || 0).toFixed(2)} ₭\``,
          inline: true
        },
        {
          name: 'Tier',
          value: tier ? `${tier.name} (x${multiplier.toFixed(2)})` : 'No Tier reached yet.',
          inline: false
        }
      )
      .setColor(0x00bcd4)
      .setFooter({ text: 'Kentiq Universe • Invite Program' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('[ERROR] Error handling DM /credits:', error);
    await message.reply('❌ An error occurred while retrieving your credits.').catch(() => {});
  }
});

client.on('interactionCreate', async interaction => {
  console.log('[INTERACTION] Received interaction:', interaction.type, interaction.isStringSelectMenu() ? `selectMenu:${interaction.customId}` : interaction.commandName || interaction.customId || 'unknown');
  
  try {
    // Rate limiting (sauf pour les admins)
    if (interaction.isChatInputCommand() || interaction.isButton()) {
      const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
      if (!isAdmin && !checkRateLimit(interaction.user.id)) {
        return interaction.reply({
          content: '⏱️ Vous utilisez les commandes trop rapidement. Veuillez patienter un moment.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }

  // --- Ticket System ---
  if (interaction.isButton()) {
    // --- Create Ticket ---
    if (interaction.customId === 'create_ticket') {
      const ticketsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Configuration', 'tickets.json'), 'utf8'));
      
      const ticketChannelName = `ticket-${interaction.user.username}`;
      const existingChannel = interaction.guild.channels.cache.find(c => c.name.toLowerCase() === ticketChannelName.toLowerCase());

      if (existingChannel) {
        return interaction.reply({ content: 'You already have an open ticket.', flags: MessageFlags.Ephemeral });
      }

      const category = await interaction.guild.channels.fetch(ticketsConfig.categoryId);
      if (!category || category.type !== ChannelType.GuildCategory) {
          return interaction.reply({ content: 'Error: The ticket category is misconfigured. Please contact an admin.', flags: MessageFlags.Ephemeral });
      }

      let newChannel;

      try {
        newChannel = await interaction.guild.channels.create({
          name: ticketChannelName,
          type: ChannelType.GuildText,
          parent: category,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
            { id: ticketsConfig.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles] },
            { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles] }
          ],
        });
      } catch (error) {
        console.error('[ERROR] Failed to create ticket channel:', error);

        if (error.code === 50013) {
          return interaction.reply({
            content: '❌ I don\'t have permission to create channels in the configured ticket category. Please ensure my role has **Manage Channels** on that category.',
            flags: MessageFlags.Ephemeral
          });
        }

        return interaction.reply({
          content: '❌ An unexpected error occurred while creating the ticket channel.',
          flags: MessageFlags.Ephemeral
        });
      }

      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`Ticket from ${interaction.user.username}`)
        .setDescription('Welcome to your ticket. Support will be with you shortly. Please describe your request in detail.')
        .setColor(0x3498db)
        .setTimestamp();

      const closeButtonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket_request')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );

      await newChannel.send({
        content: `👋 Hello <@${interaction.user.id}>, <@&${ticketsConfig.supportRoleId}> will be with you soon.`,
        embeds: [welcomeEmbed],
        components: [closeButtonRow],
      });
      
      await interaction.reply({ content: `Your ticket has been created: ${newChannel}`, flags: MessageFlags.Ephemeral });
    }

    // --- Close Ticket Request ---
    if (interaction.customId === 'close_ticket_request') {
        const ticketsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Configuration', 'tickets.json'), 'utf8'));
        if (!interaction.member.roles.cache.has(ticketsConfig.supportRoleId)) {
            return interaction.reply({ content: 'You do not have permission to close this ticket.', flags: MessageFlags.Ephemeral });
        }
        
        const confirmationEmbed = new EmbedBuilder()
            .setTitle('Confirmation')
            .setDescription('Are you sure you want to close this ticket? This action cannot be undone.')
            .setColor(0xf1c40f);

        const confirmationButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_close_ticket').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_close_ticket').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [confirmationEmbed], components: [confirmationButtons] });
    }
    
    // --- Confirm Close Ticket ---
    if (interaction.customId === 'confirm_close_ticket') {
        const ticketsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Configuration', 'tickets.json'), 'utf8'));
        if (!interaction.member.roles.cache.has(ticketsConfig.supportRoleId)) return; // No message needed, already handled

        await interaction.update({ content: 'Saving transcript and closing ticket...', embeds: [], components: [] });

        if (ticketsConfig.logChannelId) {
            const logChannel = await interaction.guild.channels.fetch(ticketsConfig.logChannelId);
            const attachment = await discordTranscripts.createTranscript(interaction.channel, {
                saveImages: true,
                poweredBy: false,
                fileName: `transcript-${interaction.channel.name}.html`
            });

            if (logChannel) {
                await logChannel.send({
                    content: `Transcript for \`${interaction.channel.name}\` (Closed by ${interaction.user.tag})`,
                    files: [attachment]
                });
            }
        }
        await interaction.channel.delete();
    }
    
    // --- Cancel Close Ticket ---
    if (interaction.customId === 'cancel_close_ticket') {
        const ticketsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Configuration', 'tickets.json'), 'utf8'));
        if (!interaction.member.roles.cache.has(ticketsConfig.supportRoleId)) return;
        
        await interaction.message.delete();
    }

    // --- Welcome access button ---
    if (interaction.customId === 'welcome_access_confirm') {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        const member = interaction.member;

        if (!guild || !member || member.user.bot) {
          return interaction.editReply({ content: '❌ This button can only be used inside the server.' });
        }

        let addedMemberRole = false;
        let removedUnverifiedRole = false;
        let errorDetails = null;

        try {
          const memberRole =
            guild.roles.cache.get(MEMBER_ROLE_ID) ||
            await guild.roles.fetch(MEMBER_ROLE_ID).catch(() => null);

          if (memberRole && !member.roles.cache.has(memberRole.id)) {
            await member.roles.add(memberRole);
            addedMemberRole = true;
          }

          const unverifiedRole =
            guild.roles.cache.get(UNVERIFIED_ROLE_ID) ||
            await guild.roles.fetch(UNVERIFIED_ROLE_ID).catch(() => null);

          if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
            await member.roles.remove(unverifiedRole);
            removedUnverifiedRole = true;
          }
        } catch (roleError) {
          errorDetails = roleError;
          console.error('[ERROR] Failed to update roles on welcome access button:', roleError);
        }

        try {
          const logChannel = await client.channels.fetch(ACCESS_LOG_CHANNEL_ID).catch(() => null);

          if (logChannel && logChannel.isTextBased && logChannel.isTextBased()) {
            const lines = [
              `✅ **Access granted via welcome button**`,
              `• User  : ${interaction.user.tag} (${interaction.user.id})`,
              `• Member: ${addedMemberRole ? 'role added' : 'already had role or missing role'}`,
              `• Unverified: ${removedUnverifiedRole ? 'role removed' : 'no unverified role to remove'}`
            ];

            if (errorDetails) {
              lines.push(`• Error: \`${errorDetails.message || 'Unknown error'}\``);
            }

            await logChannel.send(lines.join('\n'));
          }
        } catch (logError) {
          console.error('[ERROR] Failed to log access event (button):', logError);
        }

        const summaryLines = [];

        if (addedMemberRole) {
          summaryLines.push('✅ You have been granted access to the server.');
        } else {
          summaryLines.push('ℹ️ You already had member access.');
        }

        if (removedUnverifiedRole) {
          summaryLines.push('🔓 Your unverified status has been removed.');
        }

        if (!addedMemberRole && !removedUnverifiedRole) {
          summaryLines.push('Nothing changed for your roles.');
        }

        await interaction.editReply({ content: summaryLines.join('\n') });
      } catch (error) {
        console.error('[ERROR] Error in welcome access button handler:', error);

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: '❌ An error occurred while processing your access confirmation.'
          }).catch(() => {});
        } else {
          await interaction.reply({
            content: '❌ An error occurred while processing your access confirmation.',
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }
      }
    }
  }

  // Ignorer les autres types d'interactions (sauf commandes + menus déroulants)
  if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) {
    return;
  }

  // --- /setup-welcome ---
  if (interaction.commandName === 'setup-welcome') {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You must be an administrator to use this command.', flags: MessageFlags.Ephemeral });
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const channelInput = interaction.options.getString('channel');
      let webhookChannel;

      // Essayer de parser comme ID ou mention
      const channelIdMatch = channelInput.match(/(\d+)/);
      if (channelIdMatch) {
        const channelId = channelIdMatch[1];
        try {
          webhookChannel = await interaction.guild.channels.fetch(channelId);
        } catch (error) {
          return interaction.editReply({ content: `❌ Channel with ID \`${channelId}\` not found. Please check the channel ID.` });
        }
      } else {
        return interaction.editReply({ content: '❌ Invalid channel format. Please provide a channel ID or mention.' });
      }

      if (!webhookChannel || (webhookChannel.type !== ChannelType.GuildText && webhookChannel.type !== ChannelType.GuildAnnouncement)) {
        return interaction.editReply({ content: '❌ The specified channel must be a text or announcement channel.' });
      }

      // Créer ou récupérer le webhook
      const webhooks = await webhookChannel.fetchWebhooks();
      let webhook = webhooks.find(w => w.name === 'Kentiq Welcome');

      if (!webhook) {
        webhook = await webhookChannel.createWebhook({
          name: 'Kentiq Welcome',
          avatar: client.user?.displayAvatarURL()
        });
      }

      // Sauvegarder les infos du webhook dans la config
      const currentConfig = loadJSONFile('config.json');
      if (!currentConfig.webhooks) currentConfig.webhooks = {};
      if (!currentConfig.webhooks.welcome) currentConfig.webhooks.welcome = {};
      
      currentConfig.webhooks.welcome.id = webhook.id;
      currentConfig.webhooks.welcome.token = webhook.token;
      
      if (!currentConfig.channels) currentConfig.channels = {};
      currentConfig.channels.welcome = webhookChannel.id;

      fs.writeFileSync(
        path.join(__dirname, '..', 'Configuration', 'config.json'),
        JSON.stringify(currentConfig, null, 2)
      );

      // Recharger la config
      Object.assign(config, currentConfig);

      // Obtenir le statut actuel et créer l'embed
      const currentStatus = await getCommsStatus();
      const embed = createWelcomeEmbed(currentStatus);

      // Envoyer le message Welcome
      const sentMessage = await webhook.send({
        embeds: [embed],
        username: 'Kentiq Universe',
        avatarURL: client.user?.displayAvatarURL()
      });

      // Sauvegarder l'ID du message pour les mises à jour futures
      currentConfig.webhooks.welcome.messageId = sentMessage.id;
      fs.writeFileSync(
        path.join(__dirname, '..', 'Configuration', 'config.json'),
        JSON.stringify(currentConfig, null, 2)
      );
      Object.assign(config, currentConfig);

      await interaction.editReply({
        content: `✅ Welcome embed configured successfully in ${webhookChannel}! The embed will automatically update when you change the commissions status with \`/com\`.`
      });
    } catch (error) {
      console.error('[ERROR] Error in /setup-welcome:', error);
      await interaction.editReply({ content: '❌ An error occurred while setting up the welcome embed.' });
    }
  }

  // --- /setup-tickets ---
  if (interaction.commandName === 'setup-tickets') {
    const setupChannelId = config.channels?.setupTickets;
    if (setupChannelId && interaction.channel.id !== setupChannelId) {
        return interaction.reply({ content: `This command must be run in the <#${setupChannelId}> channel.`, flags: MessageFlags.Ephemeral });
    }

    const category = interaction.options.getChannel('category');
    const supportRole = interaction.options.getRole('support_role');
    const logChannel = interaction.options.getChannel('log_channel');

    const config = {
      categoryId: category.id,
      supportRoleId: supportRole.id,
      logChannelId: logChannel ? logChannel.id : null,
    };
    fs.writeFileSync(path.join(__dirname, '..', 'Configuration', 'tickets.json'), JSON.stringify(config, null, 2));

    const embed = new EmbedBuilder()
      .setTitle('Kentiq Support')
      .setDescription('Click the button below to open a ticket and get help.')
      .setColor(0x2ecc71)
      .setFooter({ text: 'You can only have one ticket open at a time.'});

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'The ticket panel has been configured successfully!', flags: MessageFlags.Ephemeral });
  }

  // --- /present ---
  if (interaction.commandName === 'present') {
    try {
      await interaction.deferReply();

      const assetId = interaction.options.getString('asset');
      const asset   = assets[assetId];
      if (!asset) {
        return interaction.editReply({ content: "⚠️ Asset not found in Prometheus archives." });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📦 ${asset.name.toUpperCase()} [${asset.type}]`)
        .setDescription(`✨ ${asset.description?.en || asset.description}\n\n---\n\n`)
        .addFields(
          {
            name: '📦 Technical details',
            value:
              `• **Format:** \`${asset.format}\`\n` +
              `• **Status:** \`${asset.status?.en || asset.status}\`\n` +
              `• **Version:** \`${asset.version}\`\n`,
            inline: false
          },
          { name: '🧷 License', value: asset.license, inline: true },
          { name: '👤 Author',  value: asset.author,  inline: true },
          { name: '📅 Date',    value: asset.date,    inline: true }
        )
        .setColor(asset.color || 0x00bcd4)
        .setFooter({ text: 'Prometheus • Digital artifact archivist' })
        .setTimestamp();

      if (asset.type.includes('Modèle') || asset.type.includes('Model')) {
        embed.addFields(
          { name: '🎨 Polycount', value: `\`${asset.polycount}\``, inline: true },
          { name: '🦴 Rig', value: `\`${asset.rig}\``, inline: true },
          { name: '🏃 Animation', value: `\`${asset.animation}\``, inline: true },
          { name: '💻 Software', value: `\`${asset.software}\``, inline: true }
        );
      }

      const files = [];
      const previewAttachment = interaction.options.getAttachment('preview');
      if (asset.preview === 'attachment' && previewAttachment) {
        embed.setImage(previewAttachment.url);
        files.push(previewAttachment);
      } else if (asset.preview?.startsWith('http')) {
        embed.setImage(asset.preview);
      }

      const videoAttachment = interaction.options.getAttachment('video');
      if (asset.video === 'attachment' && videoAttachment) {
        files.push(videoAttachment);
      } else if (asset.video?.startsWith('http')) {
        embed.addFields({ name: '🎬 Video', value: `[External link](${asset.video})` });
      }

      for (let i = 1; i <= 10; i++) {
        const attachment = interaction.options.getAttachment(`attachment${i}`);
        if (attachment) {
          files.push(attachment);
        }
      }

      await interaction.editReply({ embeds: [embed], files });
    } catch (error) {
      console.error('[ERROR] Error in /present:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.', embeds: [], files: [] };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /work ---
  if (interaction.commandName === 'work') {
    try {
      await interaction.deferReply();

      const collabId = interaction.options.getString('asset');
      const item     = collabs[collabId];
      if (!item) {
        return interaction.editReply({ content: "⚠️ Collaboration not found." });
      }

      // 1) trigger Discord invite preview
      await interaction.followUp({ content: item.discord });

      // 2) send the embed
      const embed = new EmbedBuilder()
        .setTitle(`🤝 ${item.name.toUpperCase()} [Work with]`)
        .setDescription(`✨ ${item.description}\n\n---\n\n`)
        .addFields({
          name: '🛠️ What I worked on',
          value: item.contribution
            .split(',')
            .map(x => `• ${x.trim()}`)
            .join('\n') + '\n',
          inline: false
        })
        .setColor(0x4caf50)
        .setFooter({ text: 'Prometheus • Work with external teams' })
        .setTimestamp();

      const files = [];
      const previewAttachment = interaction.options.getAttachment('preview');
      if (item.preview === 'attachment' && previewAttachment) {
        embed.setImage(previewAttachment.url);
        files.push(previewAttachment);
      } else if (item.preview?.startsWith('http')) {
        embed.setImage(item.preview);
      }

      const videoAttachment = interaction.options.getAttachment('video');
      if (item.video === 'attachment' && videoAttachment) {
        files.push(videoAttachment);
      } else if (item.video?.startsWith('http')) {
        embed.addFields({ name: '🎬 Video', value: `[External link](${item.video})` });
      }

      await interaction.editReply({ embeds: [embed], files });
    } catch (error) {
      console.error('[ERROR] Error in /work:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.', embeds: [], files: [] };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /client ---
  if (interaction.commandName === 'client') {
    try {
      await interaction.deferReply();

      const clientId = interaction.options.getString('id');
      const clientData = clients[clientId];
      if (!clientData) {
        return interaction.editReply({ content: "⚠️ Client not found in Prometheus archives." });
      }

      const tasksList = clientData.tasks.split(',').map(t => `• ${t.trim()}`).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`💼 ${clientData.name.toUpperCase()} — ${clientData.role}`)
        .addFields(
          { name: '📝 Tasks Completed', value: tasksList }
        )
        .setColor(clientData.color || 0x3498db)
        .setFooter({ text: 'Prometheus • Client Showcase' })
        .setTimestamp();

      if (clientData.quote && clientData.quote.length > 0) {
        const MAX_FIELD_LENGTH = 1024;
        const quote = `*“${clientData.quote}”*`;
        
        const quoteChunks = [];
        for (let i = 0; i < quote.length; i += MAX_FIELD_LENGTH) {
          quoteChunks.push(quote.substring(i, i + MAX_FIELD_LENGTH));
        }
        
        quoteChunks.forEach((chunk, index) => {
          embed.addFields({
            name: index === 0 ? '💬 Client Feedback' : '\u200B',
            value: chunk,
          });
        });
      }

      const proofAttachment = interaction.options.getAttachment('proof');
      const replyOptions = { embeds: [embed] };

      if (clientData.proof === 'attachment' && proofAttachment) {
        replyOptions.files = [proofAttachment];
      } else if (clientData.proof?.startsWith('http')) {
        replyOptions.content = clientData.proof;
      }

      await interaction.editReply(replyOptions);
    } catch (error) {
      console.error('[ERROR] Error in /client:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.', embeds: [], files: [] };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /warning ---
  if (interaction.commandName === 'warning') {
    try {
      await interaction.deferReply();

      const count   = interaction.options.getInteger('count');
      const seconds = interaction.options.getInteger('seconds');
      // format HH:MM:SS
      const hms = new Date(seconds * 1000).toISOString().substr(11, 8);

      // initial warning
      await interaction.editReply(`⚠️ ${count} assets incoming in this channel... in ${hms}`);

      // follow-up when time is up
      setTimeout(() => {
        interaction.followUp(`🚨 ${count} assets are incoming now!`);
      }, seconds * 1000);
    } catch (error) {
      console.error('[ERROR] Error in /warning:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.', embeds: [], files: [] };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /identity ---
  if (interaction.commandName === 'identity') {
    try {
      await interaction.reply({
        content: '```ini\n[ SYSTEM BOOT SEQUENCE INITIALIZED ]\n> Loading memory core...\n```'
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      await interaction.editReply({
        content: '```ini\n[ MEMORY CORE LOADED ]\n> Accessing identity protocols...\n```'
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      const embed = new EmbedBuilder()
        .setTitle('🧠 PROMETHEUS — Digital Artifact Archivist')
        .setDescription(
          '**Prometheus** is an autonomous digital archivist designed to catalog, present, and transmit digital artifacts.\n\n' +
          '**Purpose:**\n' +
          '• Archive and showcase digital assets (VFX, UI, Models, Code, etc.)\n' +
          '• Present collaborative work and client showcases\n' +
          '• Manage ticket systems for support and commissions\n' +
          '• Provide identity verification and channel information\n\n' +
          '**Status:** ✅ Active and operational\n' +
          '**Version:** 1.1.0\n' +
          '**Architect:** Kentiq'
        )
        .setColor(0x00bcd4)
        .setFooter({ text: 'Prometheus • Digital artifact archivist' })
        .setTimestamp();

      await interaction.editReply({
        content: '',
        embeds: [embed]
      });
    } catch (error) {
      console.error('[ERROR] Error in /identity:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.' };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /channel ---
  if (interaction.commandName === 'channel') {
    const channelKey = interaction.options.getString('name');
    const channelData = channels[channelKey];

    if (channelData) {
      const embed = new EmbedBuilder()
        .setTitle(channelData.title)
        .setDescription(channelData.description)
        .setColor(channelData.color);
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply({ content: 'Channel not found!', flags: MessageFlags.Ephemeral });
    }
  }

  // --- /whois ---
  if (interaction.commandName === 'whois') {
    try {
      await interaction.deferReply({ flags: 0 });

      const personId = interaction.options.getString('personne');
      const identity = identities[personId];
      if (!identity) {
        return interaction.editReply({ content: "⚠️ Identity not found. Transmission terminated." });
      }

      // Vought-style build-up
      await interaction.editReply({ content: "```[ ACCESSING SUBJECT PROFILE... ]```" });
      await new Promise(resolve => setTimeout(resolve, 1500));

      await interaction.editReply({ content: "```[ AUTHENTICATION... GRANTED. ]```" });
      await new Promise(resolve => setTimeout(resolve, 1500));

      await interaction.editReply({ content: `\`\`\`[ LOADING DATA STREAM... SUBJECT : ${identity.name.toUpperCase()} ]\`\`\`` });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Parse presentation_markdown to extract Philosophy and Languages Spoken
      const presentation = identity.presentation_markdown || '';
      let philosophy = '';
      let languagesSpoken = '';
      
      // Extract Languages Spoken (stop before "---" or "### g🛠️ Noteworthy Projects")
      const languagesMatch = presentation.match(/###\s*🌐\s*Languages\s*Spoken\s*\n\n((?:.*\n?)*?)(?=\n\n---|\n\n###\s*🛠️|$)/s);
      if (languagesMatch) {
        // Encadrer les émojis des langues et nettoyer le contenu
        languagesSpoken = languagesMatch[1]
          .trim()
          .split('\n')
          .filter(line => !line.trim().startsWith('###')) // Retirer les lignes avec ###
          .map(line => {
            // Trouver l'émojie au début de la ligne et l'encadrer
            return line.replace(/^(🇫🇷|🇩🇿|🇬🇧|🇮🇹|🇪🇸|🇩🇪|🇯🇵|🇨🇳|🇰🇷|🇷🇺|🇵🇹|🇳🇱|🇸🇪|🇳🇴|🇩🇰|🇫🇮|🇵🇱|🇨🇿|🇭🇺|🇷🇴|🇬🇷|🇹🇷|🇸🇦|🇦🇪|🇮🇱|🇿🇦|🇧🇷|🇲🇽|🇦🇷|🇨🇱|🇨🇴|🇵🇪|🇻🇪|🇨🇦|🇦🇺|🇳🇿|🇮🇳|🇵🇰|🇧🇩|🇱🇰|🇹🇭|🇻🇳|🇮🇩|🇵🇭|🇲🇾|🇸🇬|🇭🇰|🇹🇼)/, '〚$1〛');
          })
          .filter(line => line.trim().length > 0) // Retirer les lignes vides
          .join('\n');
      }
      
      // Extract Philosophy (stop at end of document or before "---")
      const philosophyMatch = presentation.match(/###\s*💭\s*Philosophy\s*\n\n((?:>.*\n?)*?)(?=\n\n---|$)/s);
      if (philosophyMatch) {
        // Nettoyer le contenu pour retirer les ### parasites
        philosophy = philosophyMatch[1]
          .trim()
          .split('\n')
          .filter(line => !line.trim().startsWith('###')) // Retirer les lignes avec ###
          .join('\n')
          .trim();
      }

      // Build multi-embed structure with separators
      const titleEmbed = new EmbedBuilder()
        .setTitle(`〚⚜️〛 ${identity.name.toUpperCase()} — ${identity.role}`)
        .addFields({
          name: '\u200B',
          value: 'A highly versatile Full-Stack developer specializing in comprehensive polyvalence.',
          inline: false
        })
        .setThumbnail(identity.image)
        .setColor(identity.color || 0x5865F2);

      const spacerEmbed1 = new EmbedBuilder()
        .setDescription('\u200B')
        .setColor(0x2f3136);

      const embeds = [titleEmbed, spacerEmbed1];

      // Philosophy embed
      if (philosophy) {
        const philosophyEmbed = new EmbedBuilder()
          .addFields({
            name: '〚💭〛 Philosophy',
            value: philosophy,
            inline: false
          })
          .setColor(0x5865F2);
        embeds.push(philosophyEmbed);
        
        const spacerEmbed2 = new EmbedBuilder()
          .setDescription('\u200B')
          .setColor(0x2f3136);
        embeds.push(spacerEmbed2);
      }

      // Languages Spoken embed
      if (languagesSpoken) {
        const languagesEmbed = new EmbedBuilder()
          .addFields({
            name: '〚🌐〛 Languages Spoken',
            value: languagesSpoken,
            inline: false
          })
          .setColor(0x5B6EE8);
        embeds.push(languagesEmbed);
        
        const spacerEmbed3 = new EmbedBuilder()
          .setDescription('\u200B')
          .setColor(0x2f3136);
        embeds.push(spacerEmbed3);
      }

      // Links embed
      if (identity.links && Object.keys(identity.links).length > 0) {
        const linksText = Object.entries(identity.links)
          .filter(([_, url]) => url && url.startsWith('http'))
          .map(([key, url]) => `> ${key.charAt(0).toUpperCase() + key.slice(1)}: [${key}](${url})`)
          .join('\n');
        
        if (linksText) {
          const linksEmbed = new EmbedBuilder()
            .addFields({
              name: '〚🔗〛 Links',
              value: linksText,
              inline: false
            })
            .setColor(0x6077DE)
            .setFooter({ text: 'Prometheus • Protocole d\'Identification' })
            .setTimestamp();
          embeds.push(linksEmbed);
        }
      }

      // Build buttons row
      const row = new ActionRowBuilder();
      if (identity.links) {
        Object.entries(identity.links).forEach(([key, url]) => {
          if(url && url.startsWith('http')) {
            row.addComponents(
              new ButtonBuilder()
                .setLabel(key.charAt(0).toUpperCase() + key.slice(1))
                .setURL(url)
                .setStyle(ButtonStyle.Link)
            );
          }
        });
      }

      const replyOptions = { content: '', embeds: embeds };
      if (row.components.length > 0) {
        replyOptions.components = [row];
      }

      await interaction.editReply(replyOptions);

    } catch (error) {
      console.error('[ERROR] Error in /whois:', error);
      const errorReply = { content: '❌ A critical error occurred during transmission.' };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /whois2 ---
  if (interaction.commandName === 'whois2') {
    try {
      await interaction.deferReply({ flags: 0 });

      const personId = interaction.options.getString('personne');
      const identity = identities[personId];
      if (!identity) {
        return interaction.editReply({ content: "⚠️ Identity not found. Transmission terminated." });
      }

      const imagesDir = path.join(__dirname, '..', 'images');

      // Vérifier que le dossier images existe
      if (!fs.existsSync(imagesDir)) {
        return interaction.editReply({ content: "⚠️ Images folder not found." });
      }

      const embeds = [];
      const files = [];

      // Applications
      const applicationsPath = path.join(imagesDir, 'Applications.png');
      if (fs.existsSync(applicationsPath)) {
        const applicationsAttachment = new AttachmentBuilder(applicationsPath, { name: 'Applications.png' });
        files.push(applicationsAttachment);

        const applicationsEmbed = new EmbedBuilder()
          .setTitle('〚💻〛 Applications I Master')
          .setImage('attachment://Applications.png')
          .setColor(0x5865F2);
        
        embeds.push(applicationsEmbed);
        
        const spacerEmbed1 = new EmbedBuilder()
          .setDescription('\u200B')
          .setColor(0x2f3136);
        embeds.push(spacerEmbed1);
      }

      // Auxiliary Skills
      const auxiliaryPath = path.join(imagesDir, 'Auxiliary Skills.png');
      if (fs.existsSync(auxiliaryPath)) {
        const auxiliaryAttachment = new AttachmentBuilder(auxiliaryPath, { name: 'AuxiliarySkills.png' });
        files.push(auxiliaryAttachment);

        const auxiliaryEmbed = new EmbedBuilder()
          .setTitle('〚🛠️〛 Auxiliary Skills')
          .setImage('attachment://AuxiliarySkills.png')
          .setColor(0x5B6EE8);
        
        embeds.push(auxiliaryEmbed);
        
        const spacerEmbed2 = new EmbedBuilder()
          .setDescription('\u200B')
          .setColor(0x2f3136);
        embeds.push(spacerEmbed2);
      }

      // Frameworks
      const frameworksPath = path.join(imagesDir, 'Frameworks.png');
      if (fs.existsSync(frameworksPath)) {
        const frameworksAttachment = new AttachmentBuilder(frameworksPath, { name: 'Frameworks.png' });
        files.push(frameworksAttachment);

        const frameworksEmbed = new EmbedBuilder()
          .setTitle('〚⚙️〛 Frameworks')
          .setImage('attachment://Frameworks.png')
          .setColor(0x6077DE);
        
        embeds.push(frameworksEmbed);
        
        const spacerEmbed3 = new EmbedBuilder()
          .setDescription('\u200B')
          .setColor(0x2f3136);
        embeds.push(spacerEmbed3);
      }

      // Languages
      const languagesPath = path.join(imagesDir, 'Languages.png');
      if (fs.existsSync(languagesPath)) {
        const languagesAttachment = new AttachmentBuilder(languagesPath, { name: 'Languages.png' });
        files.push(languagesAttachment);

        const languagesEmbed = new EmbedBuilder()
          .setTitle('〚🌐〛 Languages')
          .setImage('attachment://Languages.png')
          .setColor(0x5865F2)
          .setFooter({ text: 'Prometheus • Protocole d\'Identification' })
          .setTimestamp();
        
        embeds.push(languagesEmbed);
      }

      if (embeds.length === 0) {
        return interaction.editReply({ content: "⚠️ No images found in the images folder." });
      }

      await interaction.editReply({ embeds: embeds, files: files });

    } catch (error) {
      console.error('[ERROR] Error in /whois2:', error);
      const errorReply = { content: '❌ A critical error occurred during transmission.' };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /com ---
  if (interaction.commandName === 'com') {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const status = interaction.options.getString('status');
      const channelId = config.channels?.commsStatus;
      
      if (!channelId) {
        return interaction.editReply({ content: '⚠️ Commission status channel is not configured.' });
      }

      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        return interaction.editReply({ content: '⚠️ Channel not found.' });
      }

      const newName = status === 'open'
          ? '〚🟢〛Comms : Open'
          : '〚🔴〛Comms : Closed';
      
      await channel.setName(newName);

      // Mettre à jour l'embed Welcome automatiquement
      await updateWelcomeEmbed(status);

      await interaction.editReply({ content: `Channel name has been updated to: **${newName}**. Welcome embed has been automatically updated.` });

    } catch (error) {
      console.error('[ERROR] Error in /com:', error);
      if (error.code === 50013) {
        await interaction.editReply({ content: '❌ Error: I don\'t have permission to modify this channel\'s name. Please check my permissions (`Manage Channels`).' });
      } else {
        const errorReply = { content: '❌ An error occurred while processing this command.' };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(errorReply);
        } else {
          await interaction.reply(errorReply);
        }
      }
    }
  }

  // --- /pricing ---
  if (interaction.commandName === 'pricing') {
    try {
      await interaction.deferReply();

      const ticketChannel = interaction.options.getChannel('ticket_channel');
      const ticketChannelMention = ticketChannel ? `<#${ticketChannel.id}>` : 'le salon de ticket dédié';

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✨ Kentiq: Your Partner for Roblox Development ✨')
        .setDescription("Hello everyone. This channel is dedicated to presenting the professional development and design services I have the opportunity to offer. My aim is to provide concrete expertise to help bring your Roblox projects to life.")
        .addFields(
          { name: '\u200B', value: "**How I Can Assist You:**\nThrough various projects, I've had the chance to develop a certain expertise in system architecture and performance-focused development. I hope this experience can be beneficial to you. Here are some areas where I can provide support:" },
          { name: '💻 Code & System Architecture', value: "• Development of custom frameworks and modular systems.\n• Implementation of advanced backend logic (DataStores, basic anti-cheat considerations).\n• Performance optimization and scalability solutions.\n• Integration of APIs (Roblox and external)." },
          { name: '📐 Models & Asset Creation', value: "• High-quality 3D modeling (props, environments, characters).\n• Optimized asset pipelines for performance." },
          { name: '🎬 Animation & VFX', value: "• Smooth character animations and cinematic sequences.\n• Custom visual effects (VFX)." },
          { name: '🎧 SFX & Audio Design', value: "• Creation of immersive soundscapes and custom sound effects." },
          { name: '🎨 UX-UI & Graphics', value: "• Design and implementation of intuitive user interfaces (UI).\n• Branding and visual identity development for your project." },
          { name: '🌐 Web Development', value: "• Development of custom web dashboards and game management tools (front-end & back-end)." },
          { name: '\u200B', value: '\u200B' },
          { name: 'My Approach & Pricing', value: "My goal is to deliver not just functional code, but robust, maintainable, and well-documented solutions that provide **lasting value** to your project. As each project is unique and has specific requirements, **all my services are quoted on a customized basis.**\n\nThe pricing will humbly reflect the complexity of the work, the specialized expertise required, and the long-term value that, I hope, my solutions will bring to your project's success and longevity." },
          { name: '\u200B', value: '\u200B' },
          { name: 'How to Start (Essential First Step)', value: `1.  **Open a Ticket:** To request a quote or discuss a project, please open a new ticket in ${ticketChannelMention}.\n2.  **Briefly Describe Your Project:** In the ticket, please provide an overview of your game, the specific task for which you need assistance, and your general objectives.\n3.  **Initial Consultation:** We will then arrange a brief consultation to discuss your needs in detail and determine the best approach.\n4.  **Custom Quote:** Following our discussion, you will receive a personalized quote detailing the scope of work, deliverables, timeline, and pricing.` },
          { name: '\u200B', value: '\u200B' },
          { name: 'Discover My Work', value: "Feel free to browse my portfolio to see examples of my past projects and technical approach:\n•   **Kentiq Portfolio:** You can explore dedicated channels like #〚💻〛𝖢𝗈𝖽𝖾, #〚🔊〛𝖲𝖥𝖷, etc.\n•   **My Website:** [https://www.kentiq.tech/portal](https://www.kentiq.tech/portal)" }
        )
        .setFooter({ text: 'Sincerely, Kentiq' });
      
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[ERROR] Error in /pricing:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.' };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /ping ---
  if (interaction.commandName === 'ping') {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const timeDiff = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '⏱️ Latence du bot', value: `${timeDiff}ms`, inline: true },
        { name: '🌐 Latence API', value: `${apiLatency}ms`, inline: true }
      )
      .setColor(0x00bcd4)
      .setFooter({ text: 'Prometheus • System Status' })
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  }

  // --- /help ---
  if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('📚 Prometheus — Command Guide')
      .setDescription('Here are all available commands to navigate the Prometheus ecosystem:')
      .addFields(
        { name: '📦 Archives', value: '`/present` — Present an asset from the archives\n`/work` — Display a collaboration with a team\n`/client` — Present a client and their work', inline: false },
        { name: '🔍 Search & List', value: '`/list-assets` — List all available assets\n`/list-clients` — List all registered clients\n`/list-collabs` — List all collaborations\n`/search` — Search through archives (assets, clients, collaborations)', inline: false },
        { name: 'ℹ️ Information', value: '`/identity` — Display Prometheus identity and purpose\n`/channel` — Present an ecosystem channel\n`/whois` — Display a person\'s profile card\n`/ping` — Check bot latency\n`/stats` — Display bot and server statistics\n`/help` — Display this command list', inline: false },
        { name: '📜 Rules & Information', value: '`/rules` — Display server rules\n`/payment` — Payment methods and billing information', inline: false },
        { name: '🎫 Tickets', value: '`/setup-tickets` — Configure the ticket system and send the control panel', inline: false },
        { name: '⚙️ Administration', value: '`/pricing` — Display service and pricing information\n`/com` — Set commission status (Open/Closed)\n`/setup-welcome` — Configure the dynamic welcome message\n`/reload` — Reload JSON files without restarting (Admin only)\n`/backup` — Create a backup of all JSON files (Admin only)\n`/deploytest` — Test the deployment monitoring webhook (Admin only)', inline: false }
      )
      .setColor(0x00bcd4)
      .setFooter({ text: 'Prometheus • Digital artifact archivist' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // --- /stats ---
  if (interaction.commandName === 'rules') {
    try {
      const rulesEmbed = new EmbedBuilder()
        .setTitle('〚📜〛 Server Rules')
        .setDescription('Please read and follow these rules to ensure a positive experience for everyone.')
        .addFields(
          {
            name: '1. Respect',
            value: 'Be respectful to all members. Harassment, discrimination, or hate speech will not be tolerated.',
            inline: false
          },
          {
            name: '2. No Spam',
            value: 'Avoid spamming messages, emojis, or reactions. Keep conversations meaningful and on-topic.',
            inline: false
          },
          {
            name: '3. Appropriate Content',
            value: 'Keep all content appropriate for all ages. NSFW content is strictly prohibited.',
            inline: false
          },
          {
            name: '4. No Self-Promotion',
            value: 'Do not promote your own content, services, or servers without permission from staff.',
            inline: false
          },
          {
            name: '5. Follow Discord ToS',
            value: 'All Discord Terms of Service and Community Guidelines apply here.',
            inline: false
          },
          {
            name: '6. Business Inquiries',
            value: 'For business inquiries or project requests, you can use the ticket system or DM me directly. Tickets help me stay organized, but DMs are also welcome.',
            inline: false
          },
          {
            name: '7. Responsibility & Information',
            value: 'By using this server, you acknowledge that you have read and understood the Rules, payment information (`/payment`), and skill descriptions. Failure to read these documents does not exempt you from their terms. All information provided in official channels (Rules, Pricing, Skills) is binding.',
            inline: false
          }
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'Kentiq Universe • Rules' })
        .setTimestamp();

      // Reply publicly (not ephemeral) so everyone can see it
      await interaction.reply({ embeds: [rulesEmbed], flags: 0 });
    } catch (error) {
      console.error('[ERROR] Error in /rules:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  if (interaction.commandName === 'deploytest') {
    try {
      const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
      if (!isAdmin) {
        return interaction.reply({ 
          content: '❌ You must be an administrator to use this command.', 
          flags: MessageFlags.Ephemeral 
        });
      }

      // Répondre immédiatement pour éviter le timeout Discord
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const { sendDeployUpdate } = require(path.join(__dirname, 'webhooks', 'deploy-monitor'));
      
      await sendDeployUpdate({
        title: 'Prometheus Deployment Webhook',
        description: 'The monitoring webhook is working correctly.',
        color: 0x57F287
      });

      await interaction.editReply({ 
        content: '✅ Webhook sent to monitoring channel.' 
      });
    } catch (error) {
      console.error('[ERROR] Error in /deploytest:', error);
      
      let errorMessage = '❌ An error occurred while processing this command.';
      if (error.code === 'ECONNABORTED') {
        errorMessage = '❌ Timeout: The webhook took too long to respond. Check DEPLOY_WEBHOOK_URL.';
      } else if (error.response) {
        errorMessage = `❌ HTTP Error ${error.response.status}: ${error.response.statusText}`;
      } else if (error.request) {
        errorMessage = '❌ No response from webhook. Check DEPLOY_WEBHOOK_URL.';
      }

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
      }
    }
  }

  if (interaction.commandName === 'payment') {
    try {
      const titleEmbed = new EmbedBuilder()
        .setTitle('〚💰〛 Payment Information')
        .setDescription('Official payment terms for all services and commissions.')
        .setColor(0x5865F2);
      
      const spacerEmbed1 = new EmbedBuilder()
        .setDescription('\u200B')
        .setColor(0x2f3136);
      
      const paymentMethodsEmbed = new EmbedBuilder()
        .addFields({
          name: '〚💳〛 Accepted Payment Methods',
          value: '• PayPal (Friends & Family — recommended)\n• Cryptocurrency\n• Robux (Only for amounts > 100,000 Robux)',
          inline: false
        })
        .setColor(0x5865F2);
      
      const spacerEmbed2 = new EmbedBuilder()
        .setDescription('\u200B')
        .setColor(0x2f3136);
      
      const billingModesEmbed = new EmbedBuilder()
        .addFields({
          name: '〚🧠〛 Two Billing Modes Available',
          value: '\u200B',
          inline: false
        })
        .setColor(0x5865F2);
      
      const consultingEmbed = new EmbedBuilder()
        .addFields({
          name: '1) Consulting — $90/hour (Full Flexibility)',
          value: '**Suitable for:**\n• Varied needs\n• Multiple tasks\n• Maintenance\n• Adjustments\n• Continuous or evolving work\n\n**Details:**\n• Minimum sessions: 1h\n• Payment must be made within 3 days after the quote is issued. After 3 days, the quote automatically expires.\n• Upfront (40%) applies only to scope-based services, not consulting.\n• Billing based on actual time spent',
          inline: false
        })
        .setColor(0x5B6EE8);
      
      const scopeEmbed = new EmbedBuilder()
        .addFields({
          name: '2) Scope-Based Service — Fixed Price (Strict Scope)',
          value: '**Suitable for:**\n• Precise deliverables\n• Defined modules\n• Complete systems with specifications\n\n**Details:**\n• Scope defined BEFORE start\n• No additions included outside scope\n• Any extra = separate quote\n• 40% upfront (non-refundable)\n• 60% upon delivery',
          inline: false
        })
        .setColor(0x6077DE);
      
      const spacerEmbed3 = new EmbedBuilder()
        .setDescription('\u200B')
        .setColor(0x2f3136);
      
      const securityEmbed = new EmbedBuilder()
        .addFields({
          name: '〚🔒〛 Security Policy',
          value: 'Once the service is delivered and validated, **no refunds** are possible.\n\nThe initial payment (40%) is non-refundable, even if the project is stopped, as it covers:\n• Slot reservation\n• Preparation hours\n• Already produced elements',
          inline: false
        })
        .setColor(0x5865F2)
        .setFooter({ text: 'Kentiq Universe • Payment Information' })
        .setTimestamp();
      
      const skillsEmbed = new EmbedBuilder()
        .setDescription(`Want to know what my skills are? Click here: <#1358465216806912060>`)
        .setColor(0x5865F2);

      await interaction.reply({ 
        embeds: [
          titleEmbed, 
          spacerEmbed1, 
          paymentMethodsEmbed, 
          spacerEmbed2, 
          billingModesEmbed, 
          consultingEmbed, 
          scopeEmbed, 
          spacerEmbed3, 
          securityEmbed,
          skillsEmbed
        ], 
        flags: 0 
      });
    } catch (error) {
      console.error('[ERROR] Error in /payment:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  if (interaction.commandName === 'stats') {
    try {
      await interaction.deferReply();

      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      const memoryUsage = process.memoryUsage();
      const memoryMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);

      const embed = new EmbedBuilder()
        .setTitle('📊 Prometheus Statistics')
        .addFields(
          { name: '🤖 Bot', value: `**Tag:** ${client.user.tag}\n**ID:** ${client.user.id}\n**Version:** 1.1.0`, inline: true },
          { name: '🌐 Server', value: `**Name:** ${interaction.guild.name}\n**Members:** ${interaction.guild.memberCount}\n**Channels:** ${interaction.guild.channels.cache.size}`, inline: true },
          { name: '⏱️ Uptime', value: uptimeString, inline: false },
          { name: '💾 Memory', value: `${memoryMB} MB`, inline: true },
          { name: '📦 Archives', value: `**Assets:** ${Object.keys(assets).length}\n**Clients:** ${Object.keys(clients).length}\n**Collabs:** ${Object.keys(collabs).length}\n**Identities:** ${Object.keys(identities).length}`, inline: true },
          { name: '🌐 Latency', value: `${Math.round(client.ws.ping)}ms`, inline: true }
        )
        .setColor(0x00bcd4)
        .setFooter({ text: 'Prometheus • System Statistics' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[ERROR] Error in /stats:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.' };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /member ---
  if (interaction.commandName === 'member') {
    try {
      const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

      if (!isAdmin) {
        return interaction.reply({
          content: '❌ You must be an administrator to use this command.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const role =
        interaction.guild.roles.cache.get(MEMBER_ROLE_ID) ||
        await interaction.guild.roles.fetch(MEMBER_ROLE_ID).catch(() => null);

      if (!role) {
        return interaction.editReply({
          content: `❌ Unable to find the member role with ID \`${MEMBER_ROLE_ID}\`.`
        });
      }

      // Charger tous les membres dans le cache
      await interaction.guild.members.fetch();

      let updatedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const member of interaction.guild.members.cache.values()) {
        // Ignorer les bots
        if (member.user.bot) {
          continue;
        }

        if (member.roles.cache.has(role.id)) {
          skippedCount++;
          continue;
        }

        try {
          await member.roles.add(role);
          updatedCount++;
        } catch (error) {
          failedCount++;
          console.error(`[ERROR] Failed to add member role to ${member.user.tag} (${member.id}):`, error);
        }
      }

      await interaction.editReply({
        content:
          `✅ Member role \`${role.name}\` has been applied.\n` +
          `• Updated members: **${updatedCount}**\n` +
          `• Already had the role: **${skippedCount}**\n` +
          `• Failed: **${failedCount}**`
      });
    } catch (error) {
      console.error('[ERROR] Error in /member:', error);

      const errorReply = {
        content: '❌ An error occurred while assigning the member role.',
        flags: MessageFlags.Ephemeral
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /list-assets ---
  if (interaction.commandName === 'list-assets') {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const assetList = Object.entries(assets).map(([id, asset]) => 
        `• **${id}** — ${asset.name} [${asset.type}]`
      ).join('\n') || '*Aucun asset trouvé.*';

      const embed = new EmbedBuilder()
        .setTitle(`📦 Liste des assets (${Object.keys(assets).length})`)
        .setDescription(assetList.length > 2000 ? assetList.substring(0, 1997) + '...' : assetList)
        .setColor(0x00bcd4)
        .setFooter({ text: 'Prometheus • Asset Archive' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[ERROR] Error in /list-assets:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.' };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /list-clients ---
  if (interaction.commandName === 'list-clients') {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const clientList = Object.entries(clients).map(([id, clientData]) => 
        `• **${id}** — ${clientData.name} (${clientData.role})`
      ).join('\n') || '*Aucun client trouvé.*';

      const embed = new EmbedBuilder()
        .setTitle(`💼 Liste des clients (${Object.keys(clients).length})`)
        .setDescription(clientList.length > 2000 ? clientList.substring(0, 1997) + '...' : clientList)
        .setColor(0x3498db)
        .setFooter({ text: 'Prometheus • Client Archive' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[ERROR] Error in /list-clients:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.' };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /list-collabs ---
  if (interaction.commandName === 'list-collabs') {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const collabList = Object.entries(collabs).map(([id, collab]) => 
        `• **${id}** — ${collab.name}`
      ).join('\n') || '*Aucune collaboration trouvée.*';

      const embed = new EmbedBuilder()
        .setTitle(`🤝 Liste des collaborations (${Object.keys(collabs).length})`)
        .setDescription(collabList.length > 2000 ? collabList.substring(0, 1997) + '...' : collabList)
        .setColor(0x4caf50)
        .setFooter({ text: 'Prometheus • Collaboration Archive' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[ERROR] Error in /list-collabs:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.' };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /search ---
  if (interaction.commandName === 'search') {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const query = interaction.options.getString('query').toLowerCase();
      const type = interaction.options.getString('type') || 'all';

      const results = [];

      if (type === 'all' || type === 'assets') {
        Object.entries(assets).forEach(([id, asset]) => {
          if (asset.name.toLowerCase().includes(query) || 
              asset.description?.toLowerCase().includes(query) ||
              id.toLowerCase().includes(query)) {
            results.push({ type: 'asset', id, name: asset.name, data: asset });
          }
        });
      }

      if (type === 'all' || type === 'clients') {
        Object.entries(clients).forEach(([id, clientData]) => {
          if (clientData.name.toLowerCase().includes(query) || 
              clientData.role.toLowerCase().includes(query) ||
              id.toLowerCase().includes(query)) {
            results.push({ type: 'client', id, name: clientData.name, data: clientData });
          }
        });
      }

      if (type === 'all' || type === 'collabs') {
        Object.entries(collabs).forEach(([id, collab]) => {
          if (collab.name.toLowerCase().includes(query) || 
              collab.description?.toLowerCase().includes(query) ||
              id.toLowerCase().includes(query)) {
            results.push({ type: 'collab', id, name: collab.name, data: collab });
          }
        });
      }

      if (results.length === 0) {
        return interaction.editReply({ content: `❌ No results found for "${query}".` });
      }

      const resultList = results.slice(0, 20).map((result, index) => {
        const emoji = result.type === 'asset' ? '📦' : result.type === 'client' ? '💼' : '🤝';
        return `${emoji} **${result.id}** — ${result.name}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Search Results (${results.length})`)
        .setDescription(resultList)
        .addFields({ name: '💡 Tip', value: `Use \`/present ${results[0].id}\` or \`/client ${results[0].id}\` to see details.`, inline: false })
        .setColor(0x00bcd4)
        .setFooter({ text: `Search: "${query}"` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[ERROR] Error in /search:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.' };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /reload ---
  if (interaction.commandName === 'reload') {
    // Double vérification des permissions
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      console.warn(`[WARN] Unauthorized /reload attempt by ${interaction.user.tag} (${interaction.user.id})`);
      return interaction.reply({ content: '❌ You must be an administrator to use this command.', flags: MessageFlags.Ephemeral });
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Vider les objets existants
      Object.keys(assets).forEach(key => delete assets[key]);
      Object.keys(collabs).forEach(key => delete collabs[key]);
      Object.keys(channels).forEach(key => delete channels[key]);
      Object.keys(clients).forEach(key => delete clients[key]);
      Object.keys(identities).forEach(key => delete identities[key]);

      // Recharger les fichiers JSON
      const newAssets = loadJSONFile('assets.json');
      const newCollabs = loadJSONFile('workwith.json');
      const newChannels = loadJSONFile('channels.json');
      const newClients = loadJSONFile('clients.json');
      const newIdentities = loadJSONFile('identities.json');

      // Mettre à jour les variables globales
      Object.assign(assets, newAssets);
      Object.assign(collabs, newCollabs);
      Object.assign(channels, newChannels);
      Object.assign(clients, newClients);
      Object.assign(identities, newIdentities);

      const embed = new EmbedBuilder()
        .setTitle('✅ Data Reloaded')
        .setDescription('All JSON files have been reloaded successfully.')
        .addFields(
          { name: '📦 Assets', value: `${Object.keys(assets).length}`, inline: true },
          { name: '💼 Clients', value: `${Object.keys(clients).length}`, inline: true },
          { name: '🤝 Collabs', value: `${Object.keys(collabs).length}`, inline: true },
          { name: '📚 Channels', value: `${Object.keys(channels).length}`, inline: true },
          { name: '👤 Identities', value: `${Object.keys(identities).length}`, inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[ERROR] Error in /reload:', error);
      await interaction.editReply({ content: '❌ Error while reloading data.' });
    }
  }

  // --- /backup ---
  if (interaction.commandName === 'backup') {
    // Double vérification des permissions
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      console.warn(`[WARN] Unauthorized /backup attempt by ${interaction.user.tag} (${interaction.user.id})`);
      return interaction.reply({ content: '❌ You must be an administrator to use this command.', flags: MessageFlags.Ephemeral });
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(__dirname, '..', 'backups');
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const filesToBackup = ['assets.json', 'clients.json', 'workwith.json', 'channels.json', 'identities.json', 'tickets.json'];
      const backupFiles = [];
      const configDir = path.join(__dirname, '..', 'Configuration');

      for (const file of filesToBackup) {
        const filePath = path.join(configDir, file);
        if (fs.existsSync(filePath)) {
          const backupPath = path.join(backupDir, `${file.replace('.json', '')}-${timestamp}.json`);
          fs.copyFileSync(filePath, backupPath);
          backupFiles.push(file);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('💾 Backup Created')
        .setDescription(`Backup created successfully in the \`backups/\` folder.`)
        .addFields(
          { name: '📁 Saved Files', value: backupFiles.map(f => `• ${f}`).join('\n') || 'None', inline: false },
          { name: '🕐 Timestamp', value: timestamp, inline: false }
        )
        .setColor(0x2ecc71)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[ERROR] Error in /backup:', error);
      await interaction.editReply({ content: '❌ Error while creating backup.' });
    }
  }

  // --- /skill ---
  if (interaction.commandName === 'skill') {
    try {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('skill_select')
        .setPlaceholder('Select a skill to view details...')
        .addOptions([
          {
            label: 'Sound Design & Audio Crafting',
            value: 'sound_design',
            description: 'Complete audio production and sound design services'
          },
          {
            label: 'Animation & Motion Dynamics',
            value: 'animation',
            description: 'Character, interface, and environment animation services'
          },
          {
            label: 'Visual Effects (VFX)',
            value: 'vfx',
            description: 'Visual effects and particle systems for games'
          },
          {
            label: 'Systems & Architecture',
            value: 'systems',
            description: 'Reliable, modular, and performant system design'
          },
          {
            label: 'Front-End Roblox Engineering',
            value: 'frontend',
            description: 'Client-side UI development and interface systems'
          },
          {
            label: 'Back-End Roblox Engineering',
            value: 'backend',
            description: 'Server-side logic, security, and data management'
          },
          {
            label: 'Frameworks & Technical Ecosystem',
            value: 'frameworks',
            description: 'Framework usage, composition, and custom development'
          },
          {
            label: '3D Art & Asset Production',
            value: '3d_art',
            description: '3D modeling, optimization, and asset creation for games'
          },
          {
            label: 'Technical Leadership & Project Engineering',
            value: 'leadership',
            description: 'Technical vision, architecture, and project coordination'
          }
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.reply({
        content: 'Select a skill from the menu below to learn more:',
        components: [row],
        flags: 0
      });
    } catch (error) {
      console.error('[ERROR] Error in /skill:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- Handle select menu interactions ---
  if (interaction.isStringSelectMenu()) {
    console.log('[DEBUG] StringSelectMenu detected - customId:', interaction.customId, 'values:', interaction.values);

    // --- /skill select menu ---
    if (interaction.customId === 'skill_select') {
      console.log('[SKILL] Select menu interaction received');
      console.log('[SKILL] Selected value:', interaction.values[0]);

      try {
        // On répond avec un message éphémère séparé
        console.log('[SKILL] Deferring reply (ephemeral)...');

        await interaction.deferReply({ ephemeral: true });

        console.log('[SKILL] Reply deferred successfully');

        const selectedValue = interaction.values[0];
        let embed;

        console.log('[SKILL] Processing selection:', selectedValue);

        if (selectedValue === 'sound_design') {
          console.log('[SKILL] Building sound_design embed');

          embed = new EmbedBuilder()
            .setTitle('〚🎵〛 Sound Design & Audio Crafting')
            .setDescription('I design and produce the entire sound universe of a project, from subtle sound effects to complete compositions.')
            .addFields({
              name: 'What I do:',
              value: '• Creation of original OSTs (ambiences, themes, action music)\n• SFX production: impacts, UI, footsteps, magic, 3D interfaces, environment\n• Audio mixing and balancing for good in-game clarity\n• Design of coherent sound identities according to the project\'s style\n• Sound integration with gameplay (timing, reactivity, feedback)\n• Audio layers (overlay, transitions, dynamic variations)\n• Cleaning and editing samples for clean quality\n• Sound staging for cinematics, cutscenes and key moments',
              inline: false
            })
            .setColor(0x5865F2)
            .setFooter({ text: 'Kentiq Universe • Skills' })
            .setTimestamp();

          console.log('[SKILL] sound_design embed built');
        } else if (selectedValue === 'animation') {
          embed = new EmbedBuilder()
            .setTitle('〚🎬〛 Animation & Motion Dynamics')
            .setDescription('I create animations that bring characters, interfaces, and environments to life. The goal: make every action readable, fluid, and pleasant to experience.')
            .addFields({
              name: 'What I do:',
              value: '• Character and creature animations (movements, attacks, reactions)\n• Object and prop animation (mechanics, transitions, interactive elements)\n• Animated staging for cutscenes, introductions, and narrative moments\n• Creation of natural cycles (breathing, idle loops, movements)\n• Animation–gameplay sync: precise timing for punch, impact, speed\n• Fine adjustments: interpolation, curves, easing, fluidity\n• Work on "weight" and visual coherence according to the game\'s style\n• Clean integration into gameplay or UI systems',
              inline: false
            })
            .setColor(0x5865F2)
            .setFooter({ text: 'Kentiq Universe • Skills' })
            .setTimestamp();
        } else if (selectedValue === 'vfx') {
          embed = new EmbedBuilder()
            .setTitle('〚✨〛 Visual Effects (VFX)')
            .setDescription('I design visual effects that enhance the impact, atmosphere, and readability of the game. My role is to transform an action into a clear, styled, and coherent visual sensation.')
            .addFields({
              name: 'What I do:',
              value: '• Creation of gameplay effects: impacts, dash, spells, projectiles, explosions\n• Atmospheric effects: particles, dust, smoke, lights, distortions\n• Glitches, deformations, stylized special effects for interfaces or 3D surfaces\n• Texture animation (scrolling, gradients, dynamic patterns)\n• Setup of effects synchronized with animations and sounds\n• Construction of narrative effects: transitions, intense scenes, key moments\n• VFX optimization (performance, particle budget, visual coherence)\n• Clean and stable integration into gameplay, UI, or cinematic systems',
              inline: false
            })
            .setColor(0x5865F2)
            .setFooter({ text: 'Kentiq Universe • Skills' })
            .setTimestamp();
        } else if (selectedValue === 'systems') {
          embed = new EmbedBuilder()
            .setTitle('〚⚙️〛 Systems & Architecture')
            .setDescription('I design reliable, modular, and performant systems that serve as the backbone of the game. The goal: a clear, scalable, and easy-to-maintain architecture.')
            .addFields({
              name: 'What I do:',
              value: '• Design of modular systems (service-based architecture, controllers, isolated modules)\n• Setup of structured internal flows: initialization, updates, events, clean destruction\n• Definition of internal protocols to organize exchanges between different parts of the game\n• Creation of reusable components: state managers, transversal services, global utilities\n• Structuring of lifecycle management to synchronize loading, registries, and clean-ups\n• Management of event systems: signals, event buses, internal messages\n• Setup of rules and validations to keep the game coherent (anti-errors, anti-illegitimate behaviors)\n• "Scalable" approach: logic designed to support large projects, add features, or scale without recoding\n• Optimization of memory cost, number of calls, and update frequency\n• Clear separation between logical layers, data, UI, gameplay, to avoid spaghetti code',
              inline: false
            })
            .setColor(0x5865F2)
            .setFooter({ text: 'Kentiq Universe • Skills' })
            .setTimestamp();
        } else if (selectedValue === 'frontend') {
          embed = new EmbedBuilder()
            .setTitle('〚🖥️〛 Front-End Roblox Engineering')
            .setDescription('I develop the entire "player interface" client-side: visual logic, interactions, internal organization, and complex UI systems based on real-time data.')
            .addFields({
              name: 'What I do:',
              value: '• Development of interfaces in TSX / Roact / React-like\n• Creation of modular UI components: buttons, slots, pages, menus, panels\n• Structuring of interfaces via stores (global state), signals, and client synchronization\n• Dynamic UIs that adapt to player data: inventories, hotbar, tabs, descriptions\n• "Data-driven" systems: UI automatically rebuilds based on JSON data or server data\n• UI navigation management: transitions, hierarchies, pages, sub-pages\n• Construction of clean interactions: drag & drop, hover, selection, keyboard/mouse binding\n• Client optimization: reduction of re-renders, lightweight components, efficient state sharing\n• Strict separation between UI (visual) and logic (controllers, stores, signals)\n• Integration of UI feedback: animations, colors, transitions, instant reactions\n• Clean synchronization with server via events, signals, and client controllers',
              inline: false
            })
            .setColor(0x5865F2)
            .setFooter({ text: 'Kentiq Universe • Skills' })
            .setTimestamp();
        } else if (selectedValue === 'backend') {
          embed = new EmbedBuilder()
            .setTitle('〚🗄️〛 Back-End Roblox Engineering')
            .setDescription('I manage all server-side logic of a game: rules, security, synchronization, data, coherence, and communication with the client. My goal: a robust, predictable, and easy-to-extend backend.')
            .addFields(
              {
                name: 'What I do:',
                value: '• Development of all server logic: gameplay rules, validations, action coherence\n• Setup of client ↔ server communication protocols (events, signals, RPC-like)\n• Management of server authority: action control, anti-exploit checks, global coherence\n• Fine data synchronization: inventories, player states, objects, cooldowns\n• Optimized replication: sending only relevant or modified information\n• Persistence management: save/load, stable formats, versioned updates\n• Structuring of services and modules: clean and maintainable logical separation\n• Creation of validation mechanisms (server → safeguards against client errors or abuse)\n• Design of scalable systems: ability to add features without breaking everything\n• Load balancing: task distribution, delay management, server optimization',
                inline: false
              },
              {
                name: 'In short:',
                value: 'I build a solid, secure, precise, and performant backend, capable of supporting a complete, clean, and evolutive project.',
                inline: false
              }
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'Kentiq Universe • Skills' })
            .setTimestamp();
        } else if (selectedValue === 'frameworks') {
          embed = new EmbedBuilder()
            .setTitle('〚📚〛 Frameworks & Technical Ecosystem')
            .setDescription('I use, compose, and develop frameworks to efficiently structure a project. The goal: build clean, predictable, and extensible architectures, capable of supporting complex and long-term projects.')
            .addFields(
              {
                name: 'What I do:',
                value: '• Advanced use of Roblox frameworks (Roact, TSX UI, Reflex/Charm, Knit/Flamework, Feather)\n• Construction of reusable UI components based on declarative architecture\n• Setup of state stores, signals, observables, and coherent state management\n• Logical organization via Services / Controllers / Managers to maintain readable projects\n• Creation of internal mini-frameworks when standard frameworks are insufficient\n• Code normalization: structure, conventions, nomenclature, interfaces, shared services\n• Clean integration with gameplay, persistence, networking, and internal systems\n• Technical adaptation: wrappers, helpers, modular systems, overlays to improve existing systems',
                inline: false
              },
              {
                name: '〚⚜️〛 I also develop my own frameworks',
                value: 'I don\'t limit myself to using market frameworks. I also design them, with real architecture, modularity, and lifecycle work.',
                inline: false
              },
              {
                name: 'Some examples:',
                value: '• **Kentiq UI FX** — Complete UI framework (interactions, notifications, loaders, dynamic FX)\n• **PrometheOS Genesis** — Modular micro-kernel (dependency injection, policies, event bus, lifecycle)\n• **PrometheusSteps** — Dynamic ground deformation engine based on voxels\n• **AI Directive + Predatrice** (conceptual framework) — Dual AI architecture (memory, behaviors, routines)\n• **Housing Framework** (Grand Alfheim) — Client/server modules for mapping, interiors, interactions, persistence\n• **Advanced Projectile System** — Modular projectile system with distinct physical behaviors',
                inline: false
              },
              {
                name: 'Why it\'s important:',
                value: 'I am capable of:\n• analyzing an existing system\n• understanding its limitations\n• building on top of it\n• or replacing it with a custom framework\n\nall while guaranteeing readability, extensibility, and stability.',
                inline: false
              }
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'Kentiq Universe • Skills' })
            .setTimestamp();
        } else if (selectedValue === '3d_art') {
          embed = new EmbedBuilder()
            .setTitle('〚🧱〛 3D Art & Asset Production')
            .setDescription('I create 3D assets adapted for in-game use, prioritizing cleanliness, optimization, and visual coherence. The goal: provide mastered, efficient, and easy-to-integrate models for any project.')
            .addFields({
              name: 'What I do:',
              value: '• Low/Mid Poly modeling adapted to Roblox constraints\n• Creation of props, environmental elements, accessories, weapons, structures\n• Light sculpting to give character to shapes without overloading the scene\n• Manual optimization: polycount reduction, duplicate removal, clean geometry\n• Logical UV Unwrapping: clear organization, clean cuts, priority to critical surfaces\n• Creation of stylized or semi-realistic materials and textures\n• Mastery of shading concepts, normal maps, roughness, AO, and volume reading\n• Asset preparation for perfect integration (scale, pivot, orientation, hierarchy)\n• Design of rigging/animation-compatible models when necessary\n• Clean and standardized export, ready for project technical pipelines',
              inline: false
            })
            .setColor(0x5865F2)
            .setFooter({ text: 'Kentiq Universe • Skills' })
            .setTimestamp();
        } else if (selectedValue === 'leadership') {
          embed = new EmbedBuilder()
            .setTitle('〚🧭〛 Technical Leadership & Project Engineering')
            .setDescription('I bring an overall technical vision to a project: how it should be structured, how modules should communicate, and how to maintain solid coherence from start to finish. The goal is to avoid chaos, reduce risks, and guarantee smooth development.')
            .addFields(
              {
                name: 'What I do:',
                value: '• Definition of global architecture: repo organization, conventions, logical flows\n• Setup of technical rules: nomenclature, folder structure, code standards\n• Construction of internal design patterns: services, managers, modules, data flows\n• Organization of a coherent ecosystem between: UI, gameplay, systems, backend, data\n• Analysis of an existing project to detect: technical debt, redundancies, inconsistencies\n• Creation of integration plans: how each module properly integrates with others\n• Clear documentation: internal APIs, modules, data formats, usage rules\n• Definition of clean pipelines: how to produce, integrate, test, and deliver efficiently\n• Technical onboarding assistance: clarifying the project approach for other developers\n• Silent technical coordination: ensuring all components follow the same logic',
                inline: false
              },
              {
                name: 'Why it\'s important:',
                value: 'A good project doesn\'t hold together just with code that "works".\nIt holds together thanks to a readable, predictable, and stable architecture.\n\nI make sure the project is easy to develop today,\nand even easier to extend in 3 months.',
                inline: false
              }
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'Kentiq Universe • Skills' })
            .setTimestamp();
        } else {
          // Valeur non reconnue
          await interaction.message.edit({ components: [] }).catch(() => {});

          await interaction.editReply({
            content: '❌ Unknown skill selected.'
          }).catch(() => {});

          return;
        }

        // Si on a un embed, envoyer en DM
        if (embed) {
          console.log('[SKILL] Embed created, removing menu components...');

          // Retirer le menu déroulant du message d'origine
          await interaction.message.edit({ components: [] }).catch((e) => {
            console.error('[SKILL] Failed to edit original message:', e);
          });

          try {
            console.log('[SKILL] Attempting to send DM to user:', interaction.user.tag);

            // Envoyer l'embed en DM
            await interaction.user.send({ embeds: [embed] });

            console.log('[SKILL] DM sent successfully');

            // Confirmer que le DM a été envoyé (épinglé à la réponse éphémère)
            await interaction.editReply({
              content: '✅ Check your DM!'
            });

            console.log('[SKILL] Confirmation reply sent');
          } catch (dmError) {
            console.error('[SKILL] DM error:', dmError);

            // Fallback UX : si les DMs sont désactivés, envoyer l'embed directement dans le salon (éphémère)
            await interaction.editReply({
              content: 'I couldn\'t DM you, so here are the details directly here:',
              embeds: [embed]
            });

            console.log('[SKILL] DM error reply sent with in-channel fallback');
          }
        } else {
          console.warn('[SKILL] No embed created for selection:', selectedValue);

          await interaction.editReply({
            content: '❌ No skill details available for this selection.'
          }).catch(() => {});
        }
      } catch (error) {
        console.error('[ERROR] Error in skill select menu:', error);
        console.error('[ERROR] Error stack:', error.stack);

        try {
          await interaction.editReply({
            content: '❌ An error occurred while processing your selection.'
          }).catch(() => {});
        } catch (err) {
          console.error('[ERROR] Failed to send error reply for skill menu:', err);
        }
      }
    }
  }

  // --- /finish ---
  if (interaction.commandName === 'finish') {
    try {
      const embed = new EmbedBuilder()
        .setTitle('〚✨〛 One developer. Your entire game, from A to Z.')
        .setColor(0x5865F2)
        .setFooter({ text: 'Kentiq Universe' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: 0 });
    } catch (error) {
      console.error('[ERROR] Error in /finish:', error);
      const errorReply = { content: '❌ An error occurred while processing this command.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /credits ---
  if (interaction.commandName === 'credits') {
    try {
      const userId = interaction.user.id;
      const record = kCredits[userId] || { invites: 0, kcredits: 0, tierId: null };

      const tier = getTierForInvites(record.invites || 0);
      const multiplier = tier?.multiplier ?? 1.0;

      const embed = new EmbedBuilder()
        .setTitle('〚₭〛 K-Credits — Invite Profile')
        .setDescription('Current status of your invite contributions and K-Credits inside **Kentiq Universe**.')
        .addFields(
          {
            name: 'Valid invites',
            value: `\`${record.invites || 0}\``,
            inline: true
          },
          {
            name: 'K-Credits balance',
            value: `\`${(record.kcredits || 0).toFixed(2)} ₭\``,
            inline: true
          },
          {
            name: 'Tier',
            value: tier ? `${tier.name} (x${multiplier.toFixed(2)})` : 'No Tier reached yet.',
            inline: false
          }
        )
        .setColor(0x00bcd4)
        .setFooter({ text: 'Kentiq Universe • Invite Program' })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('[ERROR] Error in /credits:', error);

      const errorReply = {
        content: '❌ An error occurred while retrieving your credits.',
        flags: MessageFlags.Ephemeral
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /setup-access ---
  if (interaction.commandName === 'setup-access') {
    const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      return interaction.reply({
        content: '❌ You must be an administrator to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      const embed = new EmbedBuilder()
        .setTitle('〚✅〛 Welcome Acknowledgement')
        .setDescription(
          'By confirming this, you acknowledge that you have read and understood the welcome information and rules.\n\n' +
          'Click the button below to unlock member access to the server.'
        )
        .setColor(0x5865F2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('welcome_access_confirm')
          .setLabel('I have read and understood')
          .setEmoji('<a:Check:926902236691460126>')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row]
      });
    } catch (error) {
      console.error('[ERROR] Error in /setup-access:', error);

      const errorReply = {
        content: '❌ An error occurred while creating the access panel.',
        flags: MessageFlags.Ephemeral
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // --- /setup-invite-program ---
  if (interaction.commandName === 'setup-invite-program') {
    const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      return interaction.reply({
        content: '❌ You must be an administrator to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      const embed = new EmbedBuilder()
        .setTitle('〚₭〛 Kentiq Invite Program — V1')
        .setDescription(
          'Kentiq Universe rewards members who help the ecosystem grow in a **clean, long-term, premium** way.\n\n' +
          '**How it works:**\n' +
          '• Each **valid invite** → generates **K-Credits** (internal currency)\n' +
          '• Your **total invites** → determine your **corporate Tier**\n' +
          '• Your **Tier** → applies a multiplier on future K-Credits\n'
        )
        .addFields(
          {
            name: 'Tiers (cumulative invites)',
            value:
              '• 〚I〛   Associate      → 2 invites (x1.00)\n' +
              '• 〚II〛  Contributor    → 5 invites (x1.00)\n' +
              '• 〚III〛 Advocate      → 10 invites (x1.05)\n' +
              '• 〚IV〛  Partner        → 15 invites (x1.07)\n' +
              '• 〚V〛   Senior Partner → 20 invites (x1.10)\n' +
              '• 〚VI〛  Ambassador     → 30 invites (x1.12)\n' +
              '• 〚VII〛 Strategist    → 40 invites (x1.15)\n' +
              '• 〚VIII〛Executive    → 55 invites (x1.18)\n' +
              '• 〚IX〛  Director       → 75 invites (x1.20)\n' +
              '• 〚X〛   Architect      → 100 invites (x1.25)',
            inline: false
          },
          {
            name: 'Usage',
            value:
              '• Invites stay a **social metric** (prestige, Tiers)\n' +
              '• K-Credits are the **internal currency** used in the K‑Shop (services, access, perks)\n' +
              '• You can check your profile with `/credits` (invites, K-Credits, Tier)\n' +
              '• For now, run `/credits` in DM with the bot — a dedicated public channel will be added later for program stats',
            inline: false
          },
          {
            name: 'Anti-abuse rules (excerpt)',
            value:
              '• No fake accounts, no alts\n' +
              '• No invites via spam or mass DM\n' +
              '• Invalid or fraudulent invites do not count\n' +
              '• Authenticity checks are performed regularly to guarantee fair chances for everyone\n' +
              '• Kentiq reserves the right to adjust invites and Tiers in case of abuse',
            inline: false
          }
        )
        .setColor(0x00bcd4)
        .setFooter({ text: 'Kentiq Universe • Invite Program V1' })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed]
      });
    } catch (error) {
      console.error('[ERROR] Error in /setup-invite-program:', error);

      const errorReply = {
        content: '❌ An error occurred while creating the invite program panel.',
        flags: MessageFlags.Ephemeral
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }
  } catch (error) {
    console.error('[ERROR] Unhandled error in interactionCreate:', error);
    // Essayer de répondre à l'interaction si elle n'a pas encore été répondue
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ 
          content: '❌ An unexpected error occurred.', 
          flags: MessageFlags.Ephemeral 
        }).catch(() => {});
      } catch (err) {
        console.error('[ERROR] Failed to send error response:', err);
      }
    }
  }
});

// Vérification des variables d'environnement requises
if (!process.env.DISCORD_TOKEN) {
  console.error('[ERROR] DISCORD_TOKEN missing in .env file');
  process.exit(1);
}

// Vérifier que le token n'est pas exposé dans les variables d'environnement
if (process.env.DISCORD_TOKEN.length < 50) {
  console.error('[ERROR] Invalid Discord token (too short). Check your .env file');
  process.exit(1);
}

// Note: Vérification du token dans le code source retirée pour éviter les problèmes de performance
// Assurez-vous de ne JAMAIS commiter votre fichier .env ou votre token dans le code

client.login(process.env.DISCORD_TOKEN).catch(error => {
  const safeError = error.message ? sanitizeLogMessage(error.message) : error;
  console.error('[ERROR] Login error:', safeError);
  process.exit(1);
});
