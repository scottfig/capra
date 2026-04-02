export function register() {
  // In some Node.js environments (Node 22+ with --localstorage-file flag),
  // a localStorage global exists but its methods may be non-functional.
  // Patch it with an in-memory implementation so SSR doesn't crash.
  if (
    typeof globalThis.localStorage !== "undefined" &&
    typeof (globalThis.localStorage as Storage).getItem !== "function"
  ) {
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    } as Storage;
  }
}
