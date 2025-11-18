# 🧠 Prometheus Bot

Bot Discord autonome conçu pour archiver, présenter et transmettre des artefacts numériques.

## 📋 Fonctionnalités

### Commandes disponibles

#### 📦 Archives
- **`/present`** — Présente un asset depuis les archives Prometheus
- **`/work`** — Affiche une collaboration avec une équipe externe
- **`/client`** — Présente un client et son travail

#### 🔍 Recherche & Liste
- **`/list-assets`** — Liste tous les assets disponibles
- **`/list-clients`** — Liste tous les clients enregistrés
- **`/list-collabs`** — Liste toutes les collaborations
- **`/search`** — Recherche dans les archives (assets, clients, collaborations)

#### ℹ️ Informations
- **`/identity`** — Affiche l'identité et le but de Prometheus
- **`/channel`** — Présente un canal de l'écosystème
- **`/whois`** — Affiche la carte de présentation d'une personne
- **`/ping`** — Vérifie la latence du bot
- **`/help`** — Affiche la liste de toutes les commandes
- **`/stats`** — Affiche les statistiques du bot et du serveur

#### 🎫 Tickets
- **`/setup-tickets`** — Configure le système de tickets et envoie le panneau de contrôle

#### ⚙️ Administration
- **`/pricing`** — Affiche les informations sur les services et tarifs
- **`/com`** — Définit le statut des commissions (Open/Closed)
- **`/reload`** — Recharge les fichiers JSON sans redémarrer (Admin uniquement)
- **`/backup`** — Crée une sauvegarde de tous les fichiers JSON (Admin uniquement)
- **`/warning`** — Avertit le canal de l'arrivée imminente d'assets

### Système de tickets

Le bot inclut un système complet de gestion de tickets avec :
- Création de tickets privés
- Fermeture avec confirmation
- Génération automatique de transcriptions HTML
- Logs dans un canal dédié

## 🔧 Deployment Monitoring

The bot includes a deployment reporting system accessible through:
- `Source/webhooks/deploy-monitor.js`
- `Source/deployment/report.js`

These modules allow CI/CD pipelines to send status messages to Discord using `DEPLOY_WEBHOOK_URL`.

## 🚀 Installation

1. **Cloner le repository**
```bash
git clone https://github.com/votre-repo/prometheus-bot.git
cd prometheus-bot
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les variables d'environnement**
```bash
cp .env.example .env
```

Puis éditez le fichier `.env` et remplissez les valeurs :
- `DISCORD_TOKEN` — Token de votre bot Discord
- `CLIENT_ID` — ID de votre application Discord
- `GUILD_ID` — ID de votre serveur Discord

4. **Déployer les commandes**
```bash
npm run deploy
```

5. **Démarrer le bot**
```bash
npm start
```

Pour le développement avec rechargement automatique :
```bash
npm run dev
```

## 📁 Structure des fichiers

- **`index.js`** — Fichier principal du bot
- **`deploy-commands.js`** — Script de déploiement des commandes slash
- **`assets.json`** — Archive des assets numériques
- **`workwith.json`** — Collaborations avec équipes externes
- **`clients.json`** — Informations sur les clients
- **`identities.json`** — Identités des personnes
- **`channels.json`** — Configuration des canaux
- **`tickets.json`** — Configuration du système de tickets (généré automatiquement)

## 🔧 Dépendances

- **discord.js** (^14.18.0) — Bibliothèque Discord.js
- **discord-html-transcripts** (^3.2.0) — Génération de transcriptions HTML
- **dotenv** (^16.5.0) — Gestion des variables d'environnement
- **axios** (^1.7.9) — Client HTTP pour les webhooks de déploiement

## 📝 Notes

- Le bot nécessite les permissions suivantes :
  - Lire les messages
  - Envoyer des messages
  - Gérer les messages
  - Gérer les salons
  - Créer des salons
  - Joindre des fichiers

## 🔒 Sécurité

Voir le fichier [SECURITY.md](SECURITY.md) pour un guide complet sur la sécurité du bot.

**Protections implémentées :**
- ✅ Rate limiting (10 commandes/minute par utilisateur)
- ✅ Masquage automatique des tokens dans les logs
- ✅ Vérification stricte des permissions admin
- ✅ Protection contre les injections
- ✅ Validation du token au démarrage

**Bonnes pratiques :**
- ✅ Token dans `.env` (non commité)
- ✅ A2F activé sur votre compte Discord
- ✅ Permissions minimales nécessaires
- ✅ Commandes admin protégées

- Les fichiers JSON doivent être valides. Le bot affichera des avertissements si des fichiers sont manquants ou invalides.

## 🐛 Gestion des erreurs

Le bot inclut :
- Validation des fichiers JSON au démarrage
- Gestion d'erreurs globale pour les erreurs non capturées
- Reconnexion automatique en cas de déconnexion
- Logs détaillés pour le débogage

## 📄 Licence

ISC

## 👤 Auteur

Kentiq
