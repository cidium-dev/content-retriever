import {PrismaClient} from '@prisma/client';
import {ResourceType} from '~/package';

const prisma = new PrismaClient();

export type ResourceData = {
  url: string;
  type: ResourceType;
  title?: string;
  content_html?: string;
  content_text: string;
  content_indexed: string;
  lang?: string;
  published_at?: Date;
};

export const upsertResource = async (url: string, data: ResourceData) => {
  return await prisma.resource.upsert({
    where: {url},
    update: {
      title: data.title,
      content_html: data.content_html,
      content_text: data.content_text,
      content_indexed: data.content_indexed,
      published_at: data.published_at,
      lang: data.lang,
      unprocessable: false,
    },
    create: {
      url: url,
      type: data.type,
      title: data.title,
      content_html: data.content_html,
      content_text: data.content_text,
      content_indexed: data.content_indexed,
      published_at: data.published_at,
      lang: data.lang,
      unprocessable: false,
    },
  });
};

export const getResource = async (url: string) => {
  return await prisma.resource.findUnique({where: {url}});
};

export const getResourceMetadata = async (url: string) => {
  return await prisma.resourceMetadata.findUnique({where: {url}});
};

export const upsertResourceMetadata = async (
  url: string,
  metadata: {title: string; type: ResourceType},
) => {
  return await prisma.resourceMetadata.upsert({
    where: {url},
    create: {...metadata, url},
    update: metadata,
  });
};

export const markAsUnprocessable = async (url: string) => {
  return await prisma.resource.upsert({
    where: {url},
    update: {unprocessable: true},
    create: {url, unprocessable: true, type: ResourceType.UNKNOWN},
  });
};
