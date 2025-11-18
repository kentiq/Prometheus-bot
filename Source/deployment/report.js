// Source/deployment/report.js
const { sendDeployUpdate } = require("../webhooks/deploy-monitor");

module.exports = {
  /**
   * Envoie un message de pipeline standard
   * @param {String} step - Étape de la pipeline ("start", "pull", "build", "reload", "done", "fail")
   * @param {Boolean} success - Statut de l’étape
   * @param {Object} extra - Données optionnelles
   */
  deploymentEvent: async (step, success = true, extra = {}) => {
    const colors = {
      ok: 0x57F287,
      warn: 0xFAA61A,
      error: 0xED4245,
      info: 0x5865F2
    };

    const messages = {
      start: "🔍 Détection du commit et déclenchement de la pipeline.",
      pull: "📥 Récupération du code depuis le repository…",
      build: "⚙️ Installation des dépendances / Build…",
      reload: "🔄 Reload de Prometheus via PM2…",
      done: "✅ Pipeline complétée avec succès.",
      fail: "❌ Une erreur est survenue durant le déploiement."
    };

    const titles = {
      start: "Pipeline Started",
      pull: "Pull in Progress",
      build: "Build in Progress",
      reload: "Reloading Service",
      done: "Deployment Successful",
      fail: "Deployment Failed"
    };

    // Champs additionnels optionnels
    const fields = [];

    if (extra.commit) {
      fields.push({
        name: "Commit",
        value: `\`${extra.commit}\``,
        inline: true
      });
    }

    if (extra.author) {
      fields.push({
        name: "Auteur",
        value: extra.author,
        inline: true
      });
    }

    if (extra.duration) {
      fields.push({
        name: "Durée",
        value: extra.duration,
        inline: true
      });
    }

    await sendDeployUpdate({
      title: `🚀 ${titles[step] || "Deployment Event"}`,
      description: messages[step] || "Étape inconnue.",
      color: success ? colors.info : colors.error,
      fields
    });
  }
};
