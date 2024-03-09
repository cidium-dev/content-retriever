import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import moment from 'moment';
import {JSDOM} from 'jsdom';
import {franc} from 'franc';
import {Readability, isProbablyReaderable} from '@mozilla/readability';

import {getPageContent, getPageContentDirect} from './puppeteer';

enum DocumentType {
  JSON = 'JSON',
  CSV = 'CSV',
  XLSX = 'XLSX',
  DOCX = 'DOCX',
  PDF = 'PDF',
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

  for (const [extension, docType] of Object.entries(extensionToEnum)) {
    if (urlLower.endsWith(extension)) return docType;
  }
  try {
    const response = await fetch(url, {method: 'HEAD'});

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    const contentType = response.headers.get('Content-Type');

    if (contentType) {
      const mimeType = contentType.split(';')[0];
      return (mimeType && mimeToEnum[mimeType]) || DocumentType.UNKNOWN;
    } else {
      throw new Error('Content-Type header is missing');
    }
  } catch (error) {
    console.error(`Error determining content type: ${error}`);
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

const extractContent = async (url: string) => {
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
