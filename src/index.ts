import Fastify, {type FastifyRequest} from 'fastify';
import cors from '@fastify/cors';
import {z} from 'zod';
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod';
import {
  extractAndSaveContent,
  extractAndSaveMetadata,
  getCachedContent,
} from '~/lib';
import {getResourceMetadata} from './lib/db';
import {renderMarkdownToHtml} from './lib/markdown';

const fastify = Fastify({logger: true});

void fastify.setValidatorCompiler(validatorCompiler);
void fastify.setSerializerCompiler(serializerCompiler);

void fastify.register(cors, {origin: true});

const checkApiKey = (req: FastifyRequest) => {
  const apiKey = req.headers['x-api-key'];
  return apiKey === process.env.API_KEY;
};

fastify.post(
  '/api/extract',
  {schema: {body: z.object({url: z.string().url()})}},
  async (req: FastifyRequest<{Body: {url: string}}>, reply) => {
    if (!checkApiKey(req)) {
      return reply.code(401).send({error: 'UNAUTHORIZED'});
    }
    const url = req.body.url;
    const cached = await getCachedContent(url);

    if (cached) {
      return cached;
    }
    return await extractAndSaveContent(url);
  },
);

fastify.post(
  '/api/metadata',
  {schema: {body: z.object({url: z.string().url()})}},
  async (req: FastifyRequest<{Body: {url: string}}>, reply) => {
    if (!checkApiKey(req)) {
      return reply.code(401).send({error: 'UNAUTHORIZED'});
    }
    const url = req.body.url;
    const cached = await getResourceMetadata(url);

    if (cached) {
      return cached;
    }
    return await extractAndSaveMetadata(url);
  },
);

fastify.post(
  '/api/markdownToHtml',
  {schema: {body: z.object({markdown: z.string()})}},
  async (req: FastifyRequest<{Body: {markdown: string}}>, reply) => {
    if (!checkApiKey(req)) {
      return reply.code(401).send({error: 'UNAUTHORIZED'});
    }
    return {html: await renderMarkdownToHtml(req.body.markdown)};
  },
);

fastify.setErrorHandler(async (error, request, reply) => {
  fastify.log.error(
    {err: error, stack: error.stack, message: error.message},
    'Request failed',
  );
  console.error(error);
  await reply
    .status(500)
    .send({error: `Internal Server Error: ${error.message}`});
});

const port = parseInt(process.env.PORT || '3002');

fastify.listen({port, host: '0.0.0.0'}, () => {
  console.log(`Server is running on port ${port}`);
});
