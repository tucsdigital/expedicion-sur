import { siteConfig } from '../lib/siteConfig';
import { writeFileSync } from 'fs';
writeFileSync(new URL('./site-config.resuelto.json', import.meta.url), JSON.stringify(siteConfig, null, 2));
console.log('ok');
