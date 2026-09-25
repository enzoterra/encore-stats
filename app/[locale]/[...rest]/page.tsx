import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { routing } from '@/i18n/routing';

/**
 * Título da aba no 404. O Next 16 responde o `notFound()` de uma página dinâmica com um shell de
 * erro e o React monta o `not-found.tsx` no cliente a partir do payload desta rota; é o metadata
 * daqui que vale depois disso (o do `not-found.tsx` só vale no shell).
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/[...rest]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'NotFound' });
  return { title: t('metaTitle') };
}

/**
 * Qualquer caminho desconhecido sob `/{locale}` cai aqui e renderiza o `not-found.tsx` do locale,
 * com status 404. Sem esta rota, o Next serviria o 404 padrão pré-renderizado (em inglês e sem o
 * nonce da CSP, então com o JS bloqueado). Assim o 404 passa pelo layout dinâmico, que lê os
 * cabeçalhos, e os scripts recebem o nonce da requisição.
 */
export default function UnknownPage(): never {
  notFound();
}
