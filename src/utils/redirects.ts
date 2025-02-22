import axios, {AxiosError} from 'axios';
import browser from '~/services/browser';

const resolveRedirectsWithBrowser = async (url: string) => {
  const page = await browser.createPage(url);

  try {
    return page.url();
  } finally {
    await page.close();
  }
};

export const resolveRedirects = async (url: string): Promise<string> => {
  try {
    const res = await axios.head(url, {maxRedirects: 0, timeout: 10000});
    const location = res.headers.location;

    if (!location) {
      return url;
    }
    return await resolveRedirects(new URL(location, url).toString());
  } catch (err) {
    const error = err as AxiosError;

    if (error.response?.status === 403 || error.response?.status === 400) {
      return await resolveRedirectsWithBrowser(url);
    }
    if (error.response?.headers.location) {
      return await resolveRedirects(error.response.headers.location);
    }
    console.error('Error resolving redirects:', url, error.message);
    return url;
  }
};
