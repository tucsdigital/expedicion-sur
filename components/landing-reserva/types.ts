export type Testimonial = {
  name: string;
  quote: string;
  role?: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type BookingDate = {
  date: string; // "2025-02-15" (YYYY-MM-DD)
  capacity: number;
  enabled: boolean;
};

/** Códigos de moneda soportados (Stripe: ars, brl, usd). */
export type BookingCurrency = 'ars' | 'brl' | 'usd';

export type BookingConfig = {
  enabled: boolean;
  title: string;
  subtitle1: string;
  subtitle2: string;
  hasSpecificDates: boolean;
  dates: BookingDate[];
  depositAmount: number;
  /** Si no se define, en el front no se muestra límite (hasta 50 personas). */
  maxPeoplePerBooking?: number;
  /** Moneda para Stripe y PIX (ars, brl, usd). */
  currency: BookingCurrency;
  paymentMethods: {
    stripe: boolean;
    pix: boolean;
  };
  /** Comisión por referido específica de la excursión. Si no está definida, se usa la del vendedor. */
  referralCommission?: {
    type: 'percent' | 'fixed';
    value: number;
    currency: BookingCurrency;
  };
};

export type ReservationStatus = 'pending' | 'reserved' | 'completed' | 'cancelled';

export type ReservationAttachment = {
  id: string;
  url: string;
  key?: string;
  name?: string;
  type?: string;
  uploadedBy: 'admin' | 'user';
  createdAt: object;
};

export type ReservationHistoryItem = {
  status: ReservationStatus;
  actor: 'admin' | 'system';
  note?: string;
  createdAt: object;
};

export type ReservationPricingSnapshot = {
  /** Precio unitario en moneda (ej. 10 BRL). Puede ser null si se desconoce. */
  unitPrice: number | null;
  /** Precio unitario en centavos (Stripe). Puede ser null si se desconoce. */
  unitAmount: number | null;
  people: number;
  amountTotal: number;
  currency: string;
  paymentMethod: 'stripe' | 'pix' | 'admin';
};

export type ReservationCapacitySnapshot = {
  date: string;
  /** Cupo base configurado para esa fecha en bookingConfig.dates[].capacity. */
  baseCapacity: number;
  maxPeoplePerBooking: number | null;
  hasSpecificDates: boolean;
  enabled: boolean;
};

export type ReservationExperienceSnapshot = {
  id: string;
  slug: string;
  title: string;
};

export type ReservationReferralInfo = {
  vendorId: string;
  vendorName: string;
  code?: string;
  channel?: 'link' | 'manual' | 'other';
  commissionType: 'percent' | 'fixed';
  commissionValue: number;
  commissionCurrency: 'ars' | 'brl' | 'usd';
  commissionAmount: number;
  payoutStatus: 'pending' | 'accrued' | 'paid' | 'cancelled';
  payoutAt?: object;
};

export type Reservation = {
  id: string;
  experienceId: string;
  experienceSlug: string;
  experienceTitle: string;
  /** Fecha de la experiencia: YYYY-MM-DD o "sin-fecha" */
  date: string;
  people: number;
  /** Monto total pagado en centavos (Stripe) */
  amountTotal: number;
  currency: string;
  paymentMethod: 'stripe' | 'pix' | 'admin';
  stripeSessionId?: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  customerCountry?: string;
  customerDocument?: string;
  customerComments?: string;
  attachments?: ReservationAttachment[];
  statusHistory?: ReservationHistoryItem[];
  /** Fecha de creación de la reserva (compra). En Firestore es Timestamp. */
  createdAt: object;
  updatedAt?: object;
  status: ReservationStatus;
  createdByAdmin?: boolean;
  referredBy?: ReservationReferralInfo;

  /** Auditoría / trazabilidad */
  checkoutIntentId?: string | null;
  pricingSnapshot?: ReservationPricingSnapshot;
  capacitySnapshot?: ReservationCapacitySnapshot;
  experienceSnapshot?: ReservationExperienceSnapshot;
};

/** Datos públicos del bloque reserva para el front (available = capacity por ahora, luego descontar reservas). */
export type BookingPublicData = {
  enabled: boolean;
  title: string;
  subtitle1: string;
  subtitle2: string;
  hasSpecificDates: boolean;
  dates: { date: string; capacity: number; available: number; enabled: boolean }[];
  depositAmount: number;
  /** Si no se define, en el front no se muestra "Máximo X personas" (techo 50). */
  maxPeoplePerBooking?: number;
  currency: BookingCurrency;
  paymentMethods: { stripe: boolean; pix: boolean };
};

export type Experience = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  supportText: string;
  topNoticeText: string;
  videoOverlayText: string;
  videoUrl?: string;
  /** URL de video de YouTube (ej. https://youtube.com/watch?v=xxx) */
  youtubeVideoUrl?: string;
  tiktokVideoId?: string;
  /** Video entre reserva/calendario y FAQ (misma lógica que el del hero) */
  midVideoUrl?: string;
  midYoutubeVideoUrl?: string;
  midTiktokVideoId?: string;
  midVideoOverlayText?: string;
  /** Imagen usada en las cards del sitio. Si no existe, se usa images[0] (retrocompatibilidad). */
  cardImage?: string;
  cardImageKey?: string;
  /** Galería de imágenes adicionales para la página de la experiencia (no incluye banner). */
  images: string[];
  imageKeys?: string[];
  galleryIntro: string;
  includes: string[];
  takeaways: string[];
  forWho: string[];
  notForWho: string[];
  testimonials: Testimonial[];
  dividerPhrase: string;
  calendarIntro: string;
  reservationMicrocopy: string;
  faqs: FaqItem[];
  /** Fechas disponibles para reserva (YYYY-MM-DD) — legacy, preferir bookingConfig.dates */
  availableDates?: string[];
  price?: number;
  maxPeople?: number;
  orden?: number;
  visible?: boolean;
  /** Métodos de pago habilitados — legacy, preferir bookingConfig.paymentMethods */
  paymentMethods?: ('stripe' | 'pix')[];
  /** Configuración completa del bloque Reserva / Calendario */
  bookingConfig?: BookingConfig;
}
