import Fastify, {type FastifyRequest} from 'fastify';
import cors from '@fastify/cors';
import {z} from 'zod';
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod';

import {extractAndSaveContent, getCachedContent} from './lib';

const fastify = Fastify({logger: true});

void fastify.setValidatorCompiler(validatorCompiler);
void fastify.setSerializerCompiler(serializerCompiler);

void fastify.register(cors, {origin: true});

const checkApiKey = (req: FastifyRequest) => {
  const apiKey = req.headers['x-api-key'];
  return apiKey === process.env.API_KEY;
};

const ZExtractRquestBody = z.object({url: z.string().url()});
export type ExtractRequestBody = z.infer<typeof ZExtractRquestBody>;

fastify.post(
  '/api/extract',
  {schema: {body: ZExtractRquestBody}},
  async (req: FastifyRequest<{Body: ExtractRequestBody}>, reply) => {
    if (!checkApiKey(req)) {
      return reply.code(401).send({error: 'UNAUTHORIZED'});
    }
    const url = req.body.url;
    return (await getCachedContent(url)) || (await extractAndSaveContent(url));
  },
);

fastify.setErrorHandler(async (error, request, reply) => {
  fastify.log.error(
    {err: error, stack: error.stack, message: error.message},
    'Request failed',
  );
  await reply.status(500).send({error: 'Internal Server Error'});
});

const port = parseInt(process.env.PORT || '3002');

fastify.listen({port, host: '0.0.0.0'}, () => {
  console.log(`Server is running on port ${port}`);
});
