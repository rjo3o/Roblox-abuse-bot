const {
  Client, GatewayIntentBits, EmbedBuilder,
  SlashCommandBuilder, REST, Routes,
  ButtonBuilder, ButtonStyle, ActionRowBuilder
} = require('discord.js');
if (process.env.NODE_ENV !== 'production') { try { require('dotenv').config(); } catch(e) {} }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
});

const DISCORD_TOKEN    = process.env.DISCORD_TOKEN;
const CLIENT_ID        = process.env.CLIENT_ID;
const GUILD_ID         = process.env.GUILD_ID;
const ABUSE_CHANNEL_ID = process.env.ABUSE_CHANNEL_ID;
const ROBLOX_PLACE_ID  = process.env.ROBLOX_PLACE_ID;
const ALLOWED_ROLE_IDS = (process.env.ALLOWED_ROLE_IDS || '').split(',').map(r => r.trim()).filter(Boolean);

// ─── Bouton Jouer ─────────────────────────────────────────────────
function playButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🎮  Jouer maintenant')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://www.roblox.com/games/${ROBLOX_PLACE_ID}`)
  );
}

// ─── Commandes slash ──────────────────────────────────────────────
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('admin-abuse')
      .setDescription('Signaler un abus d\'un admin dans le jeu')
      .addStringOption(opt =>
        opt.setName('nom').setDescription('Nom Roblox de l\'admin abusif').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('description').setDescription('Décrivez l\'abus commis').setRequired(true)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('admin-abuse-2h')
      .setDescription('Lancer un Admin Abuse dans 2 heures avec compte à rebours')
      .toJSON(),
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅  Commandes enregistrées');
  } catch (err) {
    console.error('Erreur enregistrement commande:', err.message);
  }
}

