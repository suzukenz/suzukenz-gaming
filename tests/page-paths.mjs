export function pagePaths(files) {
  return [
    '/',
    ...files
      .map((file) => file.replaceAll('\\', '/'))
      .filter((file) => file.endsWith('/index.html'))
      .map((file) => `/${file.replace(/index\.html$/, '')}`),
  ];
}
