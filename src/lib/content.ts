import { getCollection, type CollectionEntry } from 'astro:content';

export type Guide = CollectionEntry<'guides'>;
export type Game = CollectionEntry<'games'>;

export function gamePageTitle(game: Game): string {
  return `${game.data.title}攻略メモ`;
}

export function guideUrl(guide: Guide): string {
  return `/${guide.data.game.id}/guides/${guide.data.slug}/`;
}

export async function getGuides(): Promise<Guide[]> {
  const guides = await getCollection('guides');
  const urls = new Set<string>();
  for (const guide of guides) {
    const url = guideUrl(guide);
    if (urls.has(url)) throw new Error(`記事のURLが重複しています: ${url}`);
    urls.add(url);
  }
  return guides;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(date);
}
