import DevelopmentNotice from '@/components/DevelopmentNotice';
import HomeClient from '@/components/HomeClient';
import { getHomeData } from '@/lib/homeData';

export const revalidate = 0;
const SHOW_DEVELOPMENT_NOTICE = false;

export default async function Home() {
  if (SHOW_DEVELOPMENT_NOTICE) {
    return <DevelopmentNotice />;
  }

  const data = await getHomeData();

  return (
    <HomeClient
      paquetes={data.paquetes}
      productosOrdenados={data.productosOrdenados}
      categoriasDestacadas={data.categoriasDestacadas}
      banners={data.banners}
      blogPosts={data.blogPosts}
      experiencias={data.experiencias}
    />
  );
}
