import rawConfig from '@/lib/site-config.json';

export type SiteToken = 'siteName' | 'siteDescription' | 'logoTitleText';

export type SiteConfig = {
  branding: {
    siteName: string;
    siteDescription: string;
    siteUrlDefault: string;
    logo: {
      imagePath: string;
      imageUrl?: string;
      titleText: string;
      altTextTemplate?: string;
    };
    palette: {
      primary: string;
      secondary: string;
      success: string;
      successStrong: string;
      dark: string;
      cream: string;
    };
  };
  company: {
    adminEmailDefault: string;
    whatsappMessageDefault: string;
    contact: {
      direccion: string;
      horario: string;
      email: string;
      telefono: string;
      telefonoSecundario?: string;
      whatsappNumber: string;
      mapUrl: string;
    };
    social: {
      facebook: string;
      instagram: string;
      instagramHandle: string;
      threads?: string;
      tiktok?: string;
      whatsappChannel?: string;
      email: string;
    };
    legal: {
      razonSocial: string;
      cuit: string;
      legajoRnav: string;
    };
    developerCredits: {
      name: string;
      url: string;
    };
  };
  features: {
    showContactMap: boolean;
  };
  seo: {
    locale: string;
    titleDefaultTemplate: string;
    titleTemplate: string;
    openGraphImagePath: string;
    keywords: string[];
  };
  content: {
    homeHero: {
      badge: string;
      titlePrefix: string;
      titleAccent: string;
      subtitleTemplate: string;
    };
    packagesSection: {
      badge: string;
      title: string;
      subtitleTemplate: string;
    };
    services: {
      badge: string;
      titlePrefix: string;
      titleAccent: string;
      subtitle: string;
      items: Array<{ icon: string; title: string; desc: string }>;
    };
    values: {
      badge: string;
      title: string;
      subtitle: string;
      items: Array<{ icon: string; number: string; title: string; desc: string }>;
    };
    about: {
      badge: string;
      titlePrefix: string;
      titleAccent: string;
      image: {
        src: string;
        altTemplate: string;
      };
      paragraphs: string[];
    };
    contactBlock: {
      badge: string;
      titlePrefix: string;
      titleAccent: string;
      subtitle: string;
    };
    contactForm: {
      title: string;
      subtitle: string;
      whatsappCta: string;
      image: {
        src: string;
        altTemplate: string;
      };
    };
    footer: {
      taglineTemplate: string;
      copyrightTemplate: string;
    };
  };
};

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type SiteConfigV2 = {
  branding?: { name?: string };
  palette?: { primary?: string; secondary?: string };
  logo?: { url?: string };
  seo?: { title?: string; description?: string; image?: string };
  hero?: { title?: string; tagline?: string };
  contacto?: { email?: string; phone?: string; businessHours?: string; address?: string };
  mapa?: { show?: boolean; address?: string };
  redes?: { items?: Array<{ platform?: string; url?: string }> };
  content?: {
    about?: { paragraphs?: string[] };
    services?: { items?: Array<{ title?: string; description?: string }> };
    values?: { items?: Array<{ title?: string; description?: string }> };
  };
};

function isSiteConfigV2(value: unknown): value is SiteConfigV2 {
  if (!isRecord(value)) return false;
  if (!isRecord(value.branding)) return false;
  return typeof (value.branding as any).name === 'string';
}

type SiteConfigV3 = {
  agencyName?: string;
  heroTagline?: string;
  aboutUs?: string;
  businessHours?: string;
  logoUrl?: string;
  backgroundType?: string;
  backgroundImageUrl?: string;
  contact?: {
    address?: string;
    email?: string;
    phone?: string;
    secondaryPhone?: string;
    whatsappNumber?: string;
    mapUrl?: string;
  };
  services?: Array<{ icon?: string; title?: string; desc?: string; description?: string }>;
  values?: Array<{ icon?: string; number?: string; title?: string; desc?: string; description?: string }>;
  socialLinks?: Array<{ platform?: string; url?: string }>;
  showMap?: boolean;
  siteUrlDefault?: string;
  keywords?: string[];
};

function isSiteConfigV3(value: unknown): value is SiteConfigV3 {
  if (!isRecord(value)) return false;
  return typeof (value as any).agencyName === 'string';
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isRecord(base)) return (override as T) ?? base;
  if (!isRecord(override)) return base;
  const out: Record<string, any> = { ...(base as any) };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const current = out[key];
    if (Array.isArray(current)) {
      out[key] = Array.isArray(value) ? value : current;
      continue;
    }
    if (isRecord(current)) {
      out[key] = deepMerge(current, value);
      continue;
    }
    out[key] = value;
  }
  return out as T;
}

