import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { items as itemsTable } from '../db/schema';
import { authMiddleware } from '../middleware/jwt-auth';
import { broadcast } from '../ws/rooms';

const router = Router();
router.use(authMiddleware);

router.get('/:listId/items', async (req: Request, res: Response): Promise<void> => {
  try {
    const listId = req.params.listId as string;
    const result = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.listId, listId))
      .orderBy(itemsTable.createdAt);

    res.json(result);
  } catch (err) {
    console.error('Get items error:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

router.post('/:listId/items', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.auth!.userId;
    const chatInstance = req.auth!.chatInstance;
    const { text, category } = req.body;
    const listId = req.params.listId as string;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Item text is required' });
      return;
    }

    const now = new Date().toISOString();
    const item = {
      id: uuid(),
      listId,
      text: text.trim(),
      completed: false,
      completedBy: null,
      createdBy: userId,
      category: category || 'other',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(itemsTable).values(item);
    broadcast(chatInstance, { type: 'item_added', listId, item });
    res.status(201).json(item);
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

router.patch('/:listId/items/:itemId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.auth!.userId;
    const chatInstance = req.auth!.chatInstance;
    const { text, completed, category } = req.body;
    const listId = req.params.listId as string;
    const itemId = req.params.itemId as string;

    const [existing] = await db
      .select()
      .from(itemsTable)
      .where(
        and(
          eq(itemsTable.id, itemId),
          eq(itemsTable.listId, listId)
        )
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (text !== undefined) updates.text = text;
    if (category !== undefined) updates.category = category;

    if (completed !== undefined) {
      updates.completed = completed;
      updates.completedBy = completed ? userId : null;
    }

    await db
      .update(itemsTable)
      .set(updates)
      .where(eq(itemsTable.id, itemId));

    const updated = { ...existing, ...updates };
    broadcast(chatInstance, { type: 'item_updated', listId, item: updated });
    res.json(updated);
  } catch (err) {
    console.error('Update item error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.delete('/:listId/items/:itemId', async (req: Request, res: Response): Promise<void> => {
  try {
    const chatInstance = req.auth!.chatInstance;
    const listId = req.params.listId as string;
    const itemId = req.params.itemId as string;

    const [existing] = await db
      .select()
      .from(itemsTable)
      .where(
        and(
          eq(itemsTable.id, itemId),
          eq(itemsTable.listId, listId)
        )
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    await db
      .delete(itemsTable)
      .where(eq(itemsTable.id, itemId));

    broadcast(chatInstance, {
      type: 'item_deleted',
      listId,
      itemId,
    });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
