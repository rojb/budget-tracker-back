import { fileURLToPath } from 'node:url';

// The fixed set of suggested goal photos (FR-41, screen 50): the same for everyone, in this order.
// The files are the design's photos, committed under `assets/suggested-photos/`; there is nothing
// to seed in the database. Each file is resolved from this module, so it is the same from
// `src/envelopes` (nest start) and from `dist/envelopes` (the build). One literal `new URL` per file
// lets Vercel's file tracer ship them with the function; a computed path would not be traced.
export const PHOTO_SUGGESTION_IDS = [
  'vacaciones',
  'auto',
  'emergencia',
  'mudanza',
] as const;
export type PhotoSuggestionId = (typeof PHOTO_SUGGESTION_IDS)[number];

export interface PhotoSuggestion {
  id: PhotoSuggestionId;
  name: string;
  file: string;
}

export const PHOTO_SUGGESTIONS: readonly PhotoSuggestion[] = [
  {
    id: 'vacaciones',
    name: 'Vacaciones',
    file: fileURLToPath(
      new URL('../../assets/suggested-photos/vacaciones.jpg', import.meta.url),
    ),
  },
  {
    id: 'auto',
    name: 'Auto',
    file: fileURLToPath(
      new URL('../../assets/suggested-photos/auto.jpg', import.meta.url),
    ),
  },
  {
    id: 'emergencia',
    name: 'Emergencia',
    file: fileURLToPath(
      new URL('../../assets/suggested-photos/emergencia.jpg', import.meta.url),
    ),
  },
  {
    id: 'mudanza',
    name: 'Mudanza',
    file: fileURLToPath(
      new URL('../../assets/suggested-photos/mudanza.jpg', import.meta.url),
    ),
  },
];

export function findPhotoSuggestion(id: string): PhotoSuggestion | undefined {
  return PHOTO_SUGGESTIONS.find((suggestion) => suggestion.id === id);
}

export function suggestionImagePath(id: PhotoSuggestionId): string {
  return `/envelope-photo-suggestions/${id}/image`;
}
