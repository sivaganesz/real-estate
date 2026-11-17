import { useMatches } from 'react-router';

export interface PageHeading {
  title: string;
  description?: string;
}

/**
 * Routes declare `handle: { page: { title, description } }` (wording from the wireframe);
 * the layout shows it as the page's h1. Pages with a title built from data (a property's
 * name) leave it out and render their own PageHeader.
 */
export function usePageHeading(): PageHeading | null {
  const matches = useMatches();
  const deepest = matches.at(-1)?.handle as { page?: PageHeading } | undefined;
  return deepest?.page ?? null;
}
