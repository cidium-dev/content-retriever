import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import moment from 'moment';
import {JSDOM} from 'jsdom';
import {franc} from 'franc';
import {Readability, isProbablyReaderable} from '@mozilla/readability';
import {readFileSync} from 'node:fs';

import {getPageContent, getPageContentDirect} from './puppeteer';
import {logger} from './logger';
import {downloadSubtitles, extractVideoId, getVideosMetadata} from './youtube';

enum DocumentType {
  JSON = 'JSON',
  CSV = 'CSV',
  XLSX = 'XLSX',
  DOCX = 'DOCX',
  PDF = 'PDF',
  YOUTUBE = 'YOUTUBE',
  UNKNOWN = 'UNKNOWN',
}

const extractTextFromDocx = async (buffer: Buffer) => {
  const [text, html] = await Promise.all([
    mammoth.extractRawText({buffer}),
    mammoth.convertToHtml({buffer}),
  ]);

  return {
    content: html.value,
    textContent: text.value,
  };
};

const parsePDFDate = (dateStr: string) => {
  const formattedDateStr = dateStr.replace('D:', '');
  const format = 'YYYYMMDDHHmmssZZ';
  return moment(formattedDateStr, format).toDate();
};

const extractTextFromPDF = async (buffer: Buffer) => {
  const data = await pdfParse(buffer);

  return {
    title: data.info.Title,
    textContent: data.text,
    publishedAt: parsePDFDate(data.info.CreationDate).getTime(),
  };
};

const determineContentType = async (url: string): Promise<DocumentType> => {
  const mimeToEnum: Record<string, DocumentType> = {
    'application/json': DocumentType.JSON,
    'text/csv': DocumentType.CSV,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      DocumentType.XLSX,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      DocumentType.DOCX,
    'application/pdf': DocumentType.PDF,
  };

  const extensionToEnum: Record<string, DocumentType> = {
    '.json': DocumentType.JSON,
    '.csv': DocumentType.CSV,
    '.xlsx': DocumentType.XLSX,
    '.docx': DocumentType.DOCX,
    '.pdf': DocumentType.PDF,
  };
  const urlLower = url.toLowerCase();

  if (urlLower.indexOf('youtube.com') !== -1) {
    return DocumentType.YOUTUBE;
  }
  for (const [extension, docType] of Object.entries(extensionToEnum)) {
    if (urlLower.endsWith(extension)) return docType;
  }
  try {
    const response = await fetch(url, {method: 'HEAD'});

    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }
    const contentType = response.headers.get('Content-Type');

    if (contentType) {
      const mimeType = contentType.split(';')[0];
      return (mimeType && mimeToEnum[mimeType]) || DocumentType.UNKNOWN;
    } else {
      throw new Error('Content-Type header is missing');
    }
  } catch (error) {
    logger.error(`Error determining content type: ${error} ${url}`);
    return DocumentType.UNKNOWN;
  }
};

const extractWebpageContent = async (url: string) => {
  const content = await getPageContent(url);
  const doc = new JSDOM(content);

  if (!isProbablyReaderable(doc.window.document)) {
    return undefined;
  }
  const reader = new Readability(doc.window.document);
  const tmp = reader.parse();

  if (!tmp) return undefined;

  return {
    title: tmp.title,
    content: tmp.content,
    textContent: tmp.textContent,
    lang: tmp.lang,
    publishedAt: tmp.publishedTime
      ? new Date(tmp.publishedTime).getTime()
      : undefined,
  };
};

const extractTextFromVTT = (vttContent: string): string => {
  const lines = vttContent.split('\n');
  const textContent: string[] = [];

  for (const line of lines) {
    if (
      line.includes('-->') ||
      line.startsWith('WEBVTT') ||
      line.startsWith('NOTE') ||
      line.trim() === ''
    ) {
      continue;
    }
    textContent.push(line.trim());
  }
  return textContent.join('\n');
};

const getDisplayableVttContent = (vttContent: string): string => {
  const lines = vttContent.trim().split('\n');
  let output = '';

  for (let line of lines) {
    line = line.trim();

    if (line.startsWith('WEBVTT')) {
      output += '## WEBVTT Header\n';
    } else if (line.includes('-->')) {
      const [startTime, endTime] = line.split('-->').map(time => time.trim());
      output += `<div class="timecode">
        <span class="start-time">${startTime}</span>
        <span class="arrow">&#8594;</span>
        <span class="end-time">${endTime}</span>
      </div>\n`;
    } else if (line === '') {
      output += '<br>\n';
    } else {
      output += `<p>${line}</p>\n`;
    }
  }
  return output;
};

const extractYoutubeVideo = async (url: string) => {
  const videoId = extractVideoId(url);
  if (!videoId) return undefined;

  const [[metadata], subtitlesPath] = await Promise.all([
    getVideosMetadata([videoId]),
    downloadSubtitles(videoId),
  ]);
  const subtitles = readFileSync(subtitlesPath, 'utf-8');

  return {
    title: metadata.title || undefined,
    content: getDisplayableVttContent(subtitles),
    textContent: extractTextFromVTT(subtitles),
    lang:
      metadata.defaultAudioLanguage || metadata.defaultLanguage || undefined,
    publishedAt: metadata.publishedAt
      ? new Date(metadata.publishedAt).getTime()
      : undefined,
  };
};

const extractContent = async (url: string) => {
  // url = await resolveRedirects(url);
  const pageType = await determineContentType(url);

  let data:
    | {
        title?: string;
        content?: string;
        textContent: string;
        lang?: string;
        publishedAt?: number;
      }
    | undefined;

  if (pageType === DocumentType.PDF) {
    const buffer = Buffer.from(await getPageContentDirect(url));
    data = await extractTextFromPDF(buffer);
  } else if (pageType === DocumentType.DOCX) {
    const buffer = Buffer.from(await getPageContentDirect(url));
    data = await extractTextFromDocx(buffer);
  } else if (pageType === DocumentType.YOUTUBE) {
    data = await extractYoutubeVideo(url);
  } else {
    data = await extractWebpageContent(url);
  }
  if (!data) return undefined;

  if (!data.title) {
    data.title = url.split('/').pop();
  }
  if (!data.lang && data.textContent) {
    data.lang = franc(data.textContent!);
  }
  return data;
};

export default extractContent;
