import { Bot } from 'grammy';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { lists as listsTable } from '../db/schema';

const CHAT_ONLY = process.env.CHAT_ONLY === 'true';
const activeLists = new Map<string, string>();

export function getActiveList(chatId: string): string | undefined {
  return activeLists.get(chatId);
}

export function setActiveList(chatId: string, listId: string): void {
  activeLists.set(chatId, listId);
}

export function setupListCommands(bot: Bot): void {

  bot.command('newlist', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const name = ctx.match?.trim();

    if (!name) {
      await ctx.reply('Usage: /newlist <name>\nExample: /newlist Groceries');
      return;
    }

    const existing = await db
      .select()
      .from(listsTable)
      .where(
        and(eq(listsTable.chatInstance, chatId), eq(listsTable.name, name))
      )
      .limit(1);

    if (existing.length > 0) {
      await ctx.reply(`List "${name}" already exists.`);
      return;
    }

    const list = {
      id: uuid(),
      chatInstance: chatId,
      name,
      createdBy: String(ctx.from?.id || 'unknown'),
      createdAt: new Date().toISOString(),
    };

    await db.insert(listsTable).values(list);
    activeLists.set(chatId, list.id);

    await ctx.reply(`Created list *${name}*.\nUse /add to add items.`, { parse_mode: 'Markdown' });
  });

  bot.command('lists', async (ctx) => {
    const chatId = String(ctx.chat.id);

    const result = await db
      .select()
      .from(listsTable)
      .where(eq(listsTable.chatInstance, chatId))
      .orderBy(listsTable.createdAt);

    if (result.length === 0) {
      if (CHAT_ONLY) {
        await ctx.reply('No lists yet. Create one with /newlist.');
      } else {
        const domain = (process.env.DOMAIN || 'example.com').replace(/^https?:\/\//, '');
        await ctx.reply('No lists yet. Create one with /newlist.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Open Trip Planner', web_app: { url: `https://${domain}` } }],
            ],
          },
        });
      }
      return;
    }

    const activeId = activeLists.get(chatId);
    const lines = result.map((l) =>
      `${l.id === activeId ? '👉 ' : ''}${l.name}`
    );
    await ctx.reply(`*Your lists*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  });

  bot.command('deletelist', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const name = ctx.match?.trim();

    if (!name) {
      await ctx.reply('Usage: /deletelist <name>');
      return;
    }

    const [list] = await db
      .select()
      .from(listsTable)
      .where(and(eq(listsTable.chatInstance, chatId), eq(listsTable.name, name)))
      .limit(1);

    if (!list) {
      await ctx.reply(`List "${name}" not found.`);
      return;
    }

    await db.delete(listsTable).where(eq(listsTable.id, list.id));

    if (activeLists.get(chatId) === list.id) {
      activeLists.delete(chatId);
    }

    await ctx.reply(`Deleted list "${name}".`);
  });

  bot.command('current', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const activeId = activeLists.get(chatId);

    if (!activeId) {
      await ctx.reply('No active list. Use /switch <name> to select one.');
      return;
    }

    const [list] = await db
      .select()
      .from(listsTable)
      .where(eq(listsTable.id, activeId))
      .limit(1);

    if (!list) {
      activeLists.delete(chatId);
      await ctx.reply('Active list was deleted. Use /lists to see available lists.');
      return;
    }

    await ctx.reply(`Active list: *${list.name}*`, { parse_mode: 'Markdown' });
  });

  bot.command('rename', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const args = ctx.match?.trim();

    if (!args) {
      await ctx.reply('Usage: /rename <old-name> <new-name>\nExample: /rename Groceries Shopping');
      return;
    }

    const spaceIndex = args.indexOf(' ');
    if (spaceIndex === -1) {
      await ctx.reply('Usage: /rename <old-name> <new-name>\nExample: /rename Groceries Shopping');
      return;
    }

    const oldName = args.slice(0, spaceIndex).trim();
    const newName = args.slice(spaceIndex + 1).trim();

    if (!oldName || !newName) {
      await ctx.reply('Usage: /rename <old-name> <new-name>\nExample: /rename Groceries Shopping');
      return;
    }

    const [list] = await db
      .select()
      .from(listsTable)
      .where(and(eq(listsTable.chatInstance, chatId), eq(listsTable.name, oldName)))
      .limit(1);

    if (!list) {
      await ctx.reply(`List "${oldName}" not found.`);
      return;
    }

    const [existingNew] = await db
      .select()
      .from(listsTable)
      .where(and(eq(listsTable.chatInstance, chatId), eq(listsTable.name, newName)))
      .limit(1);

    if (existingNew && existingNew.id !== list.id) {
      await ctx.reply(`A list named "${newName}" already exists.`);
      return;
    }

    await db
      .update(listsTable)
      .set({ name: newName })
      .where(eq(listsTable.id, list.id));

    await ctx.reply(`Renamed "${oldName}" to "${newName}".`);
  });

  bot.command('switch', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const name = ctx.match?.trim();

    if (!name) {
      await ctx.reply('Usage: /switch <name>\nExample: /switch Groceries');
      return;
    }

    const [list] = await db
      .select()
      .from(listsTable)
      .where(and(eq(listsTable.chatInstance, chatId), eq(listsTable.name, name)))
      .limit(1);

    if (!list) {
      await ctx.reply(`List "${name}" not found. Use /lists to see available lists.`);
      return;
    }

    activeLists.set(chatId, list.id);
    await ctx.reply(`Switched to *${list.name}*. Use /add to add items.`, { parse_mode: 'Markdown' });
  });
}
