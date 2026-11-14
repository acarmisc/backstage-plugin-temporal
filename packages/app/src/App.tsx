import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { temporalPlugin } from '@acarmisc/backstage-plugin-temporal';
import { navModule } from './modules/nav';

export default createApp({
  features: [catalogPlugin, navModule, temporalPlugin],
});
