import type {Browser, ResourceType} from 'puppeteer';
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
    blockedTypes: new Set([
      'image',
      'stylesheet',
      'font',
      'media',
    ] as ResourceType[]),
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
  puppeteer.launch({ignoreHTTPSErrors: true, args: ['--no-sandbox']});

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

export const createPage = async (url?: string, wait?: boolean) => {
  const browser = await getRunningBrowser();
  const page = await browser.newPage();

  try {
    if (url) {
      await page.goto(url, wait ? {waitUntil: 'networkidle2'} : undefined);
    }
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
