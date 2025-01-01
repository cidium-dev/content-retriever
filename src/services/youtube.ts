import {existsSync, readFileSync, unlinkSync, writeFileSync} from 'node:fs';
import {google, youtube_v3} from 'googleapis';
import {exec} from 'child_process';
import {promisify} from 'util';
import {resolve} from 'path';

const youtubeApiKey = process.env.YOUTUBE_API_KEY;
const basePath = process.env.TRANSCRIPTS_DUMP_PATH || '';

if (!youtubeApiKey) {
  throw new Error('YOUTUBE_API_KEY is required');
}
if (!basePath) {
  throw new Error('TRANSCRIPT_DUMP_PATH is required');
}

const execAsync = promisify(exec);
const api = google.youtube({version: 'v3', auth: youtubeApiKey});

export const downloadVideo = async (videoId: string) => {
  const outputPathBase = resolve(basePath, `videos/${videoId}`);
  const outputPath1 = outputPathBase + '.webm';
  const outputPath2 = outputPathBase + '.m4a';

  if (existsSync(outputPath1)) {
    return outputPath1;
  }
  if (existsSync(outputPath2)) {
    return outputPath2;
  }
  const command = `yt-dlp -f 'bestaudio' -o "${outputPathBase}.%(ext)s" https://www.youtube.com/watch?v=${videoId}`;
  const {stderr} = await execAsync(command);

  if (stderr) {
    throw new Error(stderr);
  }
  if (existsSync(outputPath1)) {
    return outputPath1;
  }
  if (existsSync(outputPath2)) {
    return outputPath2;
  }
  throw new Error('Video download failed');
};

const downloadSubtitlesLang = async (
  videoId: string,
  langCodes: string[],
  auto?: boolean,
) => {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPathBase = resolve(basePath, `transcripts/${videoId}`);

  const command = `yt-dlp --skip-download --write${
    auto ? '-auto' : ''
  }-sub --sub-langs "${langCodes.join(
    ',',
  )}" --convert-subs vtt --retries 2 -o "${outputPathBase}.%(ext)s" ${videoUrl}`;

  const {stderr} = await execAsync(command);
  if (stderr) throw new Error(stderr);

  const transcripts: {[langCode: string]: string} = {};

  for (const langCode of langCodes) {
    const langPath = outputPathBase + `.${langCode}.vtt`;
    if (!existsSync(langPath)) continue;

    transcripts[langCode] = langPath;
  }
  return transcripts;
};

export enum EnglishLangCode {
  en = 'en',
  enUS = 'en-US',
  enGB = 'en-GB',
  enCA = 'en-CA',
  enAU = 'en-AU',
  enAuto = 'en.auto',
}

export const englishLangCodes = Object.values(EnglishLangCode);

export const downloadSubtitles = async (videoId: string) => {
  const outputPath = resolve(basePath, `transcripts/${videoId}.vtt`);
  try {
    const transcripts = await downloadSubtitlesLang(videoId, englishLangCodes);
    const sorted = englishLangCodes
      .map(langCode => transcripts[langCode])
      .filter(_ => _);
    const path = sorted[0];

    writeFileSync(outputPath, readFileSync(path, 'utf-8'));
    unlinkSync(path);
    return outputPath;
  } catch (e) {
    /* empty */
  }
  const transcripts = await downloadSubtitlesLang(videoId, ['en'], true);
  const transcript = readFileSync(transcripts.en, 'utf8');

  writeFileSync(outputPath, transcript);
  unlinkSync(transcripts.en);
  return outputPath;
};

export type VideoMetadata = youtube_v3.Schema$VideoSnippet;

export const getVideosMetadata = async (videoIds: string[]) => {
  const response = await api.videos.list({
    part: ['snippet'],
    id: videoIds,
  });

  if (!response.data.items || response.data.items.length === 0) {
    throw new Error('No video found with the provided ID');
  }
  const snippets = response.data.items.map(item => item.snippet).filter(_ => _);

  if (snippets.length !== videoIds.length) {
    throw new Error('Incomplete video metadata');
  }
  return snippets as VideoMetadata[];
};

export const extractVideoId = (url: string): string => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);

  if (match && match[2]?.length === 11) return match[2];

  throw new Error('Invalid YouTube video URL');
};

const youtube = {
  downloadVideo,
  downloadSubtitles,
  getVideosMetadata,
  extractVideoId,
};

export default youtube;
