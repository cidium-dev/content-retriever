import officeparser from 'officeparser';
import mammoth from 'mammoth';
import {JSDOM} from 'jsdom';
import {franc} from 'franc';
import * as XLSX from 'xlsx';
import {Readability} from '@mozilla/readability';
import {readFileSync} from 'node:fs';
import {PDFExtract} from 'pdf.js-extract';

import {getPageContent, getPageContentDirect} from './puppeteer';
import {downloadSubtitles, extractVideoId, getVideosMetadata} from './youtube';
import {resolveRedirects} from './redirects';
import {logger} from './logger';

type ExtractedContent = {
  title?: string;
  contentHtml?: string;
  contentTxt: string;
  lang?: string;
  publishedAt?: number;
};

enum DocumentType {
  JSON = 'JSON',
  CSV = 'CSV',
  XLSX = 'XLSX',
  DOCX = 'DOCX',
  PPTX = 'PPTX',
  ODT = 'ODT',
  ODP = 'ODP',
  ODS = 'ODS',
  PDF = 'PDF',
  YOUTUBE = 'YOUTUBE',
  UNKNOWN = 'UNKNOWN',
}

const extensionToEnum: Record<string, DocumentType> = {
  '.json': DocumentType.JSON,
  '.csv': DocumentType.CSV,
  '.xlsx': DocumentType.XLSX,
  '.docx': DocumentType.DOCX,
  '.pptx': DocumentType.PPTX,
  '.odt': DocumentType.ODT,
  '.odp': DocumentType.ODP,
  '.ods': DocumentType.ODS,
  '.pdf': DocumentType.PDF,
};

const mimeToEnum: Record<string, DocumentType> = {
  'application/json': DocumentType.JSON,
  'text/csv': DocumentType.CSV,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    DocumentType.XLSX,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    DocumentType.DOCX,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    DocumentType.PPTX,
  'application/vnd.oasis.opendocument.text': DocumentType.ODT,
  'application/vnd.oasis.opendocument.presentation': DocumentType.ODP,
  'application/vnd.oasis.opendocument.spreadsheet': DocumentType.ODS,
  'application/pdf': DocumentType.PDF,
};

const determineContentTypeFromUrl = (url: string): DocumentType => {
  const urlLower = url.toLowerCase();

  if (urlLower.indexOf('youtube.com') !== -1) {
    return DocumentType.YOUTUBE;
  }
  for (const [extension, docType] of Object.entries(extensionToEnum)) {
    if (urlLower.endsWith(extension)) return docType;
  }
  return DocumentType.UNKNOWN;
};

const determineContentTypeFromMime = async (
  url: string,
): Promise<DocumentType> => {
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

const determineContentType = async (url: string): Promise<DocumentType> => {
  const urlType = determineContentTypeFromUrl(url);

  if (urlType !== DocumentType.UNKNOWN) {
    return urlType;
  }
  return determineContentTypeFromMime(url);
};

const extractWebpageContent = async (
  url: string,
): Promise<ExtractedContent | undefined> => {
  try {
    const content = await getPageContent(url);
    const doc = new JSDOM(content);

    // if (!isProbablyReaderable(doc.window.document)) {
    //   return undefined;
    // }
    const reader = new Readability(doc.window.document);
    const tmp = reader.parse();

    if (!tmp) return undefined;

    return {
      title: tmp.title ? String(tmp.title).trim() : undefined,
      contentHtml: tmp.content ? String(tmp.content).trim() : undefined,
      contentTxt: tmp.textContent.trim(),
      lang: tmp.lang ? String(tmp.lang).trim() : undefined,
      publishedAt: tmp.publishedTime
        ? new Date(tmp.publishedTime).getTime()
        : undefined,
    };
  } catch (error) {
    logger.error(`Error extracting webpage content: ${error} ${url}`);
    throw error;
  }
};

const extractDocx = async (buffer: Buffer): Promise<ExtractedContent> => {
  const [textResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({buffer}),
    mammoth.convertToHtml({buffer}),
  ]);
  return {
    contentHtml: htmlResult.value,
    contentTxt: textResult.value,
  };
};

