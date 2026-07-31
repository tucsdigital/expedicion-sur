import { Timestamp } from 'firebase/firestore';

export type { Experience, Testimonial, FaqItem } from '@/components/landing-reserva/types';

export interface BannerImage {
  desktop: string;
  mobile: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string;
  orden: number;
  destacada: boolean;
  activa: boolean;
  imagen?: string;
  imagenKey?: string;
  imagenTarjeta?: string;
  imagenTarjetaKey?: string;
  imagenPortadaMobile?: string;
  imagenPortadaMobileKey?: string;
  imagenPortadaDesktop?: string;
  imagenPortadaDesktopKey?: string;
  fechaCreacion: Timestamp | Date;
}

export interface Salida {
  id: string;
  fecha: string; // YYYY-MM-DD (fecha de ida)
  fechaVuelta?: string; // YYYY-MM-DD (fecha de vuelta)
  ciudadSalida: string;
  precio: number;
  moneda: 'USD' | 'ARS' | 'EUR';
  cupo?: number;
  observaciones?: string;
}

export interface TicketPack {
  id: string;
  titulo: string;
  descripcion: string;
  moneda: 'USD' | 'ARS' | 'EUR';
  valor: number;
  imagenUrl?: string;
}

export interface PaqueteCondicion {
  titulo: string;
  texto: string;
}

export interface Paquete {
  id: string;
  titulo: string;
  slug: string;
  descripcion: string;
  descripcionCorta?: string;
  etiqueta?: string;
  tags?: string[];
  eventoLugar?: string;
  eventoFecha?: string; // YYYY-MM-DD
  destino?: string; // Se obtiene automáticamente del nombre de la categoría
  categoriaId?: string;
  categoriaIds?: string[];
  tipo:
    | 'individual'
    | 'grupal'
    | 'a-medida'
    | 'internacional'
    | 'educativo'
    | 'eventos'
    | 'recitales'
    | 'excursion'
    | 'navegacion'
    | 'kayak'
    | '4x4'
    | 'trekking'
    | 'cabalgata'
    | 'tirolesa';
  tipos?: Array<
    | 'individual'
    | 'grupal'
    | 'a-medida'
    | 'internacional'
    | 'educativo'
    | 'eventos'
    | 'recitales'
    | 'excursion'
    | 'navegacion'
    | 'kayak'
    | '4x4'
    | 'trekking'
    | 'cabalgata'
    | 'tirolesa'
  >;
  precio: number;
  precioDescuentoPrimerosCupos?: number;
  tarifaEspecialFechaLimite?: string;
  moneda: 'USD' | 'ARS' | 'EUR';
  mostrarDesde: boolean;
  duracion: string;
  incluye: string[];
  tiposTransporte?: string[];
  noIncluye: string[];
  salidas: Salida[];
  imagenPrincipal: string;
  imagenPrincipalKey?: string;
  imagenTarjeta?: string;
  imagenTarjetaKey?: string;
  imagenPortada?: string;
  imagenPortadaKey?: string;
  imagenPortadaMobile?: string;
  imagenPortadaMobileKey?: string;
  imagenPortadaDesktop?: string;
  imagenPortadaDesktopKey?: string;
  galeria: string[];
  galeriaKeys?: string[];
  tickets?: TicketPack[];
  condiciones?: PaqueteCondicion[];
  visible: boolean;
  destacado: boolean;
  fechaCreacion: Timestamp | Date;
  orden: number;
  ctaWhatsApp: boolean;
}

export interface BlogPost {
  id: string;
  titulo: string;
  slug: string;
  extracto: string;
  contenido: string;
  imagenPrincipal?: string;
  imagenTarjeta?: string;
  imagenPortada?: string;
  visible: boolean;
  destacado: boolean;
  orden: number;
  fechaPublicacion: Timestamp | Date;
  fechaCreacion: Timestamp | Date;
}

export interface Consulta {
  id?: string;
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
  paquete?: string;
  paqueteId?: string; // Slug del paquete para construir la URL
  ticketId?: string;
  cantidadPersonas?: number;
  ciudad?: string;
  codigoPostal?: string;
  fechaCreacion: Timestamp | Date;
  leida: boolean;
}
export interface Cliente {
  id: string; // UID de Firebase Auth
  nombre?: string;
  apellido?: string;
  nombreCompleto?: string;
  email: string;
  telefono?: string;
  ciudad?: string;
  codigoPostal?: string;
  cantidadPersonas?: number;
  photoURL?: string;
  provider?: 'password' | 'google';
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}
