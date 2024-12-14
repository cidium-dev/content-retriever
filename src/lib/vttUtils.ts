export const cleanWebVtt = (webVTT: string): string => {
  const cleanText = webVTT
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '') // Remove timestamps
    .replace(/<\/?c[^>]*>/g, '') // Remove <c> tags
    .replace(/WEBVTT/g, '') // Remove WEBVTT header
    .split('\n')
    .map(line => line.trim())
    .filter(line => line) // Remove empty lines
    .join('\n');

  return cleanText;
};

export const getDisplayableVttContent = (vttContent: string): string => {
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
