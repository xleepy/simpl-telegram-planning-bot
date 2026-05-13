import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { lists as listsTable } from '../db/schema';
import { authMiddleware } from '../middleware/jwt-auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const chatInstance = req.auth!.chatInstance;
    const result = await db
      .select()
      .from(listsTable)
      .where(eq(listsTable.chatInstance, chatInstance))
      .orderBy(listsTable.createdAt);

    res.json(result);
  } catch (err) {
    console.error('Get lists error:', err);
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const chatInstance = req.auth!.chatInstance;
    const userId = req.auth!.userId;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'List name is required' });
      return;
    }

    const trimmed = name.trim();

    const existing = await db
      .select()
      .from(listsTable)
      .where(
        and(
          eq(listsTable.chatInstance, chatInstance),
          eq(listsTable.name, trimmed)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: 'A list with this name already exists' });
      return;
    }

    const list = {
      id: uuid(),
      chatInstance,
      name: trimmed,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    await db.insert(listsTable).values(list);
    res.status(201).json(list);
  } catch (err) {
    console.error('Create list error:', err);
    res.status(500).json({ error: 'Failed to create list' });
  }
});

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const chatInstance = req.auth!.chatInstance;
    const { name } = req.body;
    const listId = req.params.id as string;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'List name is required' });
      return;
    }

    const [existing] = await db
      .select()
      .from(listsTable)
      .where(
        and(
          eq(listsTable.id, listId),
          eq(listsTable.chatInstance, chatInstance)
        )
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'List not found' });
      return;
    }

    const trimmed = name.trim();

    const duplicates = await db
      .select()
      .from(listsTable)
      .where(
        and(
          eq(listsTable.chatInstance, chatInstance),
          eq(listsTable.name, trimmed)
        )
      )
      .limit(1);

    if (duplicates.length > 0 && duplicates[0].id !== listId) {
      res.status(409).json({ error: 'A list with this name already exists' });
      return;
    }

    await db
      .update(listsTable)
      .set({ name: trimmed })
      .where(eq(listsTable.id, listId));

    res.json({ ...existing, name: trimmed });
  } catch (err) {
    console.error('Update list error:', err);
    res.status(500).json({ error: 'Failed to update list' });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const chatInstance = req.auth!.chatInstance;
    const listId = req.params.id as string;

    const [list] = await db
      .select()
      .from(listsTable)
      .where(
        and(
          eq(listsTable.id, listId),
          eq(listsTable.chatInstance, chatInstance)
        )
      )
      .limit(1);

    if (!list) {
      res.status(404).json({ error: 'List not found' });
      return;
    }

    await db
      .delete(listsTable)
      .where(eq(listsTable.id, listId));

    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete list error:', err);
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

export default router;
