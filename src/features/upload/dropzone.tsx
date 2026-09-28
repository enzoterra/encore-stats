'use client';

import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type DragEvent, useRef, useState } from 'react';

import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';

export type DragState = 'none' | 'valid' | 'invalid';

const ACCEPTED_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'multipart/x-zip',
  'application/json',
  'text/json',
  '',
]);

/** No `dragover` só dá para ver o tipo MIME, não o nome; tipo vazio (comum) conta como válido. */
function dragValidity(event: DragEvent): DragState {
  const items = Array.from(event.dataTransfer?.items ?? []);
  if (items.length === 0) return 'valid';
  return items.every((item) => item.kind === 'file' && ACCEPTED_TYPES.has(item.type))
    ? 'valid'
    : 'invalid';
}

/**
 * Arrastar e soltar de arquivos num elemento (dropzone do Upload e convite das curtidas):
 * devolve o estado do arrasto e os handlers para espalhar no elemento.
 */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [drag, setDrag] = useState<DragState>('none');
  const depth = useRef(0);

  const handlers = {
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      depth.current++;
      setDrag(dragValidity(event));
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDrag('none');
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      depth.current = 0;
      setDrag('none');
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
  };
  return { drag, handlers };
}

/** `accept` do `<input type=file>`: zips e JSONs do Spotify. */
export const FILE_ACCEPT = '.zip,.json,application/zip,application/json';

/** Arquivos escolhidos no `<input>`; limpa o valor para poder escolher o mesmo arquivo de novo. */
export function takeFiles(input: HTMLInputElement): File[] {
  const files = Array.from(input.files ?? []);
  input.value = '';
  return files;
}

/**
 * Dropzone (10-design.md §8.10): `<label>` que envolve um `input type=file` (teclado e leitor de
 * tela funcionam como num input comum), com arrastar e soltar. Aceita vários .zip/.json: o
 * histórico completo e, opcionalmente, o "Dados da conta" no mesmo envio.
 */
export function Dropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const t = useTranslations('Upload.dropzone');
  const { drag, handlers } = useFileDrop(onFiles);

  const message =
    drag === 'valid' ? t('dragValid') : drag === 'invalid' ? t('dragInvalid') : t('idle');

  return (
    <label
      data-testid="dropzone"
      data-drag={drag}
      {...handlers}
      className={cn(
        'group flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 bg-surface p-8 text-center transition-colors duration-(--duration-fast) ease-standard',
        'has-[:focus-visible]:border-primary-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
        drag === 'none' && 'border-dashed border-line-strong hover:border-primary-fg',
        drag === 'valid' && 'border-solid border-primary bg-primary/8',
        drag === 'invalid' && 'border-solid border-danger',
      )}
    >
      <Upload
        aria-hidden="true"
        strokeWidth={1.75}
        className={cn(
          'size-10 transition-transform duration-(--duration-fast)',
          drag === 'invalid' ? 'text-danger' : 'text-primary',
          drag === 'valid' && 'motion-safe:scale-105',
        )}
      />
      <span aria-live="polite" className="font-display text-h3">
        {message}
      </span>
      <span className="text-body-sm text-fg-muted">{t('or')}</span>
      <span aria-hidden="true" className={buttonClasses({ variant: 'primary', size: 'lg' })}>
        {t('choose')}
      </span>
      <input
        type="file"
        multiple
        accept={FILE_ACCEPT}
        aria-label={t('inputLabel')}
        aria-describedby="dropzone-help"
        className="sr-only"
        onChange={(event) => {
          const files = takeFiles(event.currentTarget);
          if (files.length > 0) onFiles(files);
        }}
      />
      <span id="dropzone-help" className="max-w-sm text-caption text-fg-muted">
        {t('help')}
      </span>
    </label>
  );
}
