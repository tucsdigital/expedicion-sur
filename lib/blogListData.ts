import { collection, getDocs, query, orderBy as firestoreOrderBy, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { BannerImage, BlogPost } from '@/types';

async function fetchVisibleOrdered<T>(collectionName: string, maxItems: number) {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, collectionName),
        where('visible', '==', true),
        firestoreOrderBy('orden', 'asc'),
        limit(maxItems)
      )
    );

    return snapshot.docs.map((doc) => serializeFirestoreData<T>({ id: doc.id, ...doc.data() }));
  } catch (error) {
    const snapshot = await getDocs(query(collection(db, collectionName), where('visible', '==', true)));
    return snapshot.docs
      .map((doc) => serializeFirestoreData<T>({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0))
      .slice(0, maxItems);
  }
}

export async function getBlogListData() {
  const [posts, bannersSnapshot] = await Promise.all([
    fetchVisibleOrdered<BlogPost>('blog', 12),
    getDocs(query(collection(db, 'banners'), firestoreOrderBy('orden', 'asc'))),
  ]);

  const fallbackBannerUrl = '/images/hero-placeholder.svg';

  const banners = bannersSnapshot.docs
    .map(
      (doc) =>
        doc.data() as {
          imageUrl?: string;
          imageUrlMobile?: string;
          imageUrlDesktop?: string;
          activa?: boolean;
          target?: 'home' | 'blog' | 'both';
        }
    )
    .filter((banner) => {
      const desktop = banner.imageUrlDesktop || banner.imageUrl;
      const mobile = banner.imageUrlMobile || banner.imageUrlDesktop || banner.imageUrl;
      if (banner.activa === false || (!desktop && !mobile)) return false;
      const target = banner.target || 'home';
      return target === 'blog' || target === 'both';
    })
    .map(
      (banner) =>
        ({
          desktop: (banner.imageUrlDesktop || banner.imageUrl || fallbackBannerUrl) as string,
          mobile: (banner.imageUrlMobile || banner.imageUrlDesktop || banner.imageUrl || fallbackBannerUrl) as string,
        }) satisfies BannerImage
    );

  return { posts, banners };
}
