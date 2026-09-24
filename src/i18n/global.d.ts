import type messages from './messages/pt-BR.json';
import type { routing } from './routing';

// Tipagem das chaves de mensagem e dos locales para o next-intl.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
