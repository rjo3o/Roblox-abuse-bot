const {
  Client, GatewayIntentBits, EmbedBuilder,
  SlashCommandBuilder, REST, Routes,
  PermissionFlagsBits
} = require('discord.js');
if (process.env.NODE_ENV !== 'production') { try { require('dotenv').config(); } catch(e) {} }

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ─── Configuration ────────────────────────────────────────────────
const DISCORD_TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID         = process.env.CLIENT_ID;
const GUILD_ID          = process.env.GUILD_ID;
const ABUSE_CHANNEL_ID  = process.env.ABUSE_CHANNEL_ID;
// Rôles autorisés à utiliser la commande (IDs séparés par des virgules)
const ALLOWED_ROLE_IDS  = (process.env.ALLOWED_ROLE_IDS || '').split(',').map(r => r.trim()).filter(Boolean);

// ─── Enregistrement de la commande slash ─────────────────────────
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('admin-abuse')
      .setDescription('Signaler un abus d\'un admin dans le jeu')
      .addStringOption(opt =>
        opt.setName('nom')
          .setDescription('Nom Roblox de l\'admin abusif')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('description')
          .setDescription('Décrivez l\'abus commis')
          .setRequired(true)
      )
      .toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅  Commande /admin-abuse enregistrée');
  } catch (err) {
    console.error('Erreur enregistrement commande:', err.message);
  }
}

// ─── Vérification des rôles ───────────────────────────────────────
function hasAllowedRole(member) {
  // Le propriétaire du serveur peut toujours l'utiliser
  if (member.guild.ownerId === member.id) return true;
  // Vérifier si le membre a un des rôles autorisés
  return ALLOWED_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

// ─── Gestion de la commande ───────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'admin-abuse') return;

  // Vérifier les permissions
  if (!hasAllowedRole(interaction.member)) {
    return interaction.reply({
      content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
      ephemeral: true // Visible uniquement par l'utilisateur
    });
  }

  const nom         = interaction.options.getString('nom');
  const description = interaction.options.getString('description');
  const auteur      = interaction.member;
  const now         = new Date();

  // Construire l'embed
  const embed = new EmbedBuilder()
    .setTitle('⚠️  Signalement — Abus Admin')
    .setColor(0xED4245) // Rouge
    .addFields(
      { name: '👤  Admin signalé', value: `\`\`\`${nom}\`\`\``, inline: false },
      { name: '📝  Description de l\'abus', value: `> ${description}`, inline: false },
      { name: '🛡️  Signalé par', value: `${auteur}`, inline: true },
      { name: '📅  Date', value: `<t:${Math.floor(now.getTime()/1000)}:F>`, inline: true },
    )
    .setFooter({ text: 'Système de signalement • Admin Abuse' })
    .setTimestamp();

  try {
    // Poster dans le salon dédié
    const channel = await client.channels.fetch(ABUSE_CHANNEL_ID);
    if (!channel) {
      return interaction.reply({ content: '❌ Salon introuvable. Contactez un administrateur.', ephemeral: true });
    }

    await channel.send({ content: '@everyone', embeds: [embed] });

    // Confirmer à la personne qui a utilisé la commande
    await interaction.reply({
      content: `✅ Le signalement contre **${nom}** a bien été posté dans <#${ABUSE_CHANNEL_ID}>.`,
      ephemeral: true
    });

    console.log(`[${now.toLocaleTimeString()}] Signalement posté : ${nom} par ${auteur.user.tag}`);
  } catch (err) {
    console.error('Erreur lors du signalement:', err.message);
    await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
  }
});

// ─── Events ───────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅  Bot connecté : ${client.user.tag}`);
  console.log(`📢  Salon abus   : ${ABUSE_CHANNEL_ID}`);
  console.log(`🛡️  Rôles autorisés : ${ALLOWED_ROLE_IDS.length > 0 ? ALLOWED_ROLE_IDS.join(', ') : 'aucun configuré'}\n`);
  await registerCommands();
});

client.on('error', err => console.error('Erreur Discord:', err));
client.login(DISCORD_TOKEN);
