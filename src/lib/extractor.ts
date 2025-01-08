import {readFileSync} from 'node:fs';
import officeparser from 'officeparser';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import {JSDOM} from 'jsdom';
import {franc} from 'franc';
import {Readability} from '@mozilla/readability';
import {PDFExtract} from 'pdf.js-extract';

import type {ResourceData} from './db';
import {ResourceType} from '~/package';

import youtube from '~/services/youtube';
import browser from '~/services/browser';

import {resolveRedirects} from '~/utils/redirects';
import {cleanWebVtt, getWebVttHtml} from '~/utils/vtt';
import indexing from '~/utils/indexing';

const extensionToEnum: Record<string, ResourceType> = {
  '.json': ResourceType.JSON,
  '.csv': ResourceType.CSV,
  '.xlsx': ResourceType.XLSX,
  '.docx': ResourceType.DOCX,
  '.pptx': ResourceType.PPTX,
  '.odt': ResourceType.ODT,
  '.odp': ResourceType.ODP,
  '.ods': ResourceType.ODS,
  '.pdf': ResourceType.PDF,
};

const mimeToEnum: Record<string, ResourceType> = {
  'application/json': ResourceType.JSON,
  'text/csv': ResourceType.CSV,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    ResourceType.XLSX,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    ResourceType.DOCX,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    ResourceType.PPTX,
  'application/vnd.oasis.opendocument.text': ResourceType.ODT,
  'application/vnd.oasis.opendocument.presentation': ResourceType.ODP,
  'application/vnd.oasis.opendocument.spreadsheet': ResourceType.ODS,
  'application/pdf': ResourceType.PDF,
};

const determineContentTypeFromUrl = (url: string): ResourceType => {
  const urlLower = url.toLowerCase();

  if (urlLower.indexOf('youtube.com') !== -1) {
    return ResourceType.YOUTUBE;
  }
  for (const [extension, docType] of Object.entries(extensionToEnum)) {
    if (urlLower.endsWith(extension)) return docType;
  }
  return ResourceType.UNKNOWN;
};

const determineContentTypeFromMime = async (
  url: string,
): Promise<ResourceType> => {
  try {
    const response = await fetch(url, {method: 'HEAD'});

    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }
    const contentType = response.headers.get('Content-Type');

    if (contentType) {
      const mimeType = contentType.split(';')[0];
      return (mimeType && mimeToEnum[mimeType]) || ResourceType.UNKNOWN;
    } else {
      throw new Error('Content-Type header is missing');
    }
  } catch (error) {
    return ResourceType.UNKNOWN;
  }
};

const determineContentType = async (url: string): Promise<ResourceType> => {
  const urlType = determineContentTypeFromUrl(url);

  if (urlType !== ResourceType.UNKNOWN) {
    return urlType;
  }
  return determineContentTypeFromMime(url);
};

const extractWebpageContent = async (
  url: string,
): Promise<ResourceData | undefined> => {
  const content = await browser.getPageContent(url);
  console.log(content);
  const doc = new JSDOM(content);

  // if (!isProbablyReaderable(doc.window.document)) {
  //   return undefined;
  // }
  const reader = new Readability(doc.window.document);
  const tmp = reader.parse();

  if (!tmp) return undefined;

  const contentHtml = tmp.content ? String(tmp.content).trim() : undefined;
  const contentText = tmp.textContent.trim();
  const contentIndexed = indexing.indexContent(contentText);

  return {
    url: url,
    type: ResourceType.WEB,
    title: tmp.title ? String(tmp.title).trim() : undefined,
    content_html: contentHtml,
    content_text: contentText,
    content_indexed: contentIndexed,
    lang: tmp.lang ? String(tmp.lang).trim() : undefined,
    published_at: tmp.publishedTime ? new Date(tmp.publishedTime) : undefined,
  };
};

const extractDocx = async (url: string): Promise<ResourceData> => {
  const buffer = await browser.getPageContentDirect(url);

  const [textResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({buffer}),
    mammoth.convertToHtml({buffer}),
  ]);
  const indexed = indexing.indexContent(textResult.value);

  return {
    url: url,
    type: ResourceType.DOCX,
    content_html: htmlResult.value,
    content_text: textResult.value,
    content_indexed: indexed,
  };
};