// ─── Vérification des rôles ───────────────────────────────────────
function hasAllowedRole(interaction) {
  const member = interaction.member;
  const guild  = interaction.guild;
  if (!member || !guild) return false;
  if (guild.ownerId === member.id) return true;
  return ALLOWED_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

// ─── Interactions ─────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ── /admin-abuse ─────────────────────────────────────────────
  if (interaction.commandName === 'admin-abuse') {
    if (!hasAllowedRole(interaction)) {
      return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const nom         = interaction.options.getString('nom');
    const description = interaction.options.getString('description');
    const auteur      = interaction.member;
    const now         = new Date();

    const embed = new EmbedBuilder()
      .setTitle('⚠️  Signalement — Abus Admin')
      .setColor(0xED4245)
      .addFields(
        { name: '👤  Admin signalé',          value: `\`\`\`${nom}\`\`\``, inline: false },
        { name: '📝  Description de l\'abus', value: `> ${description}`,    inline: false },
        { name: '🛡️  Signalé par',            value: `${auteur}`,           inline: true  },
        { name: '📅  Date', value: `<t:${Math.floor(now.getTime()/1000)}:F>`, inline: true },
      )
      .setFooter({ text: 'Système de signalement • Admin Abuse' })
      .setTimestamp();

    try {
      const channel = await client.channels.fetch(ABUSE_CHANNEL_ID);
      if (!channel) return interaction.editReply({ content: '❌ Salon introuvable.' });
      await channel.send({ content: '@everyone', embeds: [embed], components: [playButton()] });
      await interaction.editReply({ content: `✅ Signalement contre **${nom}** posté dans <#${ABUSE_CHANNEL_ID}>.` });
      console.log(`[${now.toLocaleTimeString()}] Signalement : ${nom} par ${auteur.user.tag}`);
    } catch (err) {
      console.error('Erreur /admin-abuse:', err.message);
      await interaction.editReply({ content: '❌ Erreur : ' + err.message });
    }
  }

  // ── /admin-abuse-2h ──────────────────────────────────────────
  if (interaction.commandName === 'admin-abuse-2h') {
    if (!hasAllowedRole(interaction)) {
      return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = await client.channels.fetch(ABUSE_CHANNEL_ID);
      if (!channel) return interaction.editReply({ content: '❌ Salon introuvable.' });

      const startTime = Date.now();

      // Fonction pour envoyer une annonce
      async function sendAnnonce(titre, description, couleur, restant) {
        const ts = Math.floor((startTime + (2 * 60 * 60 * 1000) - restant) / 1000);
        const embed = new EmbedBuilder()
          .setTitle(titre)
          .setDescription(description)
          .setColor(couleur)
          .addFields({ name: '⏰  Heure de début', value: `<t:${Math.floor((startTime + 2 * 60 * 60 * 1000) / 1000)}:T>`, inline: true })
          .setFooter({ text: 'Admin Abuse Event' })
          .setTimestamp();
        await channel.send({ content: '@everyone', embeds: [embed], components: [playButton()] });
      }

      const debutTs = Math.floor((startTime + 2 * 60 * 60 * 1000) / 1000);

      // ── Annonce initiale (maintenant)
      const embedDebut = new EmbedBuilder()
        .setTitle('🚨  Admin Abuse dans 2 heures !')
        .setDescription('Un **Admin Abuse** est prévu dans **2 heures** ! Préparez-vous et rejoignez le jeu !')
        .setColor(0xE67E22)
        .addFields({ name: '⏰  Heure de début', value: `<t:${debutTs}:T>`, inline: true })
        .setFooter({ text: 'Admin Abuse Event' })
        .setTimestamp();
      await channel.send({ content: '@everyone', embeds: [embedDebut], components: [playButton()] });

      await interaction.editReply({ content: `✅ Compte à rebours lancé ! Les rappels seront postés automatiquement dans <#${ABUSE_CHANNEL_ID}>.` });
      console.log(`[${new Date().toLocaleTimeString()}] Admin Abuse 2h lancé`);

      // ── Rappel 1h restant
      setTimeout(async () => {
        const embed = new EmbedBuilder()
          .setTitle('⏳  Admin Abuse dans 1 heure !')
          .setDescription('Plus qu\'**1 heure** avant le début de l\'Admin Abuse ! Rejoignez le jeu !')
          .setColor(0xE67E22)
          .addFields({ name: '⏰  Heure de début', value: `<t:${debutTs}:T>`, inline: true })
          .setFooter({ text: 'Admin Abuse Event' })
          .setTimestamp();
        await channel.send({ content: '@everyone', embeds: [embed], components: [playButton()] });
        console.log(`[${new Date().toLocaleTimeString()}] Rappel 1h envoyé`);
      }, 60 * 60 * 1000);

      // ── Rappel 30 min restant
      setTimeout(async () => {
        const embed = new EmbedBuilder()
          .setTitle('⏳  Admin Abuse dans 30 minutes !')
          .setDescription('Plus que **30 minutes** ! Connectez-vous au jeu maintenant !')
          .setColor(0xE74C3C)
          .addFields({ name: '⏰  Heure de début', value: `<t:${debutTs}:T>`, inline: true })
          .setFooter({ text: 'Admin Abuse Event' })
          .setTimestamp();
        await channel.send({ content: '@everyone', embeds: [embed], components: [playButton()] });
        console.log(`[${new Date().toLocaleTimeString()}] Rappel 30min envoyé`);
      }, 90 * 60 * 1000);

      // ── Rappel 15 min restant
      setTimeout(async () => {
        const embed = new EmbedBuilder()
          .setTitle('🔥  Admin Abuse dans 15 minutes !')
          .setDescription('Plus que **15 minutes** ! Tout le monde en jeu !!')
          .setColor(0xE74C3C)
          .addFields({ name: '⏰  Heure de début', value: `<t:${debutTs}:T>`, inline: true })
          .setFooter({ text: 'Admin Abuse Event' })
          .setTimestamp();
        await channel.send({ content: '@everyone', embeds: [embed], components: [playButton()] });
        console.log(`[${new Date().toLocaleTimeString()}] Rappel 15min envoyé`);
      }, 105 * 60 * 1000);

      // ── Rappel 5 min restant
      setTimeout(async () => {
        const embed = new EmbedBuilder()
          .setTitle('🔥  Admin Abuse dans 5 minutes !')
          .setDescription('Plus que **5 minutes** !! Tout le monde doit être connecté !!')
          .setColor(0xC0392B)
          .addFields({ name: '⏰  Heure de début', value: `<t:${debutTs}:T>`, inline: true })
          .setFooter({ text: 'Admin Abuse Event' })
          .setTimestamp();
        await channel.send({ content: '@everyone', embeds: [embed], components: [playButton()] });
        console.log(`[${new Date().toLocaleTimeString()}] Rappel 5min envoyé`);
      }, 115 * 60 * 1000);

      // ── Annonce début
      setTimeout(async () => {
        const embed = new EmbedBuilder()
          .setTitle('🎉  L\'Admin Abuse a commencé !')
          .setDescription('**L\'Admin Abuse est maintenant en cours !!** Rejoignez le jeu immédiatement !')
          .setColor(0x2ECC71)
          .setFooter({ text: 'Admin Abuse Event' })
          .setTimestamp();
        await channel.send({ content: '@everyone', embeds: [embed], components: [playButton()] });
        console.log(`[${new Date().toLocaleTimeString()}] Admin Abuse commencé !`);
      }, 120 * 60 * 1000);

    } catch (err) {
      console.error('Erreur /admin-abuse-2h:', err.message);
      await interaction.editReply({ content: '❌ Erreur : ' + err.message });
    }
  }
});

// ─── Events ───────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅  Bot connecté : ${client.user.tag}`);
  console.log(`📢  Salon abus   : ${ABUSE_CHANNEL_ID}`);
  console.log(`🛡️  Rôles autorisés : ${ALLOWED_ROLE_IDS.length > 0 ? ALLOWED_ROLE_IDS.join(', ') : 'aucun'}\n`);
  await registerCommands();
});

client.on('error', err => console.error('Erreur Discord:', err));
client.login(DISCORD_TOKEN);
