const promises: {[key: string]: Promise<unknown>} = {};

export const aquire = async (label: string) => {
  let resolve: ((value?: unknown) => void) | null = null;

  const lastPromise = promises[label];
  const newPromise = new Promise(_resolve => {
    resolve = _resolve;
  });

  promises[label] = (async () => {
    lastPromise && (await lastPromise);
    await newPromise;
  })();

  await lastPromise;

  return () => {
    delete promises[label];
    resolve!();
  };
};

export const isAquired = (label: string): boolean => !!promises[label];
const mutex = {aquire, isAquired};

export default mutex;
