import type {Browser} from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AnonUAPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import BlockResourcesPlugin from 'puppeteer-extra-plugin-block-resources';
// import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';

import mutex from './mutex';
// import {getProxyUrl} from './http';

puppeteer.use(StealthPlugin());
puppeteer.use(AnonUAPlugin());
puppeteer.use(
  BlockResourcesPlugin({
    blockedTypes: new Set(['image', 'stylesheet', 'font', 'media']),
  })
);

// puppeteer.use(
//   RecaptchaPlugin({
//     provider: {
//       id: '2captcha',
//       token: 'XXXXXXX', // REPLACE THIS WITH YOUR OWN 2CAPTCHA API KEY ⚡
//     },
//     visualFeedback: true, // colorize reCAPTCHAs (violet = detected, green = solved)
//   })
// );

const createBrowser = () =>
  puppeteer.launch({ignoreHTTPSErrors: true, headless: true});

const getRunningBrowser = (() => {
  let browser: Browser | undefined;

  return async () => {
    const release = await mutex.aquire('browser');
    if (browser) return browser;

    try {
      browser = await createBrowser();
    } finally {
      release();
    }
    return browser;
  };
})();

const createPage = async (url?: string) => {
  const browser = await getRunningBrowser();
  const page = await browser.newPage();

  try {
    if (url) await page.goto(url, {waitUntil: 'networkidle2'});
    return page;
  } catch (e) {
    await page.close();
    throw e;
  }
};

export const getPageContent = async (url: string) => {
  const page = await createPage(url);

  try {
    return await page.content();
  } finally {
    await page.close();
  }
};

export const getPageContentDirect = async (url: string) => {
  const res = await fetch(url);
  return await res.arrayBuffer();
};
