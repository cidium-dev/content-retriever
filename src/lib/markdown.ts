import {unified} from 'unified';

import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkToc from 'remark-toc';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import rehypeMermaid from 'rehype-mermaid';
// import rehypeSanitize from 'rehype-sanitize';
import rehypeStarryNight from 'rehype-starry-night';
import {all} from '@wooorm/starry-night';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkToc)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeRaw)
  .use(rehypeMermaid, {errorFallback: element => element})
  .use(rehypeStarryNight, {grammars: all, allowMissingScopes: true})
  .use(rehypeStringify);

export const parse = (markdown: string) => {
  return processor.parse(markdown);
};

export const renderMarkdownToHtml = async (content: string) => {
  const html = await processor.process(content);
  // const clean = DOMPurify.sanitize(html.toString());
  // return clean;
  return html.toString();
};
