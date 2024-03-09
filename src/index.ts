import {Elysia, t} from 'elysia';
import {logger} from '@bogeychan/elysia-logger';

import extractContent from './lib/extractor';

const app = new Elysia();
const port = process.env.PORT || 3002;

app.use(
  logger({
    transport: {
      target: 'pino-pretty',
      options: {colorize: true},
    },
  })
);

app.post(
  '/api/extract',
  async req => {
    const apiKey = req.headers['x-api-key'];
    const {url} = req.body;

    if (apiKey !== process.env.API_KEY) {
      return new Response('Unauthorized', {status: 401});
    }
    if (!url) {
      return new Response('No URL provided', {status: 400});
    }
    try {
      const content = await extractContent(url);
      return Response.json(content);
    } catch (error) {
      console.error(error);
      return new Response('Error extracting content', {status: 500});
    }
  },
  {body: t.Object({url: t.String()})}
);

app.listen({port, hostname: '0.0.0.0'}, () => {
  console.log(`Server running on port ${port}`);
});
