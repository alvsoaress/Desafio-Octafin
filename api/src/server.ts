import { APP_NAME } from '@consignado/shared';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, () => {
  console.log(`${APP_NAME}: API ouvindo na porta ${port}`);
});
