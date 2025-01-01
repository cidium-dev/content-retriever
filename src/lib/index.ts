import {getResource, markAsUnprocessable, upsertResource} from './db';
import extractContent from './extractor';

export const getCachedContent = async (url: string) => {
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

export const extractAndSaveContent = async (url: string) => {
  const content = await extractContent(url);
  if (!content) {
    // await markAsUnprocessable(url);
    throw new Error('UNPROCESSABLE');
  }
  await upsertResource(url, content);
  return content;
};
