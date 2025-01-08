export type {ResourceData} from '~/lib/db';

export enum ResourceType {
  WEB = 'WEB',
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

export {timeToSeconds} from '~/utils/vtt';
export {default as indexing} from '~/utils/indexing';
