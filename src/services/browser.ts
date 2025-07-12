import {chromium, type Browser} from '@playwright/test';
import mutex from '../utils/mutex';

const getBrowser = (() => {
  let browser: Browser | undefined;

  return async () => {
    const release = await mutex.aquire('browser');
    try {
      if (!browser) {
        browser = await chromium.launch({
          args: [
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
            `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36`,
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        });
      }
      return browser;
    } finally {
      release();
    }
  };
})();

const createPage = async (url?: string) => {
  const browser = await getBrowser();

  const context = await browser.newContext({
    bypassCSP: true,
    javaScriptEnabled: true,
    ignoreHTTPSErrors: true,
    viewport: {width: 1920, height: 1080},
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation'],
    colorScheme: 'light',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'sec-ch-ua':
        '"Chromium";v="122", "Google Chrome";v="122", "Not:A-Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    },
  });
  const page = await context.newPage();

  await page.route('**/*', async (route, request) => {
    const resourceType = request.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      await route.abort();
    } else {
      await route.continue();
    }
  });
  if (!url) return page;

  try {
    await page.goto(url);

    await Promise.race([
      page.waitForLoadState('networkidle'),
      page.waitForLoadState('load').then(() => page.waitForTimeout(5000)),
    ]);
  } catch (error) {
    await page.close();
    throw error;
  }
  return page;
};

const getPageContent = async (url: string) => {
  const page = await createPage(url);
  try {
    return await page.content();
  } finally {
    await page.close();
  }
};

const getPageContentDirect = async (url: string) => {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
};

const browser = {getPageContent, getPageContentDirect, createPage};
export default browser;
