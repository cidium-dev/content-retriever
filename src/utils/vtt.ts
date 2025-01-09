// const getWordCount = (text: string) => text.split(/\s+/).length;

// const findOverlap = (str1: string, str2: string): number => {
//   for (let i = 0; i < str1.length; i++) {
//     const phrase = str1.slice(i);
//     if (str2.startsWith(phrase)) return i;
//   }
//   return -1;
// };

type VttBlock = {header: string; text: string};

export const cleanVttBlock = (block: VttBlock): VttBlock => {
  const text = block.text
    .replace(/<\/?c>/g, '') // remove c tags
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '') // Remove inline timestamps
    .replace(/\[.*?\]/g, '') // remove things like [Music]
    .replace(/\s+/g, ' ') // merge whitespaces
    .trim();

  const header = block.header
    .split(' ')
    .slice(0, 3)
    .map((part, i) => (i === 0 || i === 2 ? formatTimestamp(part) : part))
    .join(' ');

  return {header, text};
};

const formatTimestamp = (timestamp: string): string =>
  timestamp.replace(/(\d{2}:\d{2}:\d{2})\.\d{3}/, '$1');

export const splitToBlocks = (transcript: string) => {
  const arr = transcript.split(
    /\n(?=\d{2}:\d{2}:\d{2}(?:\.\d{3})? --> \d{2}:\d{2}:\d{2}(?:\.\d{3})?)/,
  );
  const blocks: {header: string; text: string}[] = [];

  for (const block of arr) {
    const [header, ...text] = block.split('\n');
    blocks.push({header, text: text.join('\n').trim()});
  }
  return blocks.filter(b => b.text);
};

export const cleanWebVtt = (transcript: string) => {
  const blocks = splitToBlocks(transcript);
  const cleaned = blocks.map(cleanVttBlock);

  const result = [];

  for (const block of cleaned) {
    result.push(block.header);
    result.push(block.text);
    result.push('');
  }
  return result.join('\n');
};

export const getWebVttHtml = (vttContent: string): string => {
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

export const timeToSeconds = (time: string): number => {
  const [h, m, s] = time.split(':').map(Number);
  return h * 3600 + m * 60 + s;
};
