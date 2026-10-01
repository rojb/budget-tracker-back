import { fileURLToPath } from 'node:url';

// The fixed set of suggested goal photos (FR-41, screen 50): the same for everyone, in this order.
// The files are the design's photos, committed under `assets/suggested-photos/`; there is nothing
// to seed in the database. The folder is resolved from this module, so it is the same from
// `src/envelopes` (nest start) and from `dist/envelopes` (the build).
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

const DIRECTORY = fileURLToPath(
  new URL('../../assets/suggested-photos/', import.meta.url),
);

export const PHOTO_SUGGESTIONS: readonly PhotoSuggestion[] = [
  { id: 'vacaciones', name: 'Vacaciones', file: `${DIRECTORY}vacaciones.jpg` },
  { id: 'auto', name: 'Auto', file: `${DIRECTORY}auto.jpg` },
  { id: 'emergencia', name: 'Emergencia', file: `${DIRECTORY}emergencia.jpg` },
  { id: 'mudanza', name: 'Mudanza', file: `${DIRECTORY}mudanza.jpg` },
];

export function findPhotoSuggestion(id: string): PhotoSuggestion | undefined {
  return PHOTO_SUGGESTIONS.find((suggestion) => suggestion.id === id);
}

export function suggestionImagePath(id: PhotoSuggestionId): string {
  return `/envelope-photo-suggestions/${id}/image`;
}
