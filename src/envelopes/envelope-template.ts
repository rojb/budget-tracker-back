import type { EnvelopeIcon } from './envelope-icons.js';

export interface TemplateEnvelope {
  name: string;
  icon: EnvelopeIcon;
}

export interface TemplateGroup {
  name: string;
  envelopes: TemplateEnvelope[];
}

// The suggested starter template (FR-04, screen 35): 4 groups and 12 envelopes, created without a
// goal and with nothing assigned. The same for every plan; served by GET /envelope-template.
export const ENVELOPE_TEMPLATE: readonly TemplateGroup[] = [
  {
    name: 'Obligaciones',
    envelopes: [
      { name: 'Alquiler', icon: 'home' },
      { name: 'Servicios', icon: 'settings' },
      { name: 'Internet y celular', icon: 'wifi' },
    ],
  },
  {
    name: 'Día a día',
    envelopes: [
      { name: 'Transporte', icon: 'bus' },
      { name: 'Supermercado', icon: 'cart' },
      { name: 'Farmacia', icon: 'pill' },
      { name: 'Comida afuera', icon: 'utensils' },
    ],
  },
  {
    name: 'Disfrutar',
    envelopes: [
      { name: 'Salidas', icon: 'ticket' },
      { name: 'Suscripciones', icon: 'repeat' },
      { name: 'Regalos', icon: 'gift' },
    ],
  },
  {
    name: 'Metas',
    envelopes: [
      { name: 'Emergencia', icon: 'lifeBuoy' },
      { name: 'Vacaciones', icon: 'plane' },
    ],
  },
];
