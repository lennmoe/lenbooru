import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  Client,
  ContextMenuCommandBuilder,
  Events,
  GatewayIntentBits,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Interaction,
  type User,
  type UserContextMenuCommandInteraction,
} from "discord.js";
import { ROLE_LABEL, type Role } from "./perms";
import { OWNER_ID, listUsers, removeUser, resolveRole, setUser } from "./users";

/**
 * Bot Discord de gestion de la liste blanche. Démarré une seule fois au lancement
 * du serveur Next (voir `src/instrumentation.ts`) et partage la même base SQLite.
 *
 *   /wl add membre:@x [role]   ajoute ou change le rôle
 *   /wl remove membre:@x       retire
 *   /wl list                   liste les membres
 *   clic droit sur un membre → Apps → « Whitelister »   (lecture seule)
 *
 * Seuls les propriétaires (rôle `owner` sur le site) peuvent s'en servir.
 */

const ASSIGNABLE: Role[] = ["viewer", "editor", "uploader"];
const CONTEXT_MENU_NAME = "Whitelister";

const contexts = [InteractionContextType.Guild, InteractionContextType.BotDM];

const commands = [
  new SlashCommandBuilder()
    .setName("wl")
    .setDescription("Liste blanche lenbooru")
    .setContexts(contexts)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Ajouter un membre (ou changer son rôle)")
        .addUserOption((o) =>
          o.setName("membre").setDescription("Membre Discord").setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName("role")
            .setDescription("Niveau d'accès (défaut : lecture seule)")
            .addChoices(...ASSIGNABLE.map((r) => ({ name: ROLE_LABEL[r], value: r })))
        )
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Retirer un membre")
        .addUserOption((o) =>
          o.setName("membre").setDescription("Membre Discord").setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName("list").setDescription("Lister les membres")),
  new ContextMenuCommandBuilder()
    .setName(CONTEXT_MENU_NAME)
    .setType(ApplicationCommandType.User)
    .setContexts(contexts)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

function siteUrl(): string {
  return process.env.AUTH_URL?.trim() || "http://localhost:3000";
}

async function notify(user: User, role: Role) {
  try {
    await user.send(
      `Tu as accès à **lenbooru** (${ROLE_LABEL[role]}).\nConnecte-toi avec Discord : ${siteUrl()}`
    );
  } catch {
    // DM fermés : pas grave
  }
}

async function whitelist(
  i: ChatInputCommandInteraction | UserContextMenuCommandInteraction,
  target: User,
  role: Role
) {
  if (target.bot) {
    await i.reply({ content: "Impossible de whitelister un bot.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (target.id === OWNER_ID) {
    await i.reply({ content: "C'est le propriétaire, il a déjà tous les droits.", flags: MessageFlags.Ephemeral });
    return;
  }
  const already = resolveRole(target.id);
  setUser(target.id, role, target.globalName || target.username);
  await i.reply({
    content: already
      ? `<@${target.id}> : rôle changé → **${ROLE_LABEL[role]}**`
      : `<@${target.id}> ajouté à la liste blanche (**${ROLE_LABEL[role]}**)`,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
  if (!already) await notify(target, role);
}

function formatList(): string {
  const users = listUsers();
  if (!users.length) return "Aucun membre.";
  const lines = users.map(
    (u) => `• **${u.username || "?"}** — \`${u.discord_id}\` — ${ROLE_LABEL[u.role] ?? u.role}`
  );
  let out = `**${users.length} membre(s)**\n`;
  for (const line of lines) {
    if (out.length + line.length + 20 > 2000) {
      out += "\n…";
      break;
    }
    out += line + "\n";
  }
  return out;
}

async function handle(i: Interaction) {
  if (!i.isChatInputCommand() && !i.isUserContextMenuCommand()) return;
  if (i.commandName !== "wl" && i.commandName !== CONTEXT_MENU_NAME) return;

  if (resolveRole(i.user.id) !== "owner") {
    await i.reply({ content: "Réservé au propriétaire du site.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (i.isUserContextMenuCommand()) {
    await whitelist(i, i.targetUser, "viewer");
    return;
  }

  const sub = i.options.getSubcommand();
  if (sub === "add") {
    const role = (i.options.getString("role") as Role | null) ?? "viewer";
    await whitelist(i, i.options.getUser("membre", true), role);
  } else if (sub === "remove") {
    const target = i.options.getUser("membre", true);
    const had = resolveRole(target.id);
    const ok = had && removeUser(target.id);
    await i.reply({
      content: ok
        ? `<@${target.id}> retiré de la liste blanche.`
        : had
          ? "Impossible de retirer le propriétaire."
          : `<@${target.id}> n'est pas sur la liste blanche.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  } else if (sub === "list") {
    await i.reply({ content: formatList(), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  }
}

const g = globalThis as unknown as { __lenbooruBot?: Client };

export function startBot() {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) {
    console.log("[bot] DISCORD_BOT_TOKEN absent — bot désactivé");
    return;
  }
  if (g.__lenbooruBot) return;

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  g.__lenbooruBot = client;

  client.once(Events.ClientReady, async (c) => {
    console.log(`[bot] connecté en tant que ${c.user.tag}`);
    try {
      await c.application.commands.set(commands);
    } catch (e) {
      console.error("[bot] enregistrement des commandes échoué", e);
    }
  });

  client.on(Events.InteractionCreate, async (i) => {
    try {
      await handle(i);
    } catch (e) {
      console.error("[bot] erreur interaction", e);
      if (i.isRepliable() && !i.replied && !i.deferred) {
        await i
          .reply({ content: "Erreur interne.", flags: MessageFlags.Ephemeral })
          .catch(() => {});
      }
    }
  });

  client.on(Events.Error, (e) => console.error("[bot]", e));

  client.login(token).catch((e) => {
    console.error("[bot] connexion impossible :", e.message);
    g.__lenbooruBot = undefined;
  });
}
