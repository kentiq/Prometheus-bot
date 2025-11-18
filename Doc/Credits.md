Voici **un petit `.md` propre, compact, prêt à modifier**, qui pose toute la base du système :
Tiers, K-Credits, multiplicateurs, mécanique, principes.
Tu peux l’éditer, couper, étendre comme tu veux.

---

# **Kentiq Universe — Invite Program (V1 Draft)**

*(Draft compact — à éditer par Kentiq)*

## **1. Vision générale**

Le Invite Program est conçu pour :

* stimuler la croissance organique du serveur
* récompenser l’apport réel d’utilisateurs
* introduire une économique interne (K-Crédits)
* créer une hiérarchie corporate premium (Tiers I → X)
* préparer la K-Shop (boutique interne)

Le système doit rester simple en V1 tout en reflétant l’identité “Kentiq Universe”.

---

## **2. K-Crédits**

Une K-Crédit est une unité interne permettant d’acheter produits/services dans la K-Shop.

### **Génération**

* **1 invite valide = 1 K-Crédit**
* Les invites sont validées selon conditions anti-abus (voir section 6).

### **Multiplicateurs (selon Tier)**

Le multiplicateur s’applique **sur les gains futurs uniquement**.

| Tier | Nom            | Multiplier |
| ---- | -------------- | ---------- |
| I    | Associate      | x1.00      |
| II   | Contributor    | x1.00      |
| III  | Advocate       | x1.05      |
| IV   | Partner        | x1.07      |
| V    | Senior Partner | x1.10      |
| VI   | Ambassador     | x1.12      |
| VII  | Strategist     | x1.15      |
| VIII | Executive      | x1.18      |
| IX   | Director       | x1.20      |
| X    | Architect      | x1.25      |

---

## **3. Tiers (Structure Corporate Kentiqunisée)**

Les Tiers sont basés sur le **nombre total d’invites cumulées**.
Ils donnent prestige + avantages structurels (accès, priorités, fonctionnalités).

| Tier | Nom Corporate  | Invites Requises | IDENTIFIANT ROLE
| ---- | -------------- | ---------------- |
| I    | Associate      | 2                | 1440037431637442610
| II   | Contributor    | 5                | 1385399362074443818
| III  | Advocate       | 10               | 1440029683365449738
| IV   | Partner        | 15               | 1440194247285543023
| V    | Senior Partner | 20               | 1440194273512521778
| VI   | Ambassador     | 30               | 1440471221975126167
| VII  | Strategist     | 40               | 1440471348089458791
| VIII | Executive      | 55               | 1440471353575866423
| IX   | Director       | 75               | 1440471354544750643
| X    | Architect      | 100              | 1440471355165380698

Les Tiers **n’octroient pas de K-Crédits directs**, seulement leur multiplicateur + des avantages.

---

## **4. Avantages liés aux Tiers (Draft simple V1)**

On affiche que pour le moment un Embed qui s'édite en live selon la configuration qu'on le met sur le JSON (!)

## **5. K-Shop (Base)**

Boutique interne accessible via le bot.

### **Commandes envisagées**

* `/shop` → afficher les items
* `/shop buy <item>` → acheter
* `/credits` → consulter son solde
* `/shop history` → historique
* `/shop admin [...]` → gestion

### **Item (structure JSON draft)**

```json
{
  "id": "micro_audit",
  "name": "Micro-Audit (10min)",
  "price": 120,
  "type": "service",
  "stock": -1,
  "roleReward": null
}
```

*(Tu adapteras selon produits/services que tu veux offrir.)*

---

## **6. Règles anti-abus**

Une invite valide doit respecter :

* compte Discord créé depuis **> 7 jours**
* membre reste **> 48h**
* pas de leave/rejoin rapide
* pas d’alts
* pas d’invites auto-générées
* recalcul en cas de fraude détectée

Les invites non valides → **ne comptent pas**.

---

## **7. Fonctionnement interne du bot**

* Suivi des invites (Discord API)
* Ajout automatique de K-Crédits selon multiplicateur du Tier
* Vérification si un nouveau Tier est atteint
* Attribution automatique des rôles Tiers
* Mise à jour du portefeuille K-Crédits
* Logs internes pour audit
* Système d’achat en boutique
* Rôles, accès, tickets automatiques selon item acheté

---

## **8. Objectifs V1**

* Système fonctionnel et stable
* Tiers opérationnels
* Multiplicateurs actifs
* Boutique avec 3 à 5 items max
* Rôles automatiques
* Embeds simples pour présentation
* Logs propres

Extensions prévues en V2-V3 :

* K-Vault complet
* Items avancés
* Badges visuels premium
* Stats publiques
* Leaderboard
* Animations visuelles Bot → DM

---



Clarification officielle — Multiplicateur Tiers
1) Le multiplicateur NE multiplie PAS les invitations.

Sinon :

les Tiers élevés deviendraient trop simples à atteindre

effet boule-de-neige incontrôlable

inflation → la boutique perd toute valeur

la hiérarchie perd sa fonction de prestige

Architect devient banal, ce qui ruine ton identité premium

Donc on évite ça.

2) Le multiplicateur multiplie UNIQUEMENT les K-Crédits gagnés.

Exemple :
Un membre Architect (x1.25) invite 1 personne valide.

Invitations cumulées : +1

K-Crédits : 1 × 1.25 = 1.25 K-Crédits

Les invites restent une métrique brute, immuable, utilisée uniquement pour :

monter les Tiers

conserver le prestige

garder la progression stable

empêcher la corruption du système

Les K-Crédits deviennent une monnaie économique,
et les Tiers une monnaie sociale / hiérarchique.

---

## **9. Avancement V1 (bot)**

- ✅ Tracking des invitations valides et incrément de K-Crédits (stockés en JSON)
- ✅ Commande `/credits` (réponse éphémère) pour consulter :
  - invites cumulées
  - solde de K-Crédits
  - Tier actuel + multiplicateur
- ✅ Commande admin `/setup-invite-program` pour envoyer le panneau d’explication dans `#invite-program`
- ⏳ Attribution automatique des rôles de Tier (Associate → Architect)
- ⏳ Intégration de la K‑Shop (3 à 5 items de base) + commandes `/shop`
- ⏳ Leaderboard / affichage public des meilleurs contributeurs

*(Cette section est là pour suivre l’implémentation côté bot. À mettre à jour au fur et à mesure.)*