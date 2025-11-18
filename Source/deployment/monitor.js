// Source/deployment/monitor.js
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MESSAGE_ID_FILE = path.join(__dirname, '..', '..', 'Configuration', 'deploy-message.json');

/**
 * Gestion des messages de déploiement en temps réel
 */
class DeploymentMonitor {
  constructor(client) {
    this.client = client;
    this.message = null;
    this.channelId = process.env.MONITOR_CHANNEL;
    this.loadMessageId();
  }

  /**
   * Charge le message ID depuis le fichier
   */
  loadMessageId() {
    try {
      if (fs.existsSync(MESSAGE_ID_FILE)) {
        const data = JSON.parse(fs.readFileSync(MESSAGE_ID_FILE, 'utf8'));
        if (data.messageId && data.channelId) {
          this.savedMessageId = data.messageId;
          this.savedChannelId = data.channelId;
        }
      }
    } catch (error) {
      console.warn('[DeployMonitor] Could not load saved message ID:', error.message);
    }
  }

  /**
   * Sauvegarde le message ID dans un fichier
   */
  saveMessageId(messageId, channelId) {
    try {
      const data = { messageId, channelId, timestamp: Date.now() };
      fs.writeFileSync(MESSAGE_ID_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[DeployMonitor] Could not save message ID:', error.message);
    }
  }

  /**
   * Récupère le message depuis Discord ou depuis le fichier sauvegardé
   */
  async getMessage() {
    // Si on a déjà le message en mémoire, l'utiliser
    if (this.message) {
      return this.message;
    }

    // Sinon, essayer de le récupérer depuis Discord
    if (this.savedMessageId && this.savedChannelId) {
      try {
        const channel = await this.client.channels.fetch(this.savedChannelId);
        if (channel) {
          this.message = await channel.messages.fetch(this.savedMessageId);
          return this.message;
        }
      } catch (error) {
        console.warn('[DeployMonitor] Could not fetch saved message:', error.message);
        // Si le message n'existe plus, nettoyer le fichier
        if (fs.existsSync(MESSAGE_ID_FILE)) {
          fs.unlinkSync(MESSAGE_ID_FILE);
        }
      }
    }

    return null;
  }

  /**
   * Initialise le déploiement et crée le message initial
   * @param {String} commit - Hash du commit
   * @returns {Promise<void>}
   */
  async startDeployment(commit) {
    try {
      if (!this.channelId) {
        console.error('[DeployMonitor] MONITOR_CHANNEL is missing in .env');
        return;
      }

      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        console.error(`[DeployMonitor] Channel ${this.channelId} not found`);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔵 Deployment detected')
        .setDescription('Initialisation du déploiement…')
        .addFields({
          name: 'Commit',
          value: `\`${commit || 'N/A'}\``,
          inline: true
        })
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({ text: 'Prometheus Bot • Deployment Monitor' });

      this.message = await channel.send({ embeds: [embed] });
      this.saveMessageId(this.message.id, channel.id);
      console.log(`[DeployMonitor] Deployment started for commit: ${commit}`);
    } catch (error) {
      console.error('[DeployMonitor] Error starting deployment:', error);
    }
  }

  /**
   * Met à jour le stage actuel du déploiement
   * @param {String} title - Titre du stage
   * @param {Number} color - Couleur de l'embed (hex)
   * @param {String} description - Description optionnelle
   * @returns {Promise<void>}
   */
  async updateStage(title, color = 0x5865F2, description = null) {
    try {
      const message = await this.getMessage();
      if (!message) {
        console.warn('[DeployMonitor] No message to update');
        return;
      }

      // Récupérer l'embed existant ou créer un nouveau
      const existingEmbed = message.embeds[0];
      const embed = existingEmbed ? EmbedBuilder.from(existingEmbed) : new EmbedBuilder();
      
      // Préserver les champs existants (comme le commit hash)
      const existingFields = existingEmbed?.fields || [];
      
      embed.setTitle(title);
      if (description) {
        embed.setDescription(description);
      }
      embed.setColor(color);
      embed.setTimestamp();
      
      // Réappliquer les champs existants
      if (existingFields.length > 0) {
        embed.setFields(existingFields);
      }

      await message.edit({ embeds: [embed] });
      this.message = message; // Mettre à jour la référence
      console.log(`[DeployMonitor] Stage updated: ${title}`);
    } catch (error) {
      console.error('[DeployMonitor] Error updating stage:', error);
    }
  }

  /**
   * Marque le déploiement comme réussi
   * @returns {Promise<void>}
   */
  async deploymentSuccess() {
    try {
      const message = await this.getMessage();
      if (!message) {
        console.warn('[DeployMonitor] No message to update');
        return;
      }

      const embed = EmbedBuilder.from(message.embeds[0])
        .setTitle('🟩 Deployment Success')
        .setDescription('Le bot a été mis à jour et PM2 s\'est rechargé correctement.')
        .setColor(0x57F287)
        .setTimestamp();

      await message.edit({ embeds: [embed] });
      this.message = message; // Mettre à jour la référence
      console.log('[DeployMonitor] Deployment marked as successful');
    } catch (error) {
      console.error('[DeployMonitor] Error marking deployment success:', error);
    }
  }

  /**
   * Marque le déploiement comme échoué
   * @param {String} commit - Hash du commit
   * @param {String} errorMessage - Message d'erreur optionnel
   * @returns {Promise<void>}
   */
  async deploymentFail(commit, errorMessage = null) {
    try {
      const message = await this.getMessage();
      if (!message) {
        console.warn('[DeployMonitor] No message to update');
        return;
      }

      const existingEmbed = message.embeds[0];
      const embed = existingEmbed ? EmbedBuilder.from(existingEmbed) : new EmbedBuilder();
      
      embed.setTitle('❌ Deployment Failed')
        .setDescription(errorMessage || 'Une erreur est survenue pendant le déploiement.')
        .setColor(0xED4245)
        .setTimestamp();

      // Préserver ou ajouter le commit hash
      const existingFields = existingEmbed?.fields || [];
      const commitField = existingFields.find(f => f.name === 'Commit');
      
      if (commit && !commitField) {
        embed.addFields({
          name: 'Commit',
          value: `\`${commit}\``,
          inline: true
        });
      } else if (existingFields.length > 0) {
        embed.setFields(existingFields);
      }

      await message.edit({ embeds: [embed] });
      this.message = message; // Mettre à jour la référence
      console.log(`[DeployMonitor] Deployment marked as failed for commit: ${commit}`);
    } catch (error) {
      console.error('[DeployMonitor] Error marking deployment failure:', error);
    }
  }
}

module.exports = DeploymentMonitor;

