// Builds the renderer with esbuild.
//   node scripts/build.mjs            -> out/renderer/  (index.html + app.js + app.css + logo.png)  used by Electron
//   node scripts/build.mjs --web      -> also out/web/index.html  (one self-contained file: JS, CSS and logo inlined)
//   node scripts/build.mjs --watch    -> rebuild the renderer on every change
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const appName = pkg.productName;   // the one place the name lives
const appVersion = pkg.version;     // ...and the version (see src/changelog.js)
const args = new Set(process.argv.slice(2));
const out = join(root, 'out');
const template = readFileSync(join(root, 'src/index.html'), 'utf8').replaceAll('@appName', appName);
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'">`;

const bundle = (minify, outdir) => ({
  entryPoints: { app: join(root, 'src/main.js') },
  bundle: true, format: 'iife', target: 'chrome120', minify, outdir, legalComments: 'none',
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  logLevel: 'warning', sourcemap: false
});

async function renderer() {
  const dir = join(out, 'renderer');
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  await build(bundle(false, dir));
  copyFileSync(join(root, 'src/assets/logo.png'), join(dir, 'logo.png'));
  writeFileSync(join(dir, 'index.html'), template
    .replace('<!--@csp-->', CSP)
    .replace('<!--@styles-->', '<link rel="stylesheet" href="app.css">')
    .replace('<!--@script-->', '<script src="app.js"></script>')
    .replace('@logo', 'logo.png'));
  console.log('built out/renderer');
}

async function web() {
  const dir = join(out, '.web-tmp');
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  await build(bundle(true, dir));
  const js = readFileSync(join(dir, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
  const css = readFileSync(join(dir, 'app.css'), 'utf8');
  const logo = 'data:image/png;base64,' + readFileSync(join(root, 'src/assets/logo.png')).toString('base64');
  mkdirSync(join(out, 'web'), { recursive: true });
  writeFileSync(join(out, 'web/index.html'), template
    .replace('<!--@csp-->', '')
    .replace('<!--@styles-->', `<style>${css}</style>`)
    .replace('<!--@script-->', () => `<script>${js}</script>`)
    .replace('@logo', logo));
  rmSync(dir, { recursive: true, force: true });
  console.log('built out/web/index.html');
}

if (args.has('--watch')) {
  const dir = join(out, 'renderer');
  await renderer();
  const ctx = await context(bundle(false, dir));
  await ctx.watch();
  console.log('watching src/ for changes…');
} else {
  await renderer();
  if (args.has('--web')) await web();
}
