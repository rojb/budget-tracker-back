// Closed set of icon names an envelope can carry. The client maps each name to a glyph; the
// migration's CHECK constraint lists the same values.
export const ENVELOPE_ICONS = [
  'tag',
  'home',
  'bus',
  'utensils',
  'heartPulse',
  'gift',
  'cart',
  'pill',
  'wifi',
  'settings',
  'ticket',
  'repeat',
  'lifeBuoy',
  'plane',
] as const;

export type EnvelopeIcon = (typeof ENVELOPE_ICONS)[number];

export const DEFAULT_ENVELOPE_ICON: EnvelopeIcon = 'tag';
