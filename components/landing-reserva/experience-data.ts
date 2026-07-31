import type { Experience } from './types';

export const experience: Experience = {
  id: 'exp-viaggio-tur',
  slug: 'viaggio-tur',
  title: 'VIAGGIO TUR',
  subtitle: 'Más que un viaje, una experiencia que se comparte.',
  supportText: 'Salidas grupales, paquetes a medida y atención personalizada para que concretes el viaje que soñás.',
  topNoticeText: 'Salidas grupales en bus · Excursiones nacionales e internacionales',
  videoOverlayText: 'Consultá disponibilidad y propuestas · Viaggio Tur',
  videoUrl: '/video/video.mp4',
  tiktokVideoId: undefined,
  images: ['/images/1.webp', '/images/2.jpg', '/images/3.jpg', '/images/4.avif', '/images/5.jpg'],
  galleryIntro: 'Momentos reales de viajes y salidas grupales.',
  includes: [
    'Salidas grupales en bus a distintos destinos',
    'Excursiones nacionales e internacionales',
    'Excursiones personalizadas (aéreo, hotelería y excursiones)',
    'Transporte para instituciones y grupos',
    'Asesoramiento y coordinación durante todo el proceso',
  ],
  takeaways: [
    'Atención personalizada antes, durante y después del viaje',
    'Organización clara, simple y sin vueltas',
    'Seguridad y confianza en cada traslado',
    'Opciones para distintos gustos y presupuestos',
    'Experiencias que se disfrutan también en compañía',
  ],
  forWho: [
    'Personas que buscan salidas grupales organizadas',
    'Viajeros que quieren armar un paquete a medida',
    'Escuelas, clubes, instituciones y empresas',
    'Quienes valoran atención cercana y acompañamiento',
  ],
  notForWho: [
    'Si preferís organizar todo sin asistencia',
    'Si no querés coordinación ni acompañamiento',
  ],
  testimonials: [
    {
      name: 'Equipo Viaggio Tur',
      quote: 'Nos apasiona crear itinerarios atractivos y experiencias inolvidables para cada viajero.',
      role: 'Tandil, Buenos Aires',
    },
  ],
  dividerPhrase: 'Más que un viaje, una experiencia que se comparte.',
  calendarIntro: 'Elegí tu fecha ideal. Confirmamos disponibilidad a la brevedad.',
  reservationMicrocopy: 'Te acompañamos antes, durante y después del viaje.',
  faqs: [
    {
      question: '¿Qué servicios ofrecen?',
      answer:
        'Salidas grupales en bus, viajes nacionales e internacionales, paquetes personalizados y transporte para instituciones.',
    },
    {
      question: '¿Arman viajes a medida?',
      answer:
        'Sí. Diseñamos paquetes personalizados según tus fechas, destino, presupuesto y preferencias.',
    },
    {
      question: '¿Trabajan con escuelas e instituciones?',
      answer:
        'Sí. Brindamos servicio de traslado para escuelas, clubes, empresas y grupos con planificación responsable.',
    },
    {
      question: '¿Cómo consulto por una salida?',
      answer:
        'Escribinos por WhatsApp o email y te respondemos con disponibilidad, detalles y opciones.',
    },
    {
      question: '¿Ofrecen viajes internacionales y cruceros?',
      answer:
        'Sí. Además de paquetes en bus, ofrecemos opciones con aéreo, viajes internacionales y cruceros.',
    },
    {
      question: '¿Cuáles son sus horarios de atención?',
      answer:
        'Lunes a Viernes de 8:30 a 12:30 y de 15:00 a 18:30. Sábados de 8:30 a 12:30.',
    },
  ],
  maxPeople: 50,
};
