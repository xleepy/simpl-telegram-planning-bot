import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { signToken } from '../middleware/jwt-auth';

const router = Router();
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const DEV_MODE = process.env.DEV_MODE === 'true';

function validateInitData(initData: string): boolean {
  if (DEV_MODE) return true;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return computedHash === hash;
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

router.post('/auth', (req: Request, res: Response): void => {
  try {
    const { initData, devUser } = req.body;

    if (DEV_MODE && devUser) {
      const token = signToken({
        userId: String(devUser.id),
        chatInstance: devUser.chatInstance || 'dev-chat',
      });
      res.json({
        token,
        user: devUser,
        chatInstance: devUser.chatInstance || 'dev-chat',
      });
      return;
    }

    if (!initData) {
      res.status(400).json({ error: 'Missing initData' });
      return;
    }

    if (!validateInitData(initData)) {
      res.status(403).json({ error: 'Invalid initData signature' });
      return;
    }

    const params = new URLSearchParams(initData);
    const userRaw = params.get('user');
    const chatRaw = params.get('chat');

    if (!userRaw) {
      res.status(400).json({ error: 'Missing user in initData' });
      return;
    }

    const user: TelegramUser = JSON.parse(userRaw);

    let chatInstance: string;
    if (chatRaw) {
      const chat = JSON.parse(chatRaw);
      chatInstance = String(chat.id);
    } else {
      chatInstance = params.get('chat_instance') || `user-${user.id}`;
    }

    const token = signToken({
      userId: String(user.id),
      chatInstance,
    });

    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
      },
      chatInstance,
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