const extractXlsx = async (buffer: Buffer): Promise<ExtractedContent> => {
  const workbook = XLSX.read(buffer);

  const sheetsTxt = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    return XLSX.utils.sheet_to_txt(sheet);
  });
  const sheetsHtml = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    return `Sheet: ${name}\n${XLSX.utils.sheet_to_html(sheet)}`;
  });
  return {
    title: workbook.Props?.Title,
    contentHtml: sheetsHtml.join('\n\n'),
    contentTxt: sheetsTxt.join('\n\n'),
    lang: workbook.Props?.Language,
    publishedAt: workbook.Props?.ModifiedDate?.getTime(),
  };
};

const extractPdf = async (buffer: Buffer): Promise<ExtractedContent> => {
  const pdfExtract = new PDFExtract();
  const data = await pdfExtract.extractBuffer(buffer);

  const contentTxt = data.pages
    .map(
      (page, idx) =>
        `Page ${idx + 1}:\n${page.content.map(item => item.str).join(' ')}`,
    )
    .join('\n\n');

  return {
    title: undefined, // pdf.js-extract doesn't provide metadata
    contentTxt: contentTxt,
    contentHtml: contentTxt,
    lang: undefined,
    publishedAt: undefined,
  };
};

const extractDoc = async (
  buffer: Buffer,
  docType: DocumentType,
): Promise<ExtractedContent> => {
  if (docType === DocumentType.DOCX) {
    return extractDocx(buffer);
  }
  if (docType === DocumentType.XLSX) {
    return extractXlsx(buffer);
  }
  return {contentTxt: await officeparser.parseOfficeAsync(buffer)};
};

const extractVTT = (vttContent: string): string => {
  const lines = vttContent.split('\n');
  const contentTxt: string[] = [];

  for (const line of lines) {
    if (
      line.includes('-->') ||
      line.startsWith('WEBVTT') ||
      line.startsWith('NOTE') ||
      line.trim() === ''
    ) {
      continue;
    }
    contentTxt.push(line.trim());
  }
  return contentTxt.join('\n');
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

const extractYoutubeVideo = async (
  url: string,
): Promise<ExtractedContent | undefined> => {
  const videoId = extractVideoId(url);
  if (!videoId) return undefined;

  const [[metadata], subtitlesPath] = await Promise.all([
    getVideosMetadata([videoId]),
    downloadSubtitles(videoId),
  ]);
  const subtitles = readFileSync(subtitlesPath, 'utf-8');

  return {
    title: metadata.title || undefined,
    contentHtml: getDisplayableVttContent(subtitles),
    contentTxt: extractVTT(subtitles),
    lang:
      metadata.defaultAudioLanguage || metadata.defaultLanguage || undefined,
    publishedAt: metadata.publishedAt
      ? new Date(metadata.publishedAt).getTime()
      : undefined,
  };
};

const extractContent = async (
  url: string,
): Promise<ExtractedContent | undefined> => {
  url = await resolveRedirects(url);
  const pageType = await determineContentType(url);

  let data: ExtractedContent | undefined;

  if (pageType === DocumentType.DOCX) {
    const buffer = await getPageContentDirect(url);
    data = await extractDocx(buffer);
  } else if (pageType === DocumentType.PDF) {
    const buffer = await getPageContentDirect(url);
    data = await extractPdf(buffer);
  } else if (pageType === DocumentType.XLSX) {
    const buffer = await getPageContentDirect(url);
    data = await extractXlsx(buffer);
  } else if (
    pageType === DocumentType.PPTX ||
    pageType === DocumentType.ODT ||
    pageType === DocumentType.ODP ||
    pageType === DocumentType.ODS
  ) {
    const buffer = await getPageContentDirect(url);
    data = await extractDoc(buffer, pageType);
  } else if (pageType === DocumentType.JSON) {
    const content = (await getPageContentDirect(url)).toString();
    data = {contentTxt: content, contentHtml: content};
  } else if (pageType === DocumentType.YOUTUBE) {
    data = await extractYoutubeVideo(url);
  } else {
    data = await extractWebpageContent(url);
  }
  if (!data) return undefined;

  if (!data.title) {
    data.title = url.split('/').pop();
  }
  if (!data.lang && data.contentTxt) {
    data.lang = franc(data.contentTxt!);
  }
  return data;
};

export default extractContent;
