import {
  getResource,
  markAsUnprocessable,
  upsertResource,
  upsertResourceMetadata,
} from './db';
import {extractContent, extractMetadata} from './extractor';

export const getCachedContent = async (url: string) => {
  const cached = await getResource(url);
  if (!cached) return null;
  if (cached.unprocessable) throw new Error('UNPROCESSABLE');

  return {
    url: cached.url,
    type: cached.type,
    title: cached.title,
    content_indexed: cached.content_indexed,
    content_html: cached.content_html,
    content_text: cached.content_text,
    lang: cached.lang,
    published_at: cached.published_at?.getTime(),
  };
};

export const extractAndSaveContent = async (url: string) => {
  const content = await extractContent(url);
  if (!content) {
    await markAsUnprocessable(url);
    throw new Error('UNPROCESSABLE');
  }
  await upsertResource(url, content);
  return content;
};

export const extractAndSaveMetadata = async (url: string) => {
  const content = await extractMetadata(url);

  if (content.title) {
    await upsertResourceMetadata(url, content);
  }
  return content;
};
