'use strict';

// src/utils/vtt.ts
var cleanVttBlock = (block) => {
  const text = block.text.replace(/<\/?c>/g, "").replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, "").replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
  const header = block.header.split(" ").slice(0, 3).map((part, i) => i === 0 || i === 2 ? formatTimestamp(part) : part).join(" ");
  return { header, text };
};
var formatTimestamp = (timestamp) => timestamp.replace(/(\d{2}:\d{2}:\d{2})\.\d{3}/, "$1");
var splitToBlocks = (transcript) => {
  const arr = transcript.split(
    /\n(?=\d{2}:\d{2}:\d{2}(?:\.\d{3})? --> \d{2}:\d{2}:\d{2}(?:\.\d{3})?)/
  );
  const blocks = [];
  for (const block of arr) {
    const [header, ...text] = block.split("\n");
    blocks.push({ header, text: text.join("\n").trim() });
  }
  return blocks.filter((b) => b.text);
};
var timeToSeconds = (time) => {
  const [h, m, s] = time.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

// src/utils/indexing.ts
var getSentences = (text) => {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
};
var indexContent = (text) => {
  const sentences = getSentences(text);
  return sentences.filter((sentence) => sentence.trim()).map((sentence, index) => `${index} ${sentence.trim()}`).join("\n");
};
var indexXlsxContent = (text) => {
  const rows = text.split("\n");
  return rows.filter((row) => row.trim()).map((row, index) => `${index} ${row.trim()}`).join("\n");
};
var indexWebVttContent = (vtt) => {
  const blocks = splitToBlocks(vtt);
  const indexed = [];
  for (const block of blocks) {
    const { text } = cleanVttBlock(block);
    const sentences = getSentences(text);
    for (const sentence of sentences) {
      const last = indexed[indexed.length - 1];
      let trimmed = sentence.trim();
      if (last && trimmed.startsWith(last)) {
        trimmed = trimmed.slice(last.length).trim();
      }
      if (trimmed) indexed.push(trimmed);
    }
  }
  return indexed.map((s, i) => `${i} ${s}`).join("\n");
};
var indexJsonContent = (text) => {
  const rows = JSON.stringify(text, null, 1).split("\n");
  return rows.filter((row) => row.trim()).map((row, index) => `${index} ${row.trim()}`).join("\n");
};
var getContent = (resource, startIndex, endIndex) => {
  return resource.content_indexed.split("\n").slice(startIndex, endIndex + 1).map((line) => line.substring(line.indexOf(" ")).trim()).join("\n");
};
var getVttTimestamps = (vttContent, startIndex, endIndex) => {
  const blocks = splitToBlocks(vttContent);
  const indexed = [];
  let startBlockIndex = 0;
  let endBlockIndex = 0;
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const { text } = cleanVttBlock(blocks[blockIndex]);
    const sentences = getSentences(text);
    for (const sentence of sentences) {
      const last = indexed[indexed.length - 1];
      let trimmed = sentence.trim();
      if (last && trimmed.startsWith(last)) {
        trimmed = trimmed.slice(last.length).trim();
      }
      if (trimmed) indexed.push(trimmed);
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
  const [startTime] = blocks[startBlockIndex].header.split(" --> ");
  const [, endTime] = blocks[endBlockIndex].header.split(" --> ");
  console.log(startBlockIndex, endBlockIndex);
  console.log(blocks.slice(startBlockIndex, endBlockIndex + 1));
  return { startTime: startTime.trim(), endTime: endTime.trim() };
};
var indexing = {
  indexContent,
  indexXlsxContent,
  indexWebVttContent,
  indexJsonContent,
  getContent,
  getVttTimestamps
};
var indexing_default = indexing;

// src/package.ts
var ResourceType = /* @__PURE__ */ ((ResourceType2) => {
  ResourceType2["WEB"] = "WEB";
  ResourceType2["JSON"] = "JSON";
  ResourceType2["CSV"] = "CSV";
  ResourceType2["XLSX"] = "XLSX";
  ResourceType2["DOCX"] = "DOCX";
  ResourceType2["PPTX"] = "PPTX";
  ResourceType2["ODT"] = "ODT";
  ResourceType2["ODP"] = "ODP";
  ResourceType2["ODS"] = "ODS";
  ResourceType2["PDF"] = "PDF";
  ResourceType2["YOUTUBE"] = "YOUTUBE";
  ResourceType2["UNKNOWN"] = "UNKNOWN";
  return ResourceType2;
})(ResourceType || {});

exports.ResourceType = ResourceType;
exports.indexing = indexing_default;
exports.timeToSeconds = timeToSeconds;
