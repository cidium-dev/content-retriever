import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

export type ResourceData = {
  title?: string;
  contentHtml?: string;
  contentText: string;
  lang?: string;
  publishedAt?: number;
};

export const upsertResource = async (url: string, data: ResourceData) => {
  return await prisma.resource.upsert({
    where: {url},
    update: {
      title: data.title,
      content_html: data.contentHtml,
      content_text: data.contentText,
      published_at: data.publishedAt ? new Date(data.publishedAt) : undefined,
      lang: data.lang,
    },
    create: {
      url: url,
      title: data.title,
      content_html: data.contentHtml,
      content_text: data.contentText,
      published_at: data.publishedAt ? new Date(data.publishedAt) : undefined,
      lang: data.lang,
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
