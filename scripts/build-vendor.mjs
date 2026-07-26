import { build } from 'esbuild';

await build({
  stdin: {
    contents: `
      import * as api from 'manseryeok';
      globalThis.Manseryeok = Object.freeze(api);
    `,
    resolveDir: process.cwd(),
    sourcefile: 'manseryeok-entry.js'
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  outfile: 'scripts/vendor/manseryeok.browser.js',
  minify: true,
  legalComments: 'eof'
});
