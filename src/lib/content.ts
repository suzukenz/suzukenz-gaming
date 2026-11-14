import { getCollection, type CollectionEntry } from 'astro:content';

export type Guide = CollectionEntry<'guides'>;
export type Game = CollectionEntry<'games'>;

export function guideUrl(guide: Guide): string {
  return `/games/${guide.data.game.id}/guides/${guide.data.slug}/`;
}

export async function getVisibleGuides(): Promise<Guide[]> {
  const guides = await getCollection(
    'guides',
    ({ data }) => import.meta.env.DEV || !data.draft,
  );
  const urls = new Set<string>();
  for (const guide of guides) {
    const url = guideUrl(guide);
    if (urls.has(url)) throw new Error(`記事のURLが重複しています: ${url}`);
    urls.add(url);
  }
  return guides.sort(
    (a, b) =>
      (b.data.updatedAt ?? b.data.publishedAt).getTime() -
      (a.data.updatedAt ?? a.data.publishedAt).getTime(),
  );
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(date);
}
