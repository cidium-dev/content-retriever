import {createPage} from './puppeteer';
import axios, {AxiosError} from 'axios';

const resolveRedirectsWithPuppeteer = async (url: string) => {
  const page = await createPage(url, false);
  try {
    await page.waitForNavigation({waitUntil: 'load', timeout: 5000});
    return page.url();
  } catch (e) {
    return url;
  } finally {
    await page.close();
  }
};

export const resolveRedirects = async (url: string): Promise<string> => {
  try {
    const res = await axios.head(url, {maxRedirects: 0, timeout: 5000});
    const location = res.headers.location;

    if (!location) {
      return url;
    }
    return await resolveRedirects(new URL(location, url).toString());
  } catch (err) {
    const error = err as AxiosError;

    if (error.response?.status === 403 || error.response?.status === 400) {
      return await resolveRedirectsWithPuppeteer(url);
    }
    if (error.response?.headers.location) {
      return await resolveRedirects(error.response.headers.location);
    }
    console.error('Error resolving redirects:', url, error.message);
    return url;
  }
};
