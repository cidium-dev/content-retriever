import {Elysia, t} from 'elysia';
import {logger as loggerPlugin} from '@bogeychan/elysia-logger';

import extractContent from './lib/extractor';
import {logger} from './lib/logger';
import {ChatModel, getTokenCount} from './lib/tokens';

const app = new Elysia();
const port = process.env.PORT || 3000;

app.use(
  loggerPlugin({transport: {target: 'pino-pretty', options: {colorize: true}}}),
);

app.post(
  '/api/count',
  async req => {
    const {text, model} = req.body;

    if (!text || !model) {
      return new Response('No text provided', {status: 400});
    }
    if (!(model in ChatModel)) {
      return new Response('Invalid model', {status: 400});
    }
    const count = getTokenCount(text, model as ChatModel);
    return new Response(JSON.stringify({count}), {status: 200});
  },
  {body: t.Object({text: t.String(), model: t.String()})},
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
  {body: t.Object({url: t.String()})},
);

app.listen({port, hostname: '0.0.0.0'}, () => {
  console.log(`Server running on port ${port}`);
});
