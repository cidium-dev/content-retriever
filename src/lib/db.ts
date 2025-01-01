import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

export type ExtractedContent = {
  title?: string;
  content_html?: string;
  content_text: string;
  lang?: string;
  published_at?: Date;
};

export const upsertResource = async (url: string, data: ExtractedContent) => {
  return await prisma.resource.upsert({
    where: {url},
    update: {
      title: data.title,
      content_html: data.content_html,
      content_text: data.content_html,
      published_at: data.published_at,
      lang: data.lang,
      unprocessable: false,
    },
    create: {
      url: url,
      title: data.title,
      content_html: data.content_html,
      content_text: data.content_text,
      published_at: data.published_at,
      lang: data.lang,
      unprocessable: false,
    },
  });
};

export const getResource = async (url: string) => {
  return await prisma.resource.findUnique({where: {url}});
};

export const markAsUnprocessable = async (url: string) => {
  return await prisma.resource.upsert({
    where: {url},
    update: {unprocessable: true},
    create: {url, unprocessable: true},
  });
};
