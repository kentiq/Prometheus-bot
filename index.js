// ✅ index.js — English-only public presentation with collab & warning system
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const assets  = JSON.parse(fs.readFileSync('assets.json'));
const collabs = JSON.parse(fs.readFileSync('workwith.json'));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] }); // Ajout de GatewayIntentBits.GuildMembers

client.once('ready', async () => { // Rendre la fonction ready asynchrone
  console.log(`🧠 PROMETHEUS active and ready to transmit digital artifacts.`);

  // Récupérer les membres de tous les serveurs où le bot est présent
  try {
    console.log('Fetching members from guilds...');
    const guilds = client.guilds.cache;
    let allMembersData = [];

    for (const guild of guilds.values()) {
      // S'assurer que le bot peut accéder aux membres du serveur
      // Parfois, il faut explicitement fetch le guild pour avoir toutes les infos à jour
      const fullGuild = await client.guilds.fetch(guild.id);
      const members = await fullGuild.members.fetch(); // Récupère tous les membres du serveur

      members.forEach(member => {
        allMembersData.push({
          id: member.id, // ID de l'utilisateur Discord
          username: member.user.username,
          discriminator: member.user.discriminator, // Le #xxxx après le nom d'utilisateur
          displayName: member.displayName, // Surnom sur le serveur
          avatarURL: member.user.displayAvatarURL(), // URL de l'avatar
          roles: member.roles.cache.map(role => ({ id: role.id, name: role.name, color: role.hexColor })),
          joinedTimestamp: member.joinedTimestamp, // Quand l'utilisateur a rejoint le serveur
          bot: member.user.bot // Si c'est un bot
        });
      });
    }

    fs.writeFileSync('players.json', JSON.stringify(allMembersData, null, 2), 'utf8');
    console.log(`Successfully wrote ${allMembersData.length} members to players.json`);

  } catch (error) {
    console.error('Error fetching members or writing to players.json:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

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

      await interaction.editReply({ embeds: [embed], files });
    } catch (error) {
      console.error('[ERROR] Error in /present:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
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
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
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
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
      }
    }
  }

  // --- /identity ---
  if (interaction.commandName === 'identity') {
    await interaction.reply({
      content: '```ini\n[ SYSTEM BOOT SEQUENCE INITIALIZED ]\n> Loading memory core...\n```'
    });
    // … ta séquence identity inchangée …
  }
});

client.login(process.env.DISCORD_TOKEN);
