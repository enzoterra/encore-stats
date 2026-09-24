/* eslint-disable @next/next/no-img-element -- Prévia do PNG gerado no aparelho (blob: URL); o
   next/image não se aplica a object URLs. */
'use client';

import { CircleAlert, CircleCheck, Download, RotateCcw, Share2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Dialog } from 'radix-ui';
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Segmented } from '@/components/ui/segmented';

import {
  generateCard,
  loadCover,
  loadSpotifyLogo,
  warmUpCards,
  type GeneratedCard,
} from './card-client';
import {
  CARD_FORMATS,
  CARD_TEMPLATES,
  type CardData,
  type CardFormat,
  type CardStrings,
  type CardTemplate,
} from './model';
import type { ShareInput } from './share-input';
import { checkPosterName, POSTER_NAME_MAX, slug } from './text';

/** Espera depois da última tecla no "Nome no cartaz" antes de gerar de novo. */
const POSTER_DEBOUNCE_MS = 450;

type Ready = GeneratedCard & { key: string; url: string; file: File; elapsedMs: number };
type Status = { kind: 'generating' } | { kind: 'ready'; card: Ready } | { kind: 'error' };

const STRING_KEYS: readonly (keyof CardStrings)[] = [
  'topArtist',
  'artists',
  'tracks',
  'presents',
  'festOf',
  'festDefault',
  'demoTag',
  'uploadFooter',
  'demoFooter',
];

/** Domínio público do site, sem protocolo (rodapé do card). Em loopback, o rodapé mostra só a marca. */
function siteLabel(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return undefined;
  try {
    const host = new URL(raw).host.replace(/^www\./, '');
    return /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host) ? undefined : host;
  } catch {
    return undefined;
  }
}

