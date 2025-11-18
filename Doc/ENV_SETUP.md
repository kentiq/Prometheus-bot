# Configuration des variables d'environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
GUILD_ID=your_discord_guild_id_here

# Deployment Monitoring (Optional)
DEPLOY_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_url_here
MONITOR_CHANNEL=your_monitor_channel_id_here
```

## Comment obtenir ces valeurs

### DISCORD_TOKEN
1. Allez sur https://discord.com/developers/applications
2. Sélectionnez votre application (ou créez-en une nouvelle)
3. Allez dans l'onglet "Bot"
4. Cliquez sur "Reset Token" ou "Copy" pour obtenir le token
5. Copiez le token dans votre fichier `.env`

### CLIENT_ID
1. Dans le même panneau Discord Developer Portal
2. Allez dans l'onglet "General Information"
3. Copiez l'Application ID
4. Collez-le dans votre fichier `.env` comme CLIENT_ID

### GUILD_ID
1. Activez le mode développeur dans Discord (Paramètres > Avancé > Mode développeur)
2. Faites un clic droit sur votre serveur Discord
3. Cliquez sur "Copier l'ID"
4. Collez-le dans votre fichier `.env` comme GUILD_ID

### MONITOR_CHANNEL (Optionnel)
1. Activez le mode développeur dans Discord (Paramètres > Avancé > Mode développeur)
2. Faites un clic droit sur le canal où vous voulez recevoir les notifications de déploiement
3. Cliquez sur "Copier l'ID"
4. Collez-le dans votre fichier `.env` comme MONITOR_CHANNEL

## Important

⚠️ **Ne partagez jamais votre fichier `.env`** - il contient des informations sensibles !
Le fichier `.env` est déjà dans le `.gitignore` pour éviter qu'il soit commité par erreur.

