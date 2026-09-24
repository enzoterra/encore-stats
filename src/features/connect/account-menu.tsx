/* eslint-disable @next/next/no-img-element -- Foto de perfil vinda do CDN do Spotify, exibida
   sem alteração (o next/image geraria `style` no SSR, bloqueado pela CSP). */
'use client';

import { LogOut } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertDialog, DropdownMenu } from 'radix-ui';
import { useState } from 'react';

import { Button, buttonClasses } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

import { useConnectBundle, useConnectStatus } from './connect-provider';
import { logout } from './logout';
import { replaceLocation } from './navigate';
import { useMe } from './queries';

/**
 * Avatar com menu → "Sair" (10-design.md §8.18). O logout é destrutivo e pede confirmação:
 * "Sair apaga a sessão e o cache desta aba".
 */
export function AccountMenu() {
  const t = useTranslations('Connect.account');
  const locale = useLocale();
  const bundle = useConnectBundle();
  const session = useConnectStatus((state) => state.session);
  const me = useMe();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (session !== 'active') return null;
  const name = me.data?.displayName || t('fallbackName');
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase(locale) ?? '?';

  const confirm = async () => {
    setBusy(true);
    const ok = await logout(locale, bundle);
    if (ok) {
      // Recarrega a rota: o servidor já não vê sessão e nada fica na memória da aba.
      replaceLocation(`/${locale}/connect?status=logged_out`);
      return;
    }
    setBusy(false);
    setConfirming(false);
    toast(t('logoutError'), 'danger');
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={t('menu', { name })}
          className="grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-(--duration-fast) hover:bg-surface-2 data-[state=open]:bg-surface-2"
        >
          {me.data?.image ? (
            <img
              src={me.data.image}
              alt=""
              width={32}
              height={32}
              referrerPolicy="no-referrer"
              className="size-8 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full bg-surface-3 font-display text-body-sm font-bold text-fg"
            >
              {initial}
            </span>
          )}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            collisionPadding={16}
            className="z-50 min-w-56 rounded-md border border-line bg-surface-2 p-1 shadow-e2 motion-safe:animate-fade-in"
          >
            <DropdownMenu.Label className="flex flex-col px-3 py-2">
              <span className="text-overline text-fg-subtle uppercase">{t('connectedAs')}</span>
              <span className="truncate text-body-sm font-semibold text-fg">{name}</span>
            </DropdownMenu.Label>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item
              onSelect={() => setConfirming(true)}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-body-sm text-danger-fg outline-none data-highlighted:bg-surface-3"
            >
              <LogOut aria-hidden="true" className="size-4" />
              {t('logout')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <AlertDialog.Root open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm motion-safe:animate-fade-in" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border border-line bg-surface-2 p-6 shadow-e3 motion-safe:animate-fade-in">
            <AlertDialog.Title className="font-display text-h3">
              {t('confirmTitle')}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-body-sm text-fg-muted">
              {t('confirmBody')}
            </AlertDialog.Description>
            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialog.Cancel
                className={buttonClasses({ variant: 'secondary' })}
                disabled={busy}
              >
                {t('cancel')}
              </AlertDialog.Cancel>
              <Button
                variant="destructive"
                onClick={() => void confirm()}
                disabled={busy}
                aria-busy={busy || undefined}
              >
                <LogOut aria-hidden="true" />
                {busy ? t('loggingOut') : t('confirm')}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
