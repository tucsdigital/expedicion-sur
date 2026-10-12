import { MetadataRoute } from 'next';
import { collection, getDocs, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getExperiencias } from '@/lib/experiencias-catalog';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://viaggiotur.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/experiencias`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/contacto`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/terminos-condiciones`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ];

  try {
    // Obtener categorías
    const categoriasSnapshot = await getDocs(
      query(collection(db, 'categorias'), firestoreOrderBy('orden', 'asc'))
    );
    
    categoriasSnapshot.docs.forEach((doc) => {
      const categoria = doc.data();
      if (categoria.activa && categoria.slug) {
        routes.push({
          url: `${siteUrl}/destinos/${categoria.slug}`,
          lastModified: categoria.fechaCreacion?.toDate() || new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    });

    // Obtener experiencias del catálogo canónico con respaldo de lectura histórico.
    const experiencias = await getExperiencias();
    experiencias.forEach((experience) => {
      if (experience.visible && experience.slug) {
        routes.push({
          url: `${siteUrl}/experiencia/${experience.slug}`,
          lastModified: (experience.fechaCreacion as any)?.toDate?.() ?? experience.fechaCreacion ?? new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }

  return routes;
}
