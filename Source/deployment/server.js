// Source/deployment/server.js
const express = require('express');
const DeploymentMonitor = require('./monitor');

/**
 * Démarre le serveur HTTP interne pour recevoir les notifications de déploiement
 * @param {Client} client - Instance du client Discord.js
 */
function startDeploymentServer(client) {
  const app = express();
  const monitor = new DeploymentMonitor(client);

  // Middleware pour parser le JSON
  app.use(express.json());

  // Endpoint pour démarrer un déploiement
  app.post('/deploy', async (req, res) => {
    try {
      const commit = req.body.commit || req.body.sha || 'unknown';
      
      console.log(`[DeployServer] Received /deploy request for commit: ${commit}`);
      
      // Répondre immédiatement pour éviter les timeouts
      res.status(200).json({ status: 'ok', message: 'Deployment started' });

      // Démarrer le déploiement
      await monitor.startDeployment(commit);
      console.log('[DeployServer] Deployment started, message should be created');

      // Simuler les étapes avec des délais
      setTimeout(async () => {
        try {
          await monitor.updateStage('📥 Pulling repository…', 0x3498db);
        } catch (err) {
          console.error('[DeployServer] Error updating stage (pull):', err.message);
        }
      }, 1000);

      setTimeout(async () => {
        try {
          await monitor.updateStage('⚙️ Installation des dépendances…', 0xFAA61A);
        } catch (err) {
          console.error('[DeployServer] Error updating stage (build):', err.message);
        }
      }, 2000);

      setTimeout(async () => {
        try {
          await monitor.updateStage('🔄 Reload de PM2…', 0x9B59B6);
        } catch (err) {
          console.error('[DeployServer] Error updating stage (reload):', err.message);
        }
      }, 3000);
    } catch (error) {
      console.error('[DeployServer] Error in /deploy:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // Endpoint pour marquer le déploiement comme réussi
  app.post('/deploy/success', async (req, res) => {
    try {
      console.log('[DeployServer] Received /deploy/success request');
      res.status(200).json({ status: 'ok', message: 'Deployment success recorded' });
      await monitor.deploymentSuccess();
      console.log('[DeployServer] Success notification sent');
    } catch (error) {
      console.error('[DeployServer] Error in /deploy/success:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // Endpoint pour marquer le déploiement comme échoué
  app.post('/deploy/fail', async (req, res) => {
    try {
      const commit = req.body.commit || req.body.sha || 'unknown';
      const errorMessage = req.body.error || req.body.message || null;
      
      res.status(200).json({ status: 'ok', message: 'Deployment failure recorded' });
      await monitor.deploymentFail(commit, errorMessage);
    } catch (error) {
      console.error('[DeployServer] Error in /deploy/fail:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // Endpoint de santé pour vérifier que le serveur fonctionne
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'deployment-monitor' });
  });

  // Démarrer le serveur sur le port 3030
  const PORT = 3030;
  const HOST = '0.0.0.0'; // Écouter sur toutes les interfaces
  
  const server = app.listen(PORT, HOST, () => {
    console.log(`[DeployMonitor] Internal listener active on port ${PORT}`);
    console.log(`[DeployMonitor] Server listening on http://${HOST}:${PORT}`);
  });

  // Gestion des erreurs du serveur
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[DeployServer] Port ${PORT} is already in use`);
    } else {
      console.error('[DeployServer] Server error:', error);
    }
  });

  // Stocker le serveur dans le client pour pouvoir l'arrêter si nécessaire
  client.deploymentServer = server;
}

module.exports = startDeploymentServer;

