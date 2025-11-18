// Source/webhooks/deploy-monitor.js
const axios = require("axios");
require("dotenv").config();

module.exports = {
  /**
   * Envoie un embed Discord formaté pour le monitoring
   * @param {Object} payload
   * @param {String} payload.title
   * @param {String} payload.description
   * @param {Number} payload.color
   * @param {Array}  payload.fields
   */
  sendDeployUpdate: async ({
    title,
    description,
    color = 0x5865F2,
    fields = []
  }) => {
    try {
      const webhook = process.env.DEPLOY_WEBHOOK_URL;
      if (!webhook) {
        console.error("[DeployMonitor] DEPLOY_WEBHOOK_URL is missing in .env");
        return;
      }

      await axios.post(
        webhook,
        {
          username: "Prometheus • Deploy Monitor",
          avatar_url: "https://i.imgur.com/Ju8D0NQ.png",
          embeds: [
            {
              title,
              description,
              color,
              fields,
              timestamp: new Date().toISOString(),
              footer: {
                text: "Prometheus Bot • Production Deployment"
              }
            }
          ]
        },
        {
          timeout: 5000,
          headers: { "Content-Type": "application/json" }
        }
      );

      console.log(`[DeployMonitor] Sent: ${title}`);
    } catch (err) {
      if (err.code === "ECONNABORTED") {
        console.error("[DeployMonitor] Request timeout");
      } else if (err.response) {
        console.error(
          `[DeployMonitor] HTTP error ${err.response.status}: ${err.response.statusText}`
        );
      } else if (err.request) {
        console.error("[DeployMonitor] No response received");
      } else {
        console.error("[DeployMonitor] Error:", err.message);
      }

      throw err;
    }
  }
};
