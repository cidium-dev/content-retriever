import type {ResourceData} from '~/lib/db';
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

const indexWebVttContent = (vtt: string): string => {
  const blocks = splitToBlocks(vtt);
  const indexed: string[] = [];

  for (const block of blocks) {
    const {text} = cleanVttBlock(block);
    const sentences = getSentences(text);

    for (const sentence of sentences) {
      const last = indexed[indexed.length - 1];
      let trimmed = sentence.trim();

      if (last && trimmed.startsWith(last)) {
        trimmed = trimmed.slice(last.length).trim();
      }
      if (!trimmed) continue;
      indexed.push(trimmed);
    }
  }
  return indexed.map((s, i) => `${i} ${s}`).join('\n');
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
): string => {
  return resource.content_indexed
    .split('\n')
    .slice(startIndex, endIndex + 1)
    .map(line => line.substring(line.indexOf(' ')).trim())
    .join('\n');
};

const getVttTimestamps = (
  vttContent: string,
  startIndex: number,
  endIndex: number,
): {startTime: string; endTime: string} => {
  const blocks = splitToBlocks(vttContent);
  const indexed: string[] = [];

  let startBlockIndex = 0;
  let endBlockIndex = 0;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const {text} = cleanVttBlock(blocks[blockIndex]);
    const sentences = getSentences(text);

    for (const sentence of sentences) {
      const last = indexed[indexed.length - 1];
      let trimmed = sentence.trim();

      if (last && trimmed.startsWith(last)) {
        trimmed = trimmed.slice(last.length).trim();
      }
      if (!trimmed) continue;
      indexed.push(trimmed);

      const currentIndex = indexed.length - 1;

      if (currentIndex === startIndex) {
        startBlockIndex = blockIndex;
      }
      if (currentIndex === endIndex) {
        endBlockIndex = blockIndex;
        break;
      }
    }
    if (endBlockIndex > 0) break;
  }
  const [startTime] = blocks[startBlockIndex].header.split(' --> ');
  const [, endTime] = blocks[endBlockIndex].header.split(' --> ');

  console.log(startBlockIndex, endBlockIndex);
  console.log(indexed.slice(startIndex, endIndex + 1));
  console.log(blocks.slice(startBlockIndex, endBlockIndex + 1));

  return {startTime: startTime.trim(), endTime: endTime.trim()};
};

const indexing = {
  indexContent,
  indexXlsxContent,
  indexWebVttContent,
  indexJsonContent,
  getContent,
  getVttTimestamps,
};

export default indexing;
