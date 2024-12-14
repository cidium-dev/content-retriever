import fastify, {FastifyRequest} from 'fastify';
import cors from '@fastify/cors';
import {z} from 'zod';

import {getResource, markAsUnprocessable, upsertResource} from './lib/db';
import {logger} from './lib/logger';
import extractContent from './lib/extractor';
import isUrl from 'is-url';

const getCachedContent = async (url: string) => {
  const cached = await getResource(url);
  if (!cached) return null;
  if (cached.unprocessable) throw new Error('UNPROCESSABLE');

  return {
    title: cached.title,
    contentHtml: cached.content_html,
    contentText: cached.content_text,
    lang: cached.lang,
    publishedAt: cached.published_at?.getTime(),
  };
};

const extractAndSaveContent = async (url: string) => {
  const content = await extractContent(url);
  if (!content) {
    await markAsUnprocessable(url);
    throw new Error('UNPROCESSABLE');
  }
  await upsertResource(url, content);
  return content;
};

const app = fastify({logger: true});

app.register(cors, {origin: true});

const checkApiKey = (req: FastifyRequest) => {
  const apiKey = req.headers['x-api-key'];
  return apiKey === process.env.API_KEY;
};

const extractSchema = z.object({url: z.string().url()});

app.post('/api/extract', async (req, reply) => {
  if (!checkApiKey(req)) {
    return reply.code(401).send({error: 'UNAUTHORIZED'});
  }
  try {
    const {url} = extractSchema.parse(req.body);

    if (!isUrl(url)) {
      return reply.code(400).send({error: 'INVALID_URL'});
    }
    return (await getCachedContent(url)) || (await extractAndSaveContent(url));
  } catch (error) {
    logger.error(error);

    if ((error as Error).message === 'UNPROCESSABLE') {
      return reply.code(422).send({error: 'UNPROCESSABLE'});
    }
    return reply
      .code(500)
      .send(`Error extracting content: ${(error as Error).message}`);
  }
});

const port = parseInt(process.env.PORT || '3000');

app.listen({port, host: '0.0.0.0'});
