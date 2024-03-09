import type {VercelRequest, VercelResponse} from '@vercel/node';
import extractContent from '../lib/extractor';

export async function POST(request: VercelRequest, response: VercelResponse) {
  const apiKey = request.headers['x-api-key'];
  const {url} = request.body;

  if (apiKey !== process.env.API_KEY) {
    return response.status(401).send('Unauthorized');
  }
  if (!url) {
    return response.status(400).send('No URL provided');
  }
  try {
    const content = await extractContent(url);
    return response.json(content);
  } catch (error) {
    console.error(error);
    return response.status(500).send('Error extracting content');
  }
}
