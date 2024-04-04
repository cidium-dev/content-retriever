import {Elysia, t} from 'elysia';
import {logger as loggerPlugin} from '@bogeychan/elysia-logger';

import extractContent from './lib/extractor';
import {logger} from './lib/logger';
import {getTokenCount} from './lib/tokens';

const app = new Elysia();
const port = process.env.PORT || 3000;

app.use(
  loggerPlugin({transport: {target: 'pino-pretty', options: {colorize: true}}})
);

app.get('/api/count', async req => {
  const {text} = req.query;

  if (!text) {
    return new Response('No text provided', {status: 400});
  }
  const count = getTokenCount(text);
  return new Response(JSON.stringify({count}), {status: 200});
});

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
    logger.info(`Extracting content from ${url}`);
    try {
      const content = await extractContent(url);

      if (!content) {
        return Response.json({error: 'UNPROCESSABLE'}, {status: 422});
      }
      return Response.json(content);
    } catch (error) {
      logger.error(error);
      return new Response('Error extracting content', {status: 500});
    }
  },
  {body: t.Object({url: t.String()})}
);

app.listen({port, hostname: '0.0.0.0'}, () => {
  console.log(`Server running on port ${port}`);
});
