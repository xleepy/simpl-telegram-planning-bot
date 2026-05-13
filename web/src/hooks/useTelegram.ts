import { useCallback, useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: { id: number; first_name: string; last_name?: string; username?: string };
          chat?: { id: number; type: string; title?: string; username?: string };
          chat_instance?: string;
        };
        ready: () => void;
        expand: () => void;
        enableClosingConfirmation: () => void;
        isExpanded: boolean;
        viewportHeight: number;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        onEvent: (event: string, callback: () => void) => void;
        offEvent: (event: string, callback: () => void) => void;
      };
    };
  }
}

export interface TelegramContext {
  initData: string;
  user: { id: number; firstName: string; lastName?: string; username?: string } | null;
  chatId: string;
  isDev: boolean;
  isReady: boolean;
  colorScheme: 'light' | 'dark';
}

export function useTelegram(): TelegramContext {
  const [isReady, setIsReady] = useState(false);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');

  const webApp = window.Telegram?.WebApp;
  const isDev = !webApp;

  useEffect(() => {
    if (webApp) {
      webApp.ready();
      webApp.expand();
      webApp.enableClosingConfirmation();

      const handleTheme = () => {
        setColorScheme(webApp.colorScheme);
      };
      webApp.onEvent('themeChanged', handleTheme);
      setColorScheme(webApp.colorScheme);
      setIsReady(true);

      return () => {
        webApp.offEvent('themeChanged', handleTheme);
      };
    } else {
      setIsReady(true);
    }
  }, [webApp]);

  let chatId = '';

  if (webApp) {
    const unsafe = webApp.initDataUnsafe;
    if (unsafe.chat?.id) {
      chatId = String(unsafe.chat.id);
    } else if (unsafe.chat_instance) {
      chatId = unsafe.chat_instance;
    } else if (unsafe.user) {
      chatId = `user-${unsafe.user.id}`;
    }
  }

  const context: TelegramContext = {
    initData: webApp?.initData || '',
    user: webApp?.initDataUnsafe?.user
      ? {
          id: webApp.initDataUnsafe.user.id,
          firstName: webApp.initDataUnsafe.user.first_name,
          lastName: webApp.initDataUnsafe.user.last_name,
          username: webApp.initDataUnsafe.user.username,
        }
      : null,
    chatId,
    isDev,
    isReady,
    colorScheme,
  };

  return context;
}

export function getMockUser() {
  return {
    id: 12345,
    firstName: 'Dev',
    lastName: 'User',
    username: 'devuser',
  };
}
