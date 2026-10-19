#!/usr/bin/env node
// 모바일 웹앱(PWA) 빌드: Electron 화면 코드를 그대로 재사용해 www/ 에 정적 사이트를 만든다.
// 사용: node scripts/build-web.js [출력폴더=www]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'www');
const pkg = require(path.join(ROOT, 'package.json'));

function rm(p) { fs.rmSync(p, { recursive: true, force: true }); }
function mk(p) { fs.mkdirSync(p, { recursive: true }); }
function cp(from, to) { mk(path.dirname(to)); fs.copyFileSync(from, to); }
function write(p, s) { mk(path.dirname(p)); fs.writeFileSync(p, s); }

rm(OUT);
mk(OUT);

// 1) 코어 로직·화면
for (const f of fs.readdirSync(path.join(ROOT, 'src/core'))) if (f.endsWith('.js')) cp(path.join(ROOT, 'src/core', f), path.join(OUT, 'core', f));
for (const f of ['app.js', 'sync.js', 'boot.js', 'styles.css']) cp(path.join(ROOT, 'src/renderer', f), path.join(OUT, f));
for (const f of fs.readdirSync(path.join(ROOT, 'src/renderer/views'))) cp(path.join(ROOT, 'src/renderer/views', f), path.join(OUT, 'views', f));
cp(path.join(ROOT, 'src/web/platform-web.js'), path.join(OUT, 'platform-web.js'));
for (const f of fs.readdirSync(path.join(ROOT, 'src/web/icons'))) cp(path.join(ROOT, 'src/web/icons', f), path.join(OUT, 'icons', f));

// 2) 콘텐츠 → content.js (fetch 없이 오프라인에서 바로 사용)
const content = {};
for (const lv of ['n5', 'n4', 'n3', 'n2', 'n1']) {
  const f = path.join(ROOT, 'data/levels', `${lv}.json`);
  if (fs.existsSync(f)) content[lv.toUpperCase()] = JSON.parse(fs.readFileSync(f, 'utf8'));
}
write(path.join(OUT, 'content.js'), `self.JLPT_CONTENT=${JSON.stringify(content)};\n`);

// 3) index.html: 경로·CSP·PWA 메타 변환
let html = fs.readFileSync(path.join(ROOT, 'src/renderer/index.html'), 'utf8');
html = html.split('../core/').join('core/');
html = html.replace("connect-src 'none'", "connect-src https://api.github.com https://gist.githubusercontent.com");
html = html.replace("img-src 'self' data:", "img-src 'self' data: blob:");
html = html.replace('<!--WEB-HEAD-->', [
  '<link rel="manifest" href="manifest.webmanifest">',
  '<meta name="theme-color" content="#c2412f">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<link rel="icon" href="icons/icon-192.png">',
  '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">',
].join('\n  '));
html = html.replace('<!--PLATFORM-->', '<script src="content.js"></script>\n  <script src="platform-web.js"></script>');
write(path.join(OUT, 'index.html'), html);

// 4) 매니페스트
write(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: 'JLPT 스터디',
  short_name: 'JLPT 스터디',
  description: 'JLPT N5~N1 학습 계획·연습문제·단어장',
  id: './',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#f6f5f2',
  theme_color: '#c2412f',
  lang: 'ko',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));

// 5) 서비스 워커: 모든 파일 목록 + 내용 해시로 버전
function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}
const files = walk(OUT).sort();
const hash = crypto.createHash('sha256');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(OUT, f)));
const version = `${pkg.version}-${hash.digest('hex').slice(0, 10)}`;
const sw = fs.readFileSync(path.join(ROOT, 'src/web/sw.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('__FILES__', JSON.stringify(['./', ...files]));
write(path.join(OUT, 'sw.js'), sw);
write(path.join(OUT, '.nojekyll'), '');

console.log(`✓ 웹앱 빌드 완료: ${path.relative(ROOT, OUT)}/ (파일 ${files.length + 1}개, 버전 ${version})`);
