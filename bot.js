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

const IMAGES = {
  '2h':    process.env.IMG_2H,
  '1h':    process.env.IMG_1H,
  '30min': process.env.IMG_30MIN,
  '15min': process.env.IMG_15MIN,
  '5min':  process.env.IMG_5MIN,
  'now':   process.env.IMG_NOW,
};

let countdownActive = false;
let countdownTimers = [];
let lastMessageId   = null;

function clearCountdown() {
  countdownTimers.forEach(t => clearTimeout(t));
  countdownTimers  = [];
  countdownActive  = false;
  lastMessageId    = null;
}

function playButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🎮  Jouer maintenant')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://www.roblox.com/games/${ROBLOX_PLACE_ID}`)
  );
}

async function sendAnnonce(channel, embed) {
  if (lastMessageId) {
    try {
      const old = await channel.messages.fetch(lastMessageId);
      await old.delete();
    } catch (e) {
      console.log('Message précédent introuvable, on continue.');
    }
    lastMessageId = null;
  }
  const msg = await channel.send({
    content: '@everyone',
    embeds: [embed],
    components: [playButton()],
  });
  lastMessageId = msg.id;
  return msg;
}

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

function hasAllowedRole(interaction) {
  const member = interaction.member;
  const guild  = interaction.guild;
  if (!member || !guild) return false;
  if (guild.ownerId === member.id) return true;
  return ALLOWED_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'admin-abuse') {
    if (!hasAllowedRole(interaction)) {
      return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', ephemeral: true });
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
    } catch (err) {
      await interaction.editReply({ content: '❌ Erreur : ' + err.message });
    }
  }

  if (interaction.commandName === 'admin-abuse-2h') {
    if (!hasAllowedRole(interaction)) {
      return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', ephemeral: true });
    }
    if (countdownActive) {
      return interaction.reply({ content: '⚠️ Un compte à rebours est déjà en cours ! Utilisez `/admin-abuse-stop` pour l\'annuler.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      const channel = await client.channels.fetch(ABUSE_CHANNEL_ID);
      if (!channel) return interaction.editReply({ content: '❌ Salon introuvable.' });
      countdownActive = true;
      const startTime = Date.now();
      const debutTs   = Math.floor((startTime + 2 * 60 * 60 * 1000) / 1000);

      const embed2h = new EmbedBuilder()
        .setTitle('🚨  Admin Abuse dans 2 heures !')
        .setDescription('Un **Admin Abuse** est prévu dans **2 heures** ! Préparez-vous et rejoignez le jeu !')
        .setColor(0xE67E22)
        .setImage(IMAGES['2h'])
        .addFields({ name: '⏰  Heure de début', value: `<t:${debutTs}:T>`, inline: true })
        .setFooter({ text: 'Admin Abuse Event' })
        .setTimestamp();
      await sendAnnonce(channel, embed2h);
      await interaction.editReply({ content: `✅ Compte à rebours lancé dans <#${ABUSE_CHANNEL_ID}>.\nUtilisez \`/admin-abuse-stop\` pour annuler.` });

      const rappels = [
        { delai: 60,  image: IMAGES['1h'],    titre: '⏳  Admin Abuse dans 1 heure !',    desc: 'Plus qu\'**1 heure** avant le début ! Rejoignez le jeu !',         couleur: 0xE67E22 },
        { delai: 90,  image: IMAGES['30min'], titre: '⏳  Admin Abuse dans 30 minutes !', desc: 'Plus que **30 minutes** ! Connectez-vous maintenant !',             couleur: 0xE74C3C },
        { delai: 105, image: IMAGES['15min'], titre: '🔥  Admin Abuse dans 15 minutes !', desc: 'Plus que **15 minutes** ! Tout le monde en jeu !!',                 couleur: 0xE74C3C },
        { delai: 115, image: IMAGES['5min'],  titre: '🔥  Admin Abuse dans 5 minutes !',  desc: 'Plus que **5 minutes** !! Tout le monde doit être connecté !!',    couleur: 0xC0392B },
        { delai: 120, image: IMAGES['now'],   titre: '🎉  L\'Admin Abuse a commencé !',   desc: '**L\'Admin Abuse est en cours !!** Rejoignez le jeu immédiatement !', couleur: 0x2ECC71, fin: true },
      ];

      rappels.forEach(({ delai, image, titre, desc, couleur, fin }) => {
        const t = setTimeout(async () => {
          if (!countdownActive) return;
          const embed = new EmbedBuilder()
            .setTitle(titre).setDescription(desc).setColor(couleur).setImage(image)
            .addFields({ name: '⏰  Heure de début', value: `<t:${debutTs}:T>`, inline: true })
            .setFooter({ text: 'Admin Abuse Event' }).setTimestamp();
          await sendAnnonce(channel, embed);
          console.log(`[${new Date().toLocaleTimeString()}] ${titre}`);
          if (fin) { countdownActive = false; lastMessageId = null; }
        }, delai * 60 * 1000);
        countdownTimers.push(t);
      });

    } catch (err) {
      countdownActive = false;
      await interaction.editReply({ content: '❌ Erreur : ' + err.message });
    }
  }

  if (interaction.commandName === 'admin-abuse-stop') {
    if (!hasAllowedRole(interaction)) {
      return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', ephemeral: true });
    }
    if (!countdownActive) {
      return interaction.reply({ content: '⚠️ Aucun compte à rebours en cours.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      const channel = await client.channels.fetch(ABUSE_CHANNEL_ID);
      if (channel && lastMessageId) {
        try { const old = await channel.messages.fetch(lastMessageId); await old.delete(); } catch (e) {}
      }
      clearCountdown();
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('🛑  Admin Abuse annulé')
          .setDescription('L\'événement Admin Abuse a été **annulé** par un modérateur.')
          .setColor(0x95A5A6).setFooter({ text: 'Admin Abuse Event' }).setTimestamp();
        await channel.send({ content: '@everyone', embeds: [embed] });
      }
      await interaction.editReply({ content: '✅ Compte à rebours annulé.' });
    } catch (err) {
      await interaction.editReply({ content: '❌ Erreur : ' + err.message });
    }
  }
});

client.once('ready', async () => {
  console.log(`✅  Bot connecté : ${client.user.tag}`);
  console.log(`📢  Salon abus   : ${ABUSE_CHANNEL_ID}`);
  console.log(`🛡️  Rôles autorisés : ${ALLOWED_ROLE_IDS.length > 0 ? ALLOWED_ROLE_IDS.join(', ') : 'aucun'}\n`);
  await registerCommands();
});

client.on('error', err => console.error('Erreur Discord:', err));
client.login(DISCORD_TOKEN);