/** Web Share API com arquivo PNG (Safari/iOS, Chrome Android). Sem ela, o primário é "Baixar". */
function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array(8)], 'encore.png', { type: 'image/png' });
    return (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [probe] })
    );
  } catch {
    return false;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // O Safari lê o blob depois do clique: revoga só um pouco depois.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Modal de compartilhamento (10-design.md §8.14, US-11). Abre já gerando o Festival 9:16; cada
 * troca de template, formato ou nome gera de novo (com cache por combinação). O PNG fica pronto
 * **antes** do toque em "Compartilhar", para o iOS manter o gesto do usuário na Web Share API.
 */
export default function ShareDialog({
  input,
  open,
  onOpenChange,
  returnFocus,
}: {
  input: ShareInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations('Cards');
  const locale = useLocale();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const posterId = useId();
  const [template, setTemplate] = useState<CardTemplate>('festival');
  const [format, setFormat] = useState<CardFormat>('story');
  const [poster, setPoster] = useState('');
  const [posterApplied, setPosterApplied] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'generating' });
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareable] = useState(canShareFiles);
  // Retorno de sucesso dentro do modal: o toast global ficaria atrás do overlay.
  const [feedback, setFeedback] = useState<{ key: string; message: string } | null>(null);
  const cache = useRef(new Map<string, Ready>());
  const current = useRef('');

  const posterCheck = checkPosterName(poster);
  const posterError =
    posterCheck === 'tooLong'
      ? t('dialog.posterTooLong', { max: POSTER_NAME_MAX })
      : posterCheck === 'invalid'
        ? t('dialog.posterInvalid')
        : null;

  useEffect(() => {
    warmUpCards();
  }, []);

  // O nome só entra no card depois de uma pausa na digitação, e só se for válido.
  useEffect(() => {
    if (posterCheck !== 'ok') return;
    const timer = setTimeout(() => setPosterApplied(poster.trim()), POSTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [poster, posterCheck]);

  const strings = useMemo(
    () => Object.fromEntries(STRING_KEYS.map((key) => [key, t(`strings.${key}`)])) as CardStrings,
    [t],
  );
  const effectivePoster = template === 'festival' ? posterApplied : '';
  const key = `${template}|${format}|${effectivePoster}`;
  const filename = `encore-${template}-${format === 'story' ? 'stories' : 'square'}-${slug(input.periodLabel, 'periodo')}.png`;

  useEffect(() => {
    current.current = key;
    const cached = cache.current.get(key);
    if (cached) {
      setStatus({ kind: 'ready', card: cached });
      return;
    }
    setStatus({ kind: 'generating' });
    const started = performance.now();
    const connect = input.mode === 'connect';
    void (async () => {
      try {
        const [cover, spotifyLogo] = await Promise.all([
          connect && template === 'basic' ? loadCover(input.coverUrl) : undefined,
          // A atribuição é obrigatória no Conectar: sem o logo, não há card (vira erro).
          connect ? loadSpotifyLogo() : undefined,
        ]);
        const data: CardData = {
          locale,
          t: strings,
          siteLabel: siteLabel(),
          periodLabel: input.periodLabel,
          topArtists: input.topArtists,
          topTracks: input.topTracks,
          heroSub: input.heroSub,
          stat: input.stat,
          stats: input.stats,
          posterName: effectivePoster || undefined,
          cover,
          spotifyLogo,
        };
        const card = await generateCard({ template, format, mode: input.mode, data });
        const ready: Ready = {
          ...card,
          key,
          url: URL.createObjectURL(card.blob),
          file: new File([card.blob], filename, { type: 'image/png' }),
          elapsedMs: Math.round(performance.now() - started),
        };
        cache.current.set(key, ready);
        if (current.current === key) setStatus({ kind: 'ready', card: ready });
      } catch {
        if (current.current === key) setStatus({ kind: 'error' });
      }
    })();
  }, [key, attempt, template, format, effectivePoster, input, locale, strings, filename]);

  // Object URLs das prévias vivem até o modal fechar.
  useEffect(() => {
    const map = cache.current;
    return () => {
      for (const card of map.values()) URL.revokeObjectURL(card.url);
      map.clear();
    };
  }, []);

  // Enquanto a combinação nova não sai, nada de prévia nem de compartilhar o card anterior.
  const ready = status.kind === 'ready' && status.card.key === key ? status.card : null;
  const state = ready ? 'ready' : status.kind === 'error' ? 'error' : 'generating';

  const done = feedback?.key === key ? feedback.message : null;
  const setDone = (message: string) => setFeedback({ key, message });

  const download = () => {
    if (!ready) return;
    downloadBlob(ready.blob, ready.file.name);
    setDone(t('dialog.downloaded'));
  };

  const share = async () => {
    if (!ready) return;
    setSharing(true);
    try {
      await navigator.share({ files: [ready.file] });
      setDone(t('dialog.shared'));
    } catch (error) {
      // Cancelar a folha de compartilhamento não é erro.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        downloadBlob(ready.blob, ready.file.name);
        setDone(t('dialog.shareFallback'));
      }
    } finally {
      setSharing(false);
    }
  };

  const names = input.topArtists.slice(0, 3).join(', ');
  const alt = t('dialog.alt', {
    template: t(`dialog.templates.${template}`),
    names: input.topArtists.length > 3 ? `${names}…` : names,
  });
  const note =
    input.mode === 'connect'
      ? t('dialog.noteConnect')
      : input.mode === 'demo'
        ? t('dialog.noteDemo')
        : t('dialog.noteUpload');
  const busy = state === 'generating';
  const timing = ready
    ? t('dialog.timing', {
        seconds: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
          Math.max(0.1, ready.elapsedMs / 1000),
        ),
      })
    : null;
  const story = format === 'story';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm motion-safe:animate-fade-in" />
        <Dialog.Content
          data-testid="share-dialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus?.current) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
          className={cn(
            'fixed z-50 flex flex-col border border-line bg-surface-2 shadow-e3 outline-none',
            // Mobile: bottom sheet (até 92 dvh, alça, raio só no topo).
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl motion-safe:animate-sheet-in',
            // Desktop: modal de 880 px com duas colunas.
            'lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-1/2 lg:max-h-[min(92dvh,760px)] lg:w-[880px] lg:max-w-[calc(100vw-2rem)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-xl',
          )}
        >
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong lg:hidden"
          />
          <div className="flex items-start justify-between gap-3 px-4 pt-2 lg:px-6 lg:pt-5">
            <div className="flex min-w-0 flex-col gap-1">
              <Dialog.Title
                ref={titleRef}
                tabIndex={-1}
                className="font-display text-h2 outline-none"
              >
                {t('dialog.title')}
              </Dialog.Title>
              <Dialog.Description className="text-body-sm text-fg-muted">
                {t('dialog.lead')}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={t('dialog.close')} className="-mr-2">
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4 lg:flex-row-reverse lg:gap-6 lg:px-6 lg:pb-6">
            <div className="flex flex-col gap-4 lg:w-80 lg:shrink-0">
              <Segmented
                label={t('dialog.templateLabel')}
                value={template}
                onChange={setTemplate}
                options={CARD_TEMPLATES.map((value) => ({
                  value,
                  label: t(`dialog.templates.${value}`),
                }))}
              />
              <Segmented
                label={t('dialog.formatLabel')}
                value={format}
                onChange={setFormat}
                options={CARD_FORMATS.map((value) => ({
                  value,
                  label: t(`dialog.formats.${value}`),
                }))}
              />
              {template === 'festival' ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={posterId} className="text-body-sm font-semibold">
                    {t('dialog.posterLabel')}
                  </label>
                  <input
                    id={posterId}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={POSTER_NAME_MAX * 2}
                    value={poster}
                    placeholder={t('dialog.posterPlaceholder')}
                    onChange={(event) => setPoster(event.currentTarget.value)}
                    aria-invalid={posterError ? true : undefined}
                    aria-describedby={`${posterId}-help${posterError ? ` ${posterId}-error` : ''}`}
                    className={cn(
                      'h-11 w-full min-w-0 rounded-md border bg-surface px-3.5 text-body text-fg placeholder:text-fg-subtle',
                      'focus-visible:border-primary',
                      posterError ? 'border-danger' : 'border-line-strong',
                    )}
                  />
                  <p id={`${posterId}-help`} className="text-caption text-fg-muted">
                    {t('dialog.posterHelp')}
                  </p>
                  {posterError ? (
                    <p
                      id={`${posterId}-error`}
                      className="flex items-start gap-1.5 text-caption text-danger-fg"
                    >
                      <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
                      {posterError}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="hidden text-caption text-fg-muted lg:block">
                {note}
                {timing ? <span className="block text-fg-subtle">{timing}</span> : null}
              </p>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <figure
                aria-label={t('dialog.previewLabel')}
                aria-busy={busy || undefined}
                data-testid="share-preview"
                data-format={format}
                data-template={template}
                data-state={state}
                data-render-ms={ready?.renderMs}
                data-elapsed-ms={ready?.elapsedMs}
                className={cn(
                  'relative flex max-w-full shrink-0 overflow-hidden rounded-md border border-line bg-background',
                  story
                    ? 'aspect-[9/16] h-[min(50dvh,560px)] lg:h-[min(62dvh,600px)]'
                    : 'aspect-square h-[min(50dvh,calc(100vw-2rem),560px)] lg:h-[min(62dvh,480px)]',
                )}
              >
                {ready ? (
                  <img
                    src={ready.url}
                    alt={alt}
                    width={ready.width}
                    height={ready.height}
                    className="size-full object-contain"
                  />
                ) : state === 'error' ? (
                  <div role="alert" className="flex flex-col items-start justify-center gap-3 p-5">
                    <div className="flex items-center gap-2">
                      <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-danger" />
                      <p className="text-h4">{t('dialog.errorTitle')}</p>
                    </div>
                    <p className="text-body-sm text-fg-muted">{t('dialog.errorBody')}</p>
                    <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                      <RotateCcw aria-hidden="true" />
                      {t('dialog.retry')}
                    </Button>
                  </div>
                ) : (
                  <div className="skeleton flex size-full items-center justify-center rounded-none p-4">
                    <p className="text-center text-body-sm font-semibold text-fg-muted">
                      {t('dialog.generating')}
                    </p>
                  </div>
                )}
              </figure>
              <p className="sr-only" aria-live="polite">
                {ready
                  ? t('dialog.ready', {
                      template: t(`dialog.templates.${template}`),
                      format: t(`dialog.formats.${format}`),
                    })
                  : ''}
              </p>
              <p className="flex flex-wrap justify-center gap-x-2 text-center text-caption text-fg-muted lg:hidden">
                <span>{note}</span>
                {timing ? <span className="text-fg-subtle">{timing}</span> : null}
              </p>
            </div>
          </div>

          <div
            data-testid="share-actions"
            className="flex shrink-0 flex-col gap-2 border-t border-line bg-surface-2 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:flex-row lg:items-center lg:justify-end lg:gap-3 lg:rounded-b-xl lg:px-6 lg:pb-5"
          >
            <p
              role="status"
              data-testid="share-done"
              className={cn(
                'order-3 flex items-center justify-center gap-1.5 text-body-sm text-success lg:order-1 lg:mr-auto',
                !done && 'sr-only',
              )}
            >
              {done ? <CircleCheck aria-hidden="true" className="size-4 shrink-0" /> : null}
              {done}
            </p>
            {shareable ? (
              <Button
                variant="secondary"
                size="lg"
                block
                className="order-2 lg:w-auto"
                onClick={download}
                disabled={!ready}
                data-testid="share-download"
              >
                <Download aria-hidden="true" />
                {t('dialog.downloadSecondary')}
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              block
              className="order-1 lg:order-3 lg:w-auto"
              onClick={shareable ? () => void share() : download}
              disabled={!ready || sharing}
              aria-busy={busy || sharing || undefined}
              data-testid={shareable ? 'share-native' : 'share-download'}
            >
              {shareable ? <Share2 aria-hidden="true" /> : <Download aria-hidden="true" />}
              {busy
                ? t('dialog.busy')
                : sharing
                  ? t('dialog.sharing')
                  : shareable
                    ? t('dialog.share')
                    : t('dialog.download')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