const extractXlsx = async (url: string): Promise<ResourceData> => {
  const buffer = await browser.getPageContentDirect(url);
  const workbook = XLSX.read(buffer);

  const sheetsTxt = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    return XLSX.utils.sheet_to_txt(sheet);
  });
  const sheetsHtml = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    return `Sheet: ${name}\n${XLSX.utils.sheet_to_html(sheet)}`;
  });
  const contentHtml = sheetsHtml.join('\n\n');
  const contentText = sheetsTxt.join('\n\n');
  const contentIndexed = indexing.indexXlsxContent(contentText);

  return {
    url: url,
    type: ResourceType.XLSX,
    title: workbook.Props?.Title,
    content_html: contentHtml,
    content_text: contentText,
    content_indexed: contentIndexed,
    lang: workbook.Props?.Language,
    published_at: workbook.Props?.ModifiedDate,
  };
};

const extractPdf = async (url: string): Promise<ResourceData> => {
  const buffer = await browser.getPageContentDirect(url);

  const pdfExtract = new PDFExtract();
  const data = await pdfExtract.extractBuffer(buffer);

  const contentText = data.pages
    .map(
      (page, idx) =>
        `Page ${idx + 1}:\n${page.content.map(item => item.str).join(' ')}`,
    )
    .join('\n\n');
  const contentIndexed = indexing.indexContent(contentText);

  return {
    url: url,
    type: ResourceType.PDF,
    content_text: contentText,
    content_indexed: contentIndexed,
  };
};

const extractDoc = async (
  url: string,
  buffer: Buffer,
): Promise<ResourceData> => {
  const contentText = await officeparser.parseOfficeAsync(buffer);
  const contentIndexed = indexing.indexContent(contentText);

  return {
    url: url,
    type: ResourceType.UNKNOWN,
    content_text: contentText,
    content_indexed: contentIndexed,
  };
};

const extractYoutubeVideo = async (
  url: string,
): Promise<ResourceData | undefined> => {
  const videoId = youtube.extractVideoId(url);
  if (!videoId) return undefined;

  const [[metadata], subtitlesPath] = await Promise.all([
    youtube.getVideosMetadata([videoId]),
    youtube.downloadSubtitles(videoId),
  ]);
  const subtitles = readFileSync(subtitlesPath, 'utf-8');

  const contentText = cleanWebVtt(subtitles);
  const contentHtml = getWebVttHtml(subtitles);
  const contentIndexed = indexing.indexWebVttContent(subtitles);

  const lang =
    metadata.defaultAudioLanguage || metadata.defaultLanguage || undefined;

  const publishedAt = metadata.publishedAt
    ? new Date(metadata.publishedAt)
    : undefined;

  return {
    url: url,
    type: ResourceType.YOUTUBE,
    title: metadata.title || undefined,
    content_html: contentHtml,
    content_text: contentText,
    content_indexed: contentIndexed,
    lang: lang,
    published_at: publishedAt,
  };
};

const extractContent = async (
  url: string,
): Promise<ResourceData | undefined> => {
  url = await resolveRedirects(url);
  const pageType = await determineContentType(url);

  let data: ResourceData | undefined;

  if (pageType === ResourceType.DOCX) {
    data = await extractDocx(url);
  } else if (pageType === ResourceType.PDF) {
    data = await extractPdf(url);
  } else if (pageType === ResourceType.XLSX) {
    data = await extractXlsx(url);
  } else if (
    pageType === ResourceType.PPTX ||
    pageType === ResourceType.ODT ||
    pageType === ResourceType.ODP ||
    pageType === ResourceType.ODS
  ) {
    const buffer = await browser.getPageContentDirect(url);
    data = await extractDoc(url, buffer);
  } else if (pageType === ResourceType.JSON) {
    const content = (await browser.getPageContentDirect(url)).toString();
    data = {
      url: url,
      type: ResourceType.JSON,
      content_text: content,
      content_indexed: indexing.indexJsonContent(content),
    };
  } else if (pageType === ResourceType.YOUTUBE) {
    data = await extractYoutubeVideo(url);
  } else {
    data = await extractWebpageContent(url);
  }
  if (!data) return undefined;

  if (!data.title) {
    data.title = url.split('/').pop();
  }
  if (!data.lang && data.content_text) {
    data.lang = franc(data.content_text!);
  }
  return data;
};

export default extractContent;
