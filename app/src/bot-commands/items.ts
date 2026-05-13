import { Bot } from 'grammy';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { lists as listsTable, items as itemsTable } from '../db/schema';
import { getActiveList, setActiveList } from './lists';

export function setupItemCommands(bot: Bot): void {
  bot.command('add', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const raw = ctx.match?.trim();

    if (!raw) {
      await ctx.reply(
        'Usage: /add <item> [, item2, ...] [#category]\n' +
        'Examples:\n' +
        '/add buy milk\n' +
        '/add milk, bread, eggs #groceries\n' +
        '/add sunscreen\n' +
        '/add tent, sleeping bag #gear'
      );
      return;
    }

    let category = 'other';
    let itemsText = raw;

    const categoryMatch = raw.match(/#(\w+)\s*$/);
    if (categoryMatch) {
      category = categoryMatch[1].toLowerCase();
      itemsText = raw.slice(0, raw.lastIndexOf('#')).trim();
    }

    const names = itemsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (names.length === 0) {
      await ctx.reply('Please provide at least one item.');
      return;
    }

    let listId = getActiveList(chatId);

    if (!listId) {
      const existing = await db
        .select()
        .from(listsTable)
        .where(eq(listsTable.chatInstance, chatId))
        .orderBy(listsTable.createdAt)
        .limit(1);

      if (existing.length === 0) {
        const list = {
          id: uuid(),
          chatInstance: chatId,
          name: 'Default',
          createdBy: String(ctx.from?.id || 'unknown'),
          createdAt: new Date().toISOString(),
        };
        await db.insert(listsTable).values(list);
        listId = list.id;
      } else {
        listId = existing[0].id;
      }
    }

    const now = new Date().toISOString();
    const createdBy = String(ctx.from?.id || 'unknown');

    const newItems = names.map((text) => ({
      id: uuid(),
      listId,
      text,
      completed: false,
      completedBy: null,
      createdBy,
      category,
      createdAt: now,
      updatedAt: now,
    }));

    await db.insert(itemsTable).values(newItems);

    const label = category !== 'other' ? ` [#${category}]` : '';
    const list = names.map((n) => `• ${n}`).join('\n');

    if (names.length === 1) {
      await ctx.reply(`Added: ${names[0]}${label}`);
    } else {
      await ctx.reply(`Added ${names.length} items${label}:\n${list}`);
    }
  });

  bot.command('list', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const name = ctx.match?.trim();

    let listId: string | undefined;

    if (name) {
      const [list] = await db
        .select()
        .from(listsTable)
        .where(and(eq(listsTable.chatInstance, chatId), eq(listsTable.name, name)))
        .limit(1);

      if (!list) {
        await ctx.reply(`List "${name}" not found.`);
        return;
      }

      listId = list.id;
      setActiveList(chatId, listId);
    } else {
      listId = getActiveList(chatId);

      if (!listId) {
        const allLists = await db
          .select()
          .from(listsTable)
          .where(eq(listsTable.chatInstance, chatId))
          .limit(1);

        if (allLists.length === 0) {
          await ctx.reply('No lists. Create one with /newlist.');
          return;
        }

        listId = allLists[0].id;
      }
    }

    const items = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.listId, listId))
      .orderBy(itemsTable.createdAt);

    const [list] = await db
      .select()
      .from(listsTable)
      .where(eq(listsTable.id, listId))
      .limit(1);

    if (items.length === 0) {
      await ctx.reply(`*${list?.name || 'List'}* is empty. Use /add to add items.`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    const lines = items.map((item, i) => {
      const status = item.completed ? '✅' : '⬜';
      const cat = item.category !== 'other' ? ` [#${item.category}]` : '';
      return `${status} ${i + 1}. ${item.text}${cat}`;
    });

    const done = items.filter((i) => i.completed).length;
    const header = `*${list?.name || 'List'}* (${done}/${items.length} done)\n\n`;

    await ctx.reply(header + lines.join('\n'), { parse_mode: 'Markdown' });
  });

  bot.command('done', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const raw = ctx.match?.trim();

    if (!raw) {
      await ctx.reply('Usage: /done <number> [, number2, ...]\nExamples:\n/done 3\n/done 1,2,3\n/done 1 3 5');
      return;
    }

    const listId = getActiveList(chatId);
    if (!listId) {
      await ctx.reply('No active list. Use /list to view a list first.');
      return;
    }

    const items = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.listId, listId))
      .orderBy(itemsTable.createdAt);

    const indices = raw
      .split(/[\s,]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0 && n <= items.length);

    if (indices.length === 0) {
      await ctx.reply(`No valid item numbers. List has ${items.length} items.`);
      return;
    }

    const now = new Date().toISOString();
    const completedBy = String(ctx.from?.id || 'unknown');
    const targets = indices.map((n) => items[n - 1]);

    for (const item of targets) {
      await db
        .update(itemsTable)
        .set({ completed: true, completedBy, updatedAt: now })
        .where(eq(itemsTable.id, item.id));
    }

    if (targets.length === 1) {
      await ctx.reply(`Done: ${targets[0].text}`);
    } else {
      const list = targets.map((t) => `• ${t.text}`).join('\n');
      await ctx.reply(`Marked ${targets.length} items done:\n${list}`);
    }
  });

  bot.command('undo', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const raw = ctx.match?.trim();

    if (!raw) {
      await ctx.reply('Usage: /undo <number> [, number2, ...]\nExamples:\n/undo 3\n/undo 1,2,3\n/undo 1 3 5');
      return;
    }

    const listId = getActiveList(chatId);
    if (!listId) {
      await ctx.reply('No active list. Use /list to view a list first.');
      return;
    }

    const items = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.listId, listId))
      .orderBy(itemsTable.createdAt);

    const indices = raw
      .split(/[\s,]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0 && n <= items.length);

    if (indices.length === 0) {
      await ctx.reply(`No valid item numbers. List has ${items.length} items.`);
      return;
    }

    const now = new Date().toISOString();
    const targets = indices.map((n) => items[n - 1]);

    for (const item of targets) {
      await db
        .update(itemsTable)
        .set({ completed: false, completedBy: null, updatedAt: now })
        .where(eq(itemsTable.id, item.id));
    }

    if (targets.length === 1) {
      await ctx.reply(`Undone: ${targets[0].text}`);
    } else {
      const list = targets.map((t) => `• ${t.text}`).join('\n');
      await ctx.reply(`Unmarked ${targets.length} items:\n${list}`);
    }
  });
}
