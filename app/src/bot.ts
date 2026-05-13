import { Bot } from "grammy";
import { setupCommands } from "./bot-commands/start";
import { setupListCommands } from "./bot-commands/lists";
import { setupItemCommands } from "./bot-commands/items";

let botUsername = "";
const CHAT_ONLY = process.env.CHAT_ONLY === "true";

function createBot(): Bot {
  const token = process.env.BOT_TOKEN;

  if (!token || token === "your_telegram_bot_token_here") {
    console.warn("BOT_TOKEN not set — bot commands disabled");
    return new Bot("dummy");
  }

  const bot = new Bot(token);

  setupCommands(bot);
  setupListCommands(bot);
  setupItemCommands(bot);

  bot.on(":new_chat_members:me", async (ctx) => {
    const text =
      "*Trip Planner*\n\n" +
      "Plan groceries, packing lists, and tasks together.\n\n" +
      "Commands:\n" +
      "• /newlist \\<name\\> — Create a list\n" +
      "• /switch \\<name\\> — Switch active list\n" +
      "• /lists — View all lists\n" +
      "• /list \\[name\\] — Show a list\n" +
      "• /add \\<text\\> — Add item to current list\n" +
      "• /done \\<number\\> — Mark item done\n" +
      "• /help — Show all commands";

    if (CHAT_ONLY) {
      await ctx.reply(text, { parse_mode: "Markdown" });
    } else {
      const domain = (process.env.DOMAIN || "example.com").replace(
        /^https?:\/\//,
        "",
      );
      await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📋 Open Trip Planner",
                web_app: { url: `https://${domain}` },
              },
            ],
          ],
        },
      });
    }
  });

  bot.on("message:text", async (ctx) => {
    if (!botUsername) return;

    const text = ctx.message.text;
    const mention = `@${botUsername}`;

    if (text.includes(mention)) {
      console.log(`Mention received in chat ${ctx.chat.id}: "${text}"`);
      const clean = text.replace(new RegExp(mention, "gi"), "").trim();

      if (!clean || clean === "help") {
        const replyText =
          "I'm your trip planning assistant!\n\n" +
          "• /newlist <name> — Create a list\n" +
          "• /switch <name> — Switch active list\n" +
          "• /add <item> — Add an item\n" +
          "• /lists — View all lists\n" +
          "\n_Type /help for all commands_";

        if (CHAT_ONLY) {
          await ctx.reply(replyText, { parse_mode: "Markdown" });
        } else {
          const domain = (process.env.DOMAIN || "example.com").replace(
            /^https?:\/\//,
            "",
          );
          await ctx.reply(replyText, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📋 Open Trip Planner",
                    web_app: { url: `https://${domain}` },
                  },
                ],
              ],
            },
          });
        }
      }
    }
  });

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  bot.start({
    onStart: (me) => {
      botUsername = me.username;
      console.log(`Bot @${me.username} started`);
    },
  });

  return bot;
}

export { createBot };
