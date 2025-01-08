import type {ResourceData} from '~/lib/db';
import {ResourceType} from '~/package';
import {cleanVttBlock, splitToBlocks} from './vtt';

const getSentences = (text: string): string[] => {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
};

const indexContent = (text: string): string => {
  const sentences = getSentences(text);
  return sentences
    .filter(sentence => sentence.trim())
    .map((sentence, index) => `${index} ${sentence.trim()}`)
    .join('\n');
};

const indexXlsxContent = (text: string): string => {
  const rows = text.split('\n');
  return rows
    .filter(row => row.trim())
    .map((row, index) => `${index} ${row.trim()}`)
    .join('\n');
};

const indexWebVttContent = (text: string): string => {
  const blocks = splitToBlocks(text);
  const indexed: string[] = [];
  let currentIndex = 0;

  for (const block of blocks) {
    const {text} = cleanVttBlock(block);
    const sentences = getSentences(text);

    for (const sentence of sentences) {
      indexed.push(`${currentIndex++} ${sentence.trim()}`);
    }
  }
  return indexed.join('\n');
};

const indexJsonContent = (text: string): string => {
  const rows = JSON.stringify(text, null, 1).split('\n');

  return rows
    .filter(row => row.trim())
    .map((row, index) => `${index} ${row.trim()}`)
    .join('\n');
};

const getContent = (
  resource: ResourceData,
  startIndex: number,
  endIndex: number,
): string | {startTime: string; endTime: string} => {
  switch (resource.type) {
    case ResourceType.JSON:
      return getJsonContent(resource.content_text, startIndex, endIndex);
    case ResourceType.YOUTUBE:
      return getVttTimestamps(resource.content_text, startIndex, endIndex);
    default:
      return resource.content_indexed
        .split('\n')
        .slice(startIndex, endIndex + 1)
        .map(line => line.substring(line.indexOf(' ')).trim())
        .join('\n');
  }
};

const getJsonContent = (
  jsonContent: string,
  startIndex: number,
  endIndex: number,
): string => {
  const lines = JSON.stringify(JSON.parse(jsonContent), null, 1).split('\n');

  const selectedLines = lines
    .filter(line => line.trim())
    .slice(startIndex, endIndex + 1)
    .map(line => line.trim());

  return selectedLines.join('\n');
};

const getVttTimestamps = (
  vttContent: string,
  startIndex: number,
  endIndex: number,
): {startTime: string; endTime: string} => {
  const blocks = splitToBlocks(vttContent);

  let currentIndex = 0;
  let startBlockIndex = 0;
  let endBlockIndex = 0;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const {text} = cleanVttBlock(blocks[blockIndex]);
    const sentences = getSentences(text);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const sentence of sentences) {
      if (currentIndex === startIndex) startBlockIndex = blockIndex;
      if (currentIndex === endIndex) {
        endBlockIndex = blockIndex;
        break;
      }
      currentIndex++;
    }
    if (currentIndex >= endIndex) break;
  }
  const [startTime] = blocks[startBlockIndex].header.split(' --> ');
  const [, endTime] = blocks[endBlockIndex].header.split(' --> ');

  return {startTime: startTime.trim(), endTime: endTime.trim()};
};

const indexing = {
  indexContent,
  indexXlsxContent,
  indexWebVttContent,
  indexJsonContent,
  getContent,
  getJsonContent,
  getVttTimestamps,
};

export default indexing;
