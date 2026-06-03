// Movement-specific catalogs for the New Movement wizard (stage 1 dimensions).
// Payment-related data/helpers live in `@/components/payment/paymentData`.
export { eur, parseEur, fmtAmount, parseAmount, todayISO } from '@/components/payment/paymentData';

// Metadata for the accounting dimensions that can appear in the "Dimensiones"
// section. Which ones actually render is decided at runtime by the account's
// header dimensions (the active chart-of-accounts dimensions for FAT, minus the
// ones explicitly hidden) — we never hardcode the list. Option values come from
// real lookups (useDimensionValues); the label/required here drive the field
// chrome. Order follows the AD field order (Organization, Business Partner,
// Project, …).
export const DIM_META = {
  organization: { label: 'Organización', required: true },
  bpartner: { label: 'Contacto' },
  project: { label: 'Proyecto' },
  costcenter: { label: 'Centro de coste' },
  activity: { label: 'Actividad' },
  campaign: { label: 'Campaña' },
  salesregion: { label: 'Región de ventas' },
  user1: { label: 'Dimensión 1º' },
  user2: { label: 'Dimensión 2º' },
};

export const DIM_ORDER = ['organization', 'bpartner', 'project', 'costcenter', 'activity', 'campaign', 'salesregion', 'user1', 'user2'];
