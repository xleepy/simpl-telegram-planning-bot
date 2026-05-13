import { Bot } from 'grammy';

function appUrl(): string {
  const raw = process.env.DOMAIN || '';
  const domain = raw.replace(/^https?:\/\//, '');
  return `https://${domain}`;
}

async function replyWithApp(ctx: any, text: string) {
  if (process.env.CHAT_ONLY === 'true') {
    await ctx.reply(text, { parse_mode: 'Markdown' });
    return;
  }

  try {
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '📋 Open Trip Planner', web_app: { url: appUrl() } }]],
      },
    });
  } catch (e: any) {
    if (e?.error_code === 400 && e?.description?.includes('BUTTON_TYPE_INVALID')) {
      console.log('[web_app] BUTTON_TYPE_INVALID — falling back to text-only');
      await ctx.reply(text + '\n\n_Open @xl_planning_bot and use the Menu button._', {
        parse_mode: 'Markdown',
      });
    } else {
      throw e;
    }
  }
}

export function setupCommands(bot: Bot): void {
  bot.command('start', async (ctx) => {
    await replyWithApp(ctx,
      `*Trip Planner*\n\n` +
      `Plan groceries, packing lists, and tasks together.\n\n` +
      `Commands:\n` +
      `• /newlist \\<name\\> — Create a list\n` +
      `• /switch \\<name\\> — Switch active list\n` +
      `• /lists — View all lists\n` +
      `• /list \\[name\\] — Show a list\n` +
      `• /add \\<text\\> — Add item to current list\n` +
      `• /done \\<number\\> — Mark item done\n` +
      `• /help — Show all commands`
    );
  });

  bot.command('help', async (ctx) => {
    await replyWithApp(ctx,
      `*Commands*\n\n` +
      `*Lists*\n` +
      `/newlist \\<name\\> — Create a new list\n` +
      `/switch \\<name\\> — Switch active list\n` +
      `/lists — Show all lists\n` +
      `/deletelist \\<name\\> — Delete a list\n` +
      `/current — Show active list\n\n` +
      `*Items*\n` +
      `/add \\<text\\> \\[\\#category\\] — Add item\n` +
      `/list \\[name\\] — Show list items, set as active\n` +
      `/done \\<number\\> — Mark item done\n` +
      `/undo \\<number\\> — Undo mark`
    );
  });
}