function ensureString(value: unknown, fallback: string, opts?: { allowEmpty?: boolean }) {
  const allowEmpty = opts?.allowEmpty ?? false;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return fallback;
  return trimmed;
}

function ensureBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function ensureStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return value.map((v) => String(v ?? '').trim()).filter((v) => v.length > 0);
}

function normalizeAboutParagraphChunk(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk;
  if (!isRecord(chunk)) return '';

  const text = typeof chunk.text === 'string' ? chunk.text : '';
  const token = typeof chunk.token === 'string' ? `{{${chunk.token}}}` : '';
  const raw = text || token;
  if (!raw) return '';

  return chunk.strong === true ? `**${raw}**` : raw;
}

function normalizeAboutParagraph(value: unknown): string {
  if (typeof value === 'string') return value.trim();

  if (Array.isArray(value)) {
    return value
      .map((chunk) => normalizeAboutParagraphChunk(chunk))
      .join('')
      .trim();
  }

  return normalizeAboutParagraphChunk(value).trim();
}

function ensureAbsoluteUrl(value: unknown, fallback: string) {
  const candidate = ensureString(value, fallback);
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return fallback;
    return u.toString().replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

function pickSocialUrl(items: unknown, platform: string) {
  if (!Array.isArray(items)) return '';
  const want = platform.trim().toLowerCase();
  for (const it of items) {
    if (!isRecord(it)) continue;
    const p = String(it.platform ?? '').trim().toLowerCase();
    if (p === want) return String(it.url ?? '').trim();
  }
  return '';
}

function extractInstagramHandle(url: string) {
  const u = String(url ?? '').trim();
  if (!u) return '';
  const m = u.match(/instagram\.com\/([^/?#]+)/i);
  if (!m?.[1]) return '';
  return `@${m[1]}`;
}

function googleMapsEmbedUrl(address: string) {
  const a = String(address ?? '').trim();
  if (!a) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(a)}&output=embed`;
}

function splitAboutUsToParagraphs(value: unknown) {
  const raw = typeof value === 'string' ? value : '';
  if (!raw.trim()) return [];
  return raw
    .split(/\n+/g)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function toLegacySiteConfigFromV2(v2: SiteConfigV2): Partial<SiteConfig> {
  const siteName = ensureString(v2.branding?.name, DEFAULT_SITE_CONFIG.branding.siteName);
  const siteDescription = ensureString(
    v2.seo?.description,
    ensureString(v2.hero?.tagline, DEFAULT_SITE_CONFIG.branding.siteDescription)
  );

  const primary = ensureString(v2.palette?.primary, DEFAULT_SITE_CONFIG.branding.palette.primary);
  const secondary = ensureString(v2.palette?.secondary, DEFAULT_SITE_CONFIG.branding.palette.secondary);
  const logoUrl = ensureString(v2.logo?.url, '', { allowEmpty: true });
  const ogImage = ensureString(v2.seo?.image, '', { allowEmpty: true });

  const facebook = pickSocialUrl(v2.redes?.items, 'facebook');
  const instagram = pickSocialUrl(v2.redes?.items, 'instagram');

  const address = ensureString(v2.contacto?.address, '', { allowEmpty: true });
  const mapAddress = ensureString(v2.mapa?.address, address, { allowEmpty: true });

  const serviceIcons = ['Users', 'Globe', 'Plane', 'Headphones'];
  const valueIcons = ['Award', 'CheckCircle', 'Sparkles', 'Shield', 'Heart', 'Smile'];

  const services = Array.isArray(v2.content?.services?.items)
    ? v2.content!.services!.items!.map((it, index) => ({
        icon: serviceIcons[index % serviceIcons.length],
        title: ensureString(it?.title, '', { allowEmpty: true }),
        desc: ensureString(it?.description, '', { allowEmpty: true }),
      }))
    : [];

  const values = Array.isArray(v2.content?.values?.items)
    ? v2.content!.values!.items!.map((it, index) => ({
        icon: valueIcons[index % valueIcons.length],
        number: String(index + 1).padStart(2, '0'),
        title: ensureString(it?.title, '', { allowEmpty: true }),
        desc: ensureString(it?.description, '', { allowEmpty: true }),
      }))
    : [];

  return {
    branding: {
      siteName,
      siteDescription,
      siteUrlDefault: DEFAULT_SITE_CONFIG.branding.siteUrlDefault,
      logo: {
        imagePath: DEFAULT_SITE_CONFIG.branding.logo.imagePath,
        imageUrl: logoUrl,
        titleText: siteName,
        altTextTemplate: '{{siteName}} Logo',
      },
      palette: {
        primary,
        secondary,
        success: primary,
        successStrong: primary,
        dark: primary,
        cream: '#FFFFFF',
      },
    },
    company: {
      adminEmailDefault: ensureString(v2.contacto?.email, DEFAULT_SITE_CONFIG.company.adminEmailDefault),
      contact: {
        direccion: address,
        horario: ensureString(v2.contacto?.businessHours, '', { allowEmpty: true }),
        email: ensureString(v2.contacto?.email, '', { allowEmpty: true }),
        telefono: ensureString(v2.contacto?.phone, '', { allowEmpty: true }),
        whatsappNumber: ensureString(v2.contacto?.phone, '', { allowEmpty: true }),
        mapUrl: googleMapsEmbedUrl(mapAddress),
      },
      social: {
        facebook,
        instagram,
        instagramHandle: extractInstagramHandle(instagram),
        email: v2.contacto?.email ? `mailto:${String(v2.contacto.email).trim()}` : '',
      },
      developerCredits: DEFAULT_SITE_CONFIG.company.developerCredits,
      legal: DEFAULT_SITE_CONFIG.company.legal,
      whatsappMessageDefault: DEFAULT_SITE_CONFIG.company.whatsappMessageDefault,
    },
    features: {
      showContactMap: typeof v2.mapa?.show === 'boolean' ? v2.mapa.show : DEFAULT_SITE_CONFIG.features.showContactMap,
    },
    seo: {
      locale: DEFAULT_SITE_CONFIG.seo.locale,
      titleDefaultTemplate: ensureString(v2.seo?.title, '{{siteName}}'),
      titleTemplate: DEFAULT_SITE_CONFIG.seo.titleTemplate,
      openGraphImagePath: ogImage || DEFAULT_SITE_CONFIG.seo.openGraphImagePath,
      keywords: DEFAULT_SITE_CONFIG.seo.keywords,
    },
    content: {
      homeHero: {
        badge: '',
        titlePrefix: '',
        titleAccent: ensureString(v2.hero?.title, siteName),
        subtitleTemplate: ensureString(v2.hero?.tagline, siteDescription),
      },
      services: {
        badge: 'Servicios',
        titlePrefix: 'Nuestros',
        titleAccent: 'Servicios',
        subtitle: '',
        items: services,
      },
      values: {
        badge: 'Valores',
        title: '¿Por qué elegirnos?',
        subtitle: '',
        items: values,
      },
      about: {
        badge: 'Sobre Nosotros',
        titlePrefix: 'Nuestra',
        titleAccent: 'historia',
        image: DEFAULT_SITE_CONFIG.content.about.image,
        paragraphs: Array.isArray(v2.content?.about?.paragraphs) ? v2.content!.about!.paragraphs!.map((p) => String(p ?? '').trim()) : [],
      },
      contactForm: DEFAULT_SITE_CONFIG.content.contactForm,
      contactBlock: DEFAULT_SITE_CONFIG.content.contactBlock,
      packagesSection: DEFAULT_SITE_CONFIG.content.packagesSection,
      footer: DEFAULT_SITE_CONFIG.content.footer,
    },
  };
}

function toLegacySiteConfigFromV3(v3: SiteConfigV3): Partial<SiteConfig> {
  const siteName = ensureString(v3.agencyName, DEFAULT_SITE_CONFIG.branding.siteName);
  const siteDescription = ensureString(v3.heroTagline, DEFAULT_SITE_CONFIG.branding.siteDescription);
  const logoUrl = ensureString(v3.logoUrl, '', { allowEmpty: true });

  const address = ensureString(v3.contact?.address, '', { allowEmpty: true });
  const businessHours = ensureString(v3.businessHours, '', { allowEmpty: true });
  const email = ensureString(v3.contact?.email, '', { allowEmpty: true });
  const phone = ensureString(v3.contact?.phone, '', { allowEmpty: true });
  const secondaryPhone = ensureString(v3.contact?.secondaryPhone, '', { allowEmpty: true });
  const whatsappNumber = ensureString(v3.contact?.whatsappNumber, phone, { allowEmpty: true });
  const mapUrl =
    ensureString(v3.contact?.mapUrl, '', { allowEmpty: true }) || googleMapsEmbedUrl(address);

  const socialItems = v3.socialLinks;
  const facebook = pickSocialUrl(socialItems, 'facebook');
  const instagram = pickSocialUrl(socialItems, 'instagram');
  const threads = pickSocialUrl(socialItems, 'threads');
  const tiktok = pickSocialUrl(socialItems, 'tiktok');
  const whatsappChannel = pickSocialUrl(socialItems, 'whatsapp') || pickSocialUrl(socialItems, 'whatsappchannel');

  const serviceIcons = ['Users', 'Globe', 'Plane', 'Headphones'];
  const valueIcons = ['Award', 'CheckCircle', 'Sparkles', 'Shield', 'Heart', 'Smile'];

  const services = Array.isArray(v3.services)
    ? v3.services
        .map((it, index) => ({
          icon: ensureString(it?.icon, serviceIcons[index % serviceIcons.length]),
          title: ensureString(it?.title, '', { allowEmpty: true }),
          desc: ensureString(it?.desc, ensureString(it?.description, '', { allowEmpty: true }), { allowEmpty: true }),
        }))
        .filter((it) => it.title.trim().length > 0 || it.desc.trim().length > 0)
    : [];

  const values = Array.isArray(v3.values)
    ? v3.values
        .map((it, index) => ({
          icon: ensureString(it?.icon, valueIcons[index % valueIcons.length]),
          number: ensureString(it?.number, String(index + 1).padStart(2, '0'), { allowEmpty: true }),
          title: ensureString(it?.title, '', { allowEmpty: true }),
          desc: ensureString(it?.desc, ensureString(it?.description, '', { allowEmpty: true }), { allowEmpty: true }),
        }))
        .filter((it) => it.title.trim().length > 0 || it.desc.trim().length > 0)
    : [];

  const aboutParagraphs = splitAboutUsToParagraphs(v3.aboutUs);

  return {
    branding: {
      siteName,
      siteDescription,
      siteUrlDefault: ensureAbsoluteUrl(v3.siteUrlDefault, DEFAULT_SITE_CONFIG.branding.siteUrlDefault),
      logo: {
        imagePath: DEFAULT_SITE_CONFIG.branding.logo.imagePath,
        imageUrl: logoUrl,
        titleText: siteName,
        altTextTemplate: '{{siteName}} Logo',
      },
      palette: DEFAULT_SITE_CONFIG.branding.palette,
    },
    company: {
      adminEmailDefault: email || DEFAULT_SITE_CONFIG.company.adminEmailDefault,
      whatsappMessageDefault: DEFAULT_SITE_CONFIG.company.whatsappMessageDefault,
      contact: {
        direccion: address,
        horario: businessHours,
        email,
        telefono: phone,
        telefonoSecundario: secondaryPhone,
        whatsappNumber,
        mapUrl,
      },
      social: {
        facebook,
        instagram,
        instagramHandle: extractInstagramHandle(instagram),
        threads,
        tiktok,
        whatsappChannel,
        email: email ? `mailto:${email}` : '',
      },
      developerCredits: DEFAULT_SITE_CONFIG.company.developerCredits,
      legal: DEFAULT_SITE_CONFIG.company.legal,
    },
    features: {
      showContactMap: ensureBoolean(v3.showMap, DEFAULT_SITE_CONFIG.features.showContactMap),
    },
    seo: {
      locale: DEFAULT_SITE_CONFIG.seo.locale,
      titleDefaultTemplate: '{{siteName}}',
      titleTemplate: DEFAULT_SITE_CONFIG.seo.titleTemplate,
      openGraphImagePath: logoUrl || DEFAULT_SITE_CONFIG.seo.openGraphImagePath,
      keywords: ensureStringArray(v3.keywords, DEFAULT_SITE_CONFIG.seo.keywords),
    },
    content: {
      homeHero: {
        badge: DEFAULT_SITE_CONFIG.content.homeHero.badge,
        titlePrefix: DEFAULT_SITE_CONFIG.content.homeHero.titlePrefix,
        titleAccent: siteName,
        subtitleTemplate: siteDescription,
      },
      services: {
        badge: DEFAULT_SITE_CONFIG.content.services.badge,
        titlePrefix: DEFAULT_SITE_CONFIG.content.services.titlePrefix,
        titleAccent: DEFAULT_SITE_CONFIG.content.services.titleAccent,
        subtitle: DEFAULT_SITE_CONFIG.content.services.subtitle,
        items: services,
      },
      values: {
        badge: DEFAULT_SITE_CONFIG.content.values.badge,
        title: DEFAULT_SITE_CONFIG.content.values.title,
        subtitle: DEFAULT_SITE_CONFIG.content.values.subtitle,
        items: values,
      },
      about: {
        badge: DEFAULT_SITE_CONFIG.content.about.badge,
        titlePrefix: DEFAULT_SITE_CONFIG.content.about.titlePrefix,
        titleAccent: DEFAULT_SITE_CONFIG.content.about.titleAccent,
        image: DEFAULT_SITE_CONFIG.content.about.image,
        paragraphs: aboutParagraphs,
      },
      contactForm: DEFAULT_SITE_CONFIG.content.contactForm,
      contactBlock: DEFAULT_SITE_CONFIG.content.contactBlock,
      packagesSection: DEFAULT_SITE_CONFIG.content.packagesSection,
      footer: DEFAULT_SITE_CONFIG.content.footer,
    },
  };
}

const DEFAULT_SITE_CONFIG: SiteConfig = {
  branding: {
    siteName: 'Expedición Sur',
    siteDescription: 'Experiencias auténticas, excursiones, traslados y paquetes personalizados para descubrir el sur argentino.',
    siteUrlDefault: 'https://expedicionsur.com',
    logo: {
      imagePath: '/images/logo-expedicion-sur.png',
      imageUrl: '',
      titleText: 'Expedición Sur',
      altTextTemplate: '{{siteName}} Logo',
    },
    palette: {
      primary: '#E30613',
      secondary: '#CBBBA0',
      success: '#CA9E67',
      successStrong: '#8E6B45',
      dark: '#111111',
      cream: '#F7F2EA',
    },
  },
  company: {
    adminEmailDefault: 'reservas@expedicionsur.com',
    whatsappMessageDefault: 'Hola! Quiero reservar una experiencia en Patagonia: ',
    contact: {
      direccion: '',
      horario: '',
      email: '',
      telefono: '',
      telefonoSecundario: '',
      whatsappNumber: '',
      mapUrl: '',
    },
    social: {
      facebook: '',
      instagram: '',
      instagramHandle: '',
      threads: '',
      tiktok: '',
      whatsappChannel: '',
      email: '',
    },
    legal: {
      razonSocial: '',
      cuit: '',
      legajoRnav: '',
    },
    developerCredits: {
      name: 'Tucs Digital',
      url: '',
    },
  },
  features: {
    showContactMap: true,
  },
  seo: {
    locale: 'es_AR',
    titleDefaultTemplate: '{{siteName}}',
    titleTemplate: '%s | {{siteName}}',
    openGraphImagePath: '/og-image.jpg',
    keywords: [],
  },
  content: {
    homeHero: {
      badge: 'Explorá',
      titlePrefix: '',
      titleAccent: '',
      subtitleTemplate: '{{siteDescription}}',
    },
    packagesSection: {
      badge: 'Excursiones',
      title: 'Excursiones destacadas',
      subtitleTemplate: 'Encontrá tu próxima escapada con {{siteName}}.',
    },
    services: {
      badge: 'Servicios',
      titlePrefix: 'Nuestros',
      titleAccent: 'Servicios',
      subtitle: 'Te acompañamos antes, durante y después de tu viaje.',
      items: [],
    },
    values: {
      badge: 'Valores',
      title: '¿Por qué elegirnos?',
      subtitle: 'Confianza, experiencia y atención personalizada.',
      items: [],
    },
    about: {
      badge: 'Sobre Nosotros',
      titlePrefix: 'Nuestra',
      titleAccent: 'historia',
      image: {
        src: '/images/hero1.webp',
        altTemplate: 'Equipo de {{siteName}}',
      },
      paragraphs: [],
    },
    contactBlock: {
      badge: 'Contacto',
      titlePrefix: 'Hablemos',
      titleAccent: 'hoy',
      subtitle: 'Escribinos por WhatsApp o email y te respondemos a la brevedad.',
    },
    contactForm: {
      title: 'Escribinos',
      subtitle: 'Contanos tu idea de viaje y te ayudamos a armarla.',
      whatsappCta: 'Abrir WhatsApp',
      image: {
        src: '/images/3.jpg',
        altTemplate: '{{siteName}}',
      },
    },
    footer: {
      taglineTemplate: '{{siteDescription}}',
      copyrightTemplate: '© {{year}} {{logoTitleText}}. Todos los derechos reservados.',
    },
  },
};

function normalizeSiteConfig(input: SiteConfig): SiteConfig {
  const siteName = ensureString(input.branding?.siteName, DEFAULT_SITE_CONFIG.branding.siteName);
  const siteDescription = ensureString(input.branding?.siteDescription, DEFAULT_SITE_CONFIG.branding.siteDescription);
  const siteUrlDefault = ensureAbsoluteUrl(input.branding?.siteUrlDefault, DEFAULT_SITE_CONFIG.branding.siteUrlDefault);

  const logoTitleText = ensureString(
    input.branding?.logo?.titleText,
    ensureString(siteName, DEFAULT_SITE_CONFIG.branding.logo.titleText)
  );

  return {
    branding: {
      siteName,
      siteDescription,
      siteUrlDefault,
      logo: {
        imagePath: ensureString(input.branding?.logo?.imagePath, DEFAULT_SITE_CONFIG.branding.logo.imagePath),
        imageUrl: ensureString(input.branding?.logo?.imageUrl, '', { allowEmpty: true }),
        titleText: logoTitleText,
        altTextTemplate: ensureString(
          input.branding?.logo?.altTextTemplate,
          DEFAULT_SITE_CONFIG.branding.logo.altTextTemplate || '{{siteName}} Logo'
        ),
      },
      palette: {
        primary: ensureString(input.branding?.palette?.primary, DEFAULT_SITE_CONFIG.branding.palette.primary),
        secondary: ensureString(input.branding?.palette?.secondary, DEFAULT_SITE_CONFIG.branding.palette.secondary),
        success: ensureString(input.branding?.palette?.success, DEFAULT_SITE_CONFIG.branding.palette.success),
        successStrong: ensureString(input.branding?.palette?.successStrong, DEFAULT_SITE_CONFIG.branding.palette.successStrong),
        dark: ensureString(input.branding?.palette?.dark, DEFAULT_SITE_CONFIG.branding.palette.dark),
        cream: ensureString(input.branding?.palette?.cream, DEFAULT_SITE_CONFIG.branding.palette.cream),
      },
    },
    company: {
      adminEmailDefault: ensureString(input.company?.adminEmailDefault, DEFAULT_SITE_CONFIG.company.adminEmailDefault),
      whatsappMessageDefault: ensureString(input.company?.whatsappMessageDefault, DEFAULT_SITE_CONFIG.company.whatsappMessageDefault),
      contact: {
        direccion: ensureString(input.company?.contact?.direccion, DEFAULT_SITE_CONFIG.company.contact.direccion, { allowEmpty: true }),
        horario: ensureString(input.company?.contact?.horario, DEFAULT_SITE_CONFIG.company.contact.horario, { allowEmpty: true }),
        email: ensureString(input.company?.contact?.email, DEFAULT_SITE_CONFIG.company.contact.email, { allowEmpty: true }),
        telefono: ensureString(input.company?.contact?.telefono, DEFAULT_SITE_CONFIG.company.contact.telefono, { allowEmpty: true }),
        whatsappNumber: ensureString(input.company?.contact?.whatsappNumber, DEFAULT_SITE_CONFIG.company.contact.whatsappNumber, { allowEmpty: true }),
        mapUrl: ensureString(input.company?.contact?.mapUrl, DEFAULT_SITE_CONFIG.company.contact.mapUrl, { allowEmpty: true }),
      },
      social: {
        facebook: ensureString(input.company?.social?.facebook, DEFAULT_SITE_CONFIG.company.social.facebook, { allowEmpty: true }),
        instagram: ensureString(input.company?.social?.instagram, DEFAULT_SITE_CONFIG.company.social.instagram, { allowEmpty: true }),
        instagramHandle: ensureString(input.company?.social?.instagramHandle, DEFAULT_SITE_CONFIG.company.social.instagramHandle, { allowEmpty: true }),
        threads: ensureString(input.company?.social?.threads, '', { allowEmpty: true }),
        tiktok: ensureString(input.company?.social?.tiktok, '', { allowEmpty: true }),
        email: ensureString(input.company?.social?.email, DEFAULT_SITE_CONFIG.company.social.email, { allowEmpty: true }),
      },
      legal: {
        razonSocial: ensureString(input.company?.legal?.razonSocial, DEFAULT_SITE_CONFIG.company.legal.razonSocial, { allowEmpty: true }),
        cuit: ensureString(input.company?.legal?.cuit, DEFAULT_SITE_CONFIG.company.legal.cuit, { allowEmpty: true }),
        legajoRnav: ensureString(input.company?.legal?.legajoRnav, DEFAULT_SITE_CONFIG.company.legal.legajoRnav, { allowEmpty: true }),
      },
      developerCredits: {
        name: ensureString(input.company?.developerCredits?.name, DEFAULT_SITE_CONFIG.company.developerCredits.name),
        url: ensureString(input.company?.developerCredits?.url, DEFAULT_SITE_CONFIG.company.developerCredits.url, { allowEmpty: true }),
      },
    },
    features: {
      showContactMap: ensureBoolean(input.features?.showContactMap, DEFAULT_SITE_CONFIG.features.showContactMap),
    },
    seo: {
      locale: ensureString(input.seo?.locale, DEFAULT_SITE_CONFIG.seo.locale),
      titleDefaultTemplate: ensureString(input.seo?.titleDefaultTemplate, DEFAULT_SITE_CONFIG.seo.titleDefaultTemplate),
      titleTemplate: ensureString(input.seo?.titleTemplate, DEFAULT_SITE_CONFIG.seo.titleTemplate),
      openGraphImagePath: ensureString(input.seo?.openGraphImagePath, DEFAULT_SITE_CONFIG.seo.openGraphImagePath),
      keywords: ensureStringArray(input.seo?.keywords, DEFAULT_SITE_CONFIG.seo.keywords),
    },
    content: {
      homeHero: {
        badge: ensureString(input.content?.homeHero?.badge, DEFAULT_SITE_CONFIG.content.homeHero.badge, { allowEmpty: true }),
        titlePrefix: ensureString(input.content?.homeHero?.titlePrefix, DEFAULT_SITE_CONFIG.content.homeHero.titlePrefix, { allowEmpty: true }),
        titleAccent: ensureString(input.content?.homeHero?.titleAccent, DEFAULT_SITE_CONFIG.content.homeHero.titleAccent, { allowEmpty: true }),
        subtitleTemplate: ensureString(input.content?.homeHero?.subtitleTemplate, DEFAULT_SITE_CONFIG.content.homeHero.subtitleTemplate),
      },
      packagesSection: {
        badge: ensureString(input.content?.packagesSection?.badge, DEFAULT_SITE_CONFIG.content.packagesSection.badge, { allowEmpty: true }),
        title: ensureString(input.content?.packagesSection?.title, DEFAULT_SITE_CONFIG.content.packagesSection.title, { allowEmpty: true }),
        subtitleTemplate: ensureString(input.content?.packagesSection?.subtitleTemplate, DEFAULT_SITE_CONFIG.content.packagesSection.subtitleTemplate, { allowEmpty: true }),
      },
      services: {
        badge: ensureString(input.content?.services?.badge, DEFAULT_SITE_CONFIG.content.services.badge, { allowEmpty: true }),
        titlePrefix: ensureString(input.content?.services?.titlePrefix, DEFAULT_SITE_CONFIG.content.services.titlePrefix, { allowEmpty: true }),
        titleAccent: ensureString(input.content?.services?.titleAccent, DEFAULT_SITE_CONFIG.content.services.titleAccent, { allowEmpty: true }),
        subtitle: ensureString(input.content?.services?.subtitle, DEFAULT_SITE_CONFIG.content.services.subtitle, { allowEmpty: true }),
        items: Array.isArray(input.content?.services?.items)
          ? input.content.services.items
              .map((it: any) => ({
                icon: ensureString(it?.icon, 'Users'),
                title: ensureString(it?.title, '', { allowEmpty: true }),
                desc: ensureString(it?.desc, '', { allowEmpty: true }),
              }))
              .filter((it: any) => it.title.trim().length > 0 || it.desc.trim().length > 0)
          : [],
      },
      values: {
        badge: ensureString(input.content?.values?.badge, DEFAULT_SITE_CONFIG.content.values.badge, { allowEmpty: true }),
        title: ensureString(input.content?.values?.title, DEFAULT_SITE_CONFIG.content.values.title, { allowEmpty: true }),
        subtitle: ensureString(input.content?.values?.subtitle, DEFAULT_SITE_CONFIG.content.values.subtitle, { allowEmpty: true }),
        items: Array.isArray(input.content?.values?.items)
          ? input.content.values.items
              .map((it: any) => ({
                icon: ensureString(it?.icon, 'Award'),
                number: ensureString(it?.number, '', { allowEmpty: true }),
                title: ensureString(it?.title, '', { allowEmpty: true }),
                desc: ensureString(it?.desc, '', { allowEmpty: true }),
              }))
              .filter((it: any) => it.title.trim().length > 0 || it.desc.trim().length > 0)
          : [],
      },
      about: {
        badge: ensureString(input.content?.about?.badge, DEFAULT_SITE_CONFIG.content.about.badge, { allowEmpty: true }),
        titlePrefix: ensureString(input.content?.about?.titlePrefix, DEFAULT_SITE_CONFIG.content.about.titlePrefix, { allowEmpty: true }),
        titleAccent: ensureString(input.content?.about?.titleAccent, DEFAULT_SITE_CONFIG.content.about.titleAccent, { allowEmpty: true }),
        image: {
          src: ensureString(input.content?.about?.image?.src, DEFAULT_SITE_CONFIG.content.about.image.src),
          altTemplate: ensureString(input.content?.about?.image?.altTemplate, DEFAULT_SITE_CONFIG.content.about.image.altTemplate),
        },
        paragraphs: Array.isArray(input.content?.about?.paragraphs)
          ? input.content.about.paragraphs
              .map((v: unknown) => normalizeAboutParagraph(v))
              .filter((v: string) => v.length > 0)
          : [],
      },
      contactBlock: {
        badge: ensureString(input.content?.contactBlock?.badge, DEFAULT_SITE_CONFIG.content.contactBlock.badge, { allowEmpty: true }),
        titlePrefix: ensureString(input.content?.contactBlock?.titlePrefix, DEFAULT_SITE_CONFIG.content.contactBlock.titlePrefix, { allowEmpty: true }),
        titleAccent: ensureString(input.content?.contactBlock?.titleAccent, DEFAULT_SITE_CONFIG.content.contactBlock.titleAccent, { allowEmpty: true }),
        subtitle: ensureString(input.content?.contactBlock?.subtitle, DEFAULT_SITE_CONFIG.content.contactBlock.subtitle, { allowEmpty: true }),
      },
      contactForm: {
        title: ensureString(input.content?.contactForm?.title, DEFAULT_SITE_CONFIG.content.contactForm.title, { allowEmpty: true }),
        subtitle: ensureString(input.content?.contactForm?.subtitle, DEFAULT_SITE_CONFIG.content.contactForm.subtitle, { allowEmpty: true }),
        whatsappCta: ensureString(input.content?.contactForm?.whatsappCta, DEFAULT_SITE_CONFIG.content.contactForm.whatsappCta),
        image: {
          src: ensureString(input.content?.contactForm?.image?.src, DEFAULT_SITE_CONFIG.content.contactForm.image.src),
          altTemplate: ensureString(input.content?.contactForm?.image?.altTemplate, DEFAULT_SITE_CONFIG.content.contactForm.image.altTemplate),
        },
      },
      footer: {
        taglineTemplate: ensureString(input.content?.footer?.taglineTemplate, DEFAULT_SITE_CONFIG.content.footer.taglineTemplate),
        copyrightTemplate: ensureString(input.content?.footer?.copyrightTemplate, DEFAULT_SITE_CONFIG.content.footer.copyrightTemplate),
      },
    },
  };
}

const legacyRawConfig = isSiteConfigV3(rawConfig)
  ? toLegacySiteConfigFromV3(rawConfig)
  : isSiteConfigV2(rawConfig)
    ? toLegacySiteConfigFromV2(rawConfig)
    : (rawConfig as Partial<SiteConfig>);

export const siteConfig: SiteConfig = normalizeSiteConfig(deepMerge(DEFAULT_SITE_CONFIG, legacyRawConfig) as SiteConfig);

export function getHomeBackgroundImageFallbackUrl() {
  if (!isSiteConfigV3(rawConfig)) return '';
  const config = rawConfig as SiteConfigV3;
  const type = String(config.backgroundType ?? '').trim().toLowerCase();
  if (type !== 'imagen') return '';
  return ensureString(config.backgroundImageUrl, '', { allowEmpty: true });
}

export function resolveTokenValue(token: SiteToken): string {
  if (token === 'siteName') return siteConfig.branding.siteName;
  if (token === 'siteDescription') return siteConfig.branding.siteDescription;
  return siteConfig.branding.logo.titleText;
}

export function renderTemplate(template: string, vars?: Record<string, string>) {
  if (typeof template !== 'string' || template.length === 0) return '';
  const baseVars: Record<string, string> = {
    siteName: siteConfig.branding.siteName,
    siteDescription: siteConfig.branding.siteDescription,
    logoTitleText: siteConfig.branding.logo.titleText,
    year: String(new Date().getFullYear()),
    ...(vars ?? {}),
  };

  return Object.entries(baseVars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template
  );
}

export function getBrandLogoSrc() {
  const candidate = (siteConfig.branding.logo.imageUrl || '').trim();
  const local = (siteConfig.branding.logo.imagePath || '').trim();
  if (candidate.length > 0) return candidate;
  if (local.length > 0) return local;
  return DEFAULT_SITE_CONFIG.branding.logo.imagePath;
}

export function isRemoteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

export function getBrandLogoAbsolute(siteUrl: string) {
  const src = getBrandLogoSrc();
  if (isRemoteUrl(src)) return src;
  return `${siteUrl}${src}`;
}

export function getOpenGraphImageAbsolute(siteUrl: string) {
  const src = String(siteConfig.seo.openGraphImagePath ?? '').trim();
  if (!src) return `${siteUrl}${DEFAULT_SITE_CONFIG.seo.openGraphImagePath}`;
  if (isRemoteUrl(src)) return src;
  return `${siteUrl}${src}`;
}

export function getSiteIconSrc() {
  const logoUrl = String(siteConfig.branding.logo.imageUrl ?? '').trim();
  if (logoUrl) return logoUrl;
  const og = String(siteConfig.seo.openGraphImagePath ?? '').trim();
  if (og) return og;
  return getBrandLogoSrc();
}

export function getSiteIconAbsolute(siteUrl: string) {
  const src = getSiteIconSrc();
  if (isRemoteUrl(src)) return src;
  return `${siteUrl}${src}`;
}
