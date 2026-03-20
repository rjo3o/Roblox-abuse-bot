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

// ─── État du compte à rebours ─────────────────────────────────────
let countdownActive  = false;
let countdownTimers  = [];

function clearCountdown() {
  countdownTimers.forEach(t => clearTimeout(t));
  countdownTimers = [];
  countdownActive = false;
}

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

    new SlashCommandBuilder()
      .setName('admin-abuse-stop')
      .setDescription('Annuler le compte à rebours Admin Abuse en cours')
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

    if (countdownActive) {
      return interaction.reply({ content: '⚠️ Un compte à rebours est déjà en cours ! Utilisez `/admin-abuse-stop` pour l\'annuler d\'abord.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = await client.channels.fetch(ABUSE_CHANNEL_ID);
      if (!channel) return interaction.editReply({ content: '❌ Salon introuvable.' });

      countdownActive = true;
      const startTime = Date.now();
      const debutTs   = Math.floor((startTime + 2 * 60 * 60 * 1000) / 1000);

      const embedDebut = new EmbedBuilder()
        .setTitle('🚨  Admin Abuse dans 2 heures !')
        .setDescription('Un **Admin Abuse** est prévu dans **2 heures** ! Préparez-vous et rejoignez le jeu !')
        .setColor(0xE67E22)
        .addFields({ name: '⏰  Heure de début', value: `<t:${debutTs}:T>`, inline: true })
        .setFooter({ text: 'Admin Abuse Event' })
        .setTimestamp();
      await channel.send({ content: '@everyone', embeds: [embedDebut], components: [playButton()] });

      await interaction.editReply({ content: `✅ Compte à rebours lancé dans <#${ABUSE_CHANNEL_ID}>.\nUtilisez \`/admin-abuse-stop\` pour annuler.` });
      console.log(`[${new Date().toLocaleTimeString()}] Admin Abuse 2h lancé`);

      const rappels = [
        { delai: 60,  titre: '⏳  Admin Abuse dans 1 heure !',   desc: 'Plus qu\'**1 heure** avant le début ! Rejoignez le jeu !',         couleur: 0xE67E22 },
        { delai: 90,  titre: '⏳  Admin Abuse dans 30 minutes !', desc: 'Plus que **30 minutes** ! Connectez-vous au jeu maintenant !',     couleur: 0xE74C3C },
        { delai: 105, titre: '🔥  Admin Abuse dans 15 minutes !', desc: 'Plus que **15 minutes** ! Tout le monde en jeu !!',               couleur: 0xE74C3C },
        { delai: 115, titre: '🔥  Admin Abuse dans 5 minutes !',  desc: 'Plus que **5 minutes** !! Tout le monde doit être connecté !!',   couleur: 0xC0392B },
        { delai: 120, titre: '🎉  L\'Admin Abuse a commencé !',   desc: '**L\'Admin Abuse est maintenant en cours !!** Rejoignez le jeu !', couleur: 0x2ECC71 },
      ];

      rappels.forEach(({ delai, titre, desc, couleur }) => {
        const t = setTimeout(async () => {
          if (!countdownActive) return;
          const embed = new EmbedBuilder()
            .setTitle(titre)
            .setDescription(desc)
            .setColor(couleur)
            .addFields({ name: '⏰  Heure de début', value: `<t:${debutTs}:T>`, inline: true })
            .setFooter({ text: 'Admin Abuse Event' })
            .setTimestamp();
          await channel.send({ content: '@everyone', embeds: [embed], components: [playButton()] });
          console.log(`[${new Date().toLocaleTimeString()}] ${titre}`);
          if (delai === 120) countdownActive = false;
        }, delai * 60 * 1000);
        countdownTimers.push(t);
      });

    } catch (err) {
      console.error('Erreur /admin-abuse-2h:', err.message);
      countdownActive = false;
      await interaction.editReply({ content: '❌ Erreur : ' + err.message });
    }
  }

  // ── /admin-abuse-stop ─────────────────────────────────────────
  if (interaction.commandName === 'admin-abuse-stop') {
    if (!hasAllowedRole(interaction)) {
      return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
    }

    if (!countdownActive) {
      return interaction.reply({ content: '⚠️ Aucun compte à rebours en cours.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      clearCountdown();

      const channel = await client.channels.fetch(ABUSE_CHANNEL_ID);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('🛑  Admin Abuse annulé')
          .setDescription('L\'événement Admin Abuse a été **annulé** par un modérateur.')
          .setColor(0x95A5A6)
          .setFooter({ text: 'Admin Abuse Event' })
          .setTimestamp();
        await channel.send({ content: '@everyone', embeds: [embed] });
      }

      await interaction.editReply({ content: '✅ Compte à rebours annulé et annonce postée.' });
      console.log(`[${new Date().toLocaleTimeString()}] Admin Abuse annulé par ${interaction.member.user.tag}`);
    } catch (err) {
      console.error('Erreur /admin-abuse-stop:', err.message);
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
