// upload-bot.js
//
// One Telegram bot, one job here: watch the group, find daily Editorial
// and Mock Test files, publish them to the site.
//
// FILENAME MATCHING (loose, on purpose):
//   - We look for a date anywhere in the filename: D-M-YYYY (e.g. 24-9-2026).
//   - We look for the word "Editorial" anywhere (case-insensitive) -> editorial file.
//   - We look for "Mock Test" anywhere (case-insensitive) -> mock test file.
//   - Everything else in the filename (SSC, Vocab, whatever) is ignored.
//   - The bot then BUILDS ITS OWN clean filename for the site from just
//     the date (and test number, for mock tests) -- your original
//     Telegram filename never has to be "clean" or exact.
//
// MONTHLY PAGES: if e.g. "october-2026.html" or "editorial-october-2026.html"
// doesn't exist yet, the bot creates it automatically (and adds a link to
// it from the year page, e.g. 2026.html). You never create these by hand.
//
// NOTHING IS EVER DELETED. Your site shows "today's" file by checking
// today's date, not by only keeping one file around -- see SETUP_GUIDE.md.

const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OFFSET_FILE = path.join(__dirname, '..', 'data', 'telegram-offset.json');

const MONTHS = ['january','february','march','april','may','june','july',
  'august','september','october','november','december'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------- Telegram helpers ----------------

function readOffset() {
  try { return JSON.parse(fs.readFileSync(OFFSET_FILE, 'utf8')).offset || 0; }
  catch (e) { return 0; }
}
function writeOffset(offset) {
  fs.mkdirSync(path.dirname(OFFSET_FILE), { recursive: true });
  fs.writeFileSync(OFFSET_FILE, JSON.stringify({ offset }, null, 2));
}
async function tg(method, params) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram API error on ${method}: ${JSON.stringify(data)}`);
  return data.result;
}
async function downloadTelegramFile(fileId, destPath) {
  const fileInfo = await tg('getFile', { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.file_path}`);
  fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
}

// ---------------- Filename understanding ----------------

function identify(fileName) {
  const dateMatch = fileName.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (!dateMatch) return null;
  const day = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const year = parseInt(dateMatch[3], 10);
  if (month < 1 || month > 12) return null;

  if (/editorial/i.test(fileName)) {
    return { type: 'editorial', day, month, year };
  }
  if (/mock\s*test/i.test(fileName)) {
    const numMatch = fileName.match(/mock\s*test\D{0,10}?(\d+)/i);
    if (!numMatch) return null; // no test number found -- can't build a valid link
    return { type: 'mocktest', day, month, year, testNum: parseInt(numMatch[1], 10) };
  }
  return null;
}

function canonicalFilename(info) {
  if (info.type === 'editorial') {
    return `Perfect Editorial Practice (${info.day}-${info.month}-${info.year}).html`;
  }
  return `${info.day}-${info.month}-${info.year} English Mock Test -${info.testNum}.html`;
}

// ---------------- Generic "clone the last entry, or build a plain one" ----------------
// Works for both the monthly pages (editorial/mock-test entries) and the
// year pages (month-to-month links), so new months and even the very
// first entry of a brand-new month page all just work.

function insertEntry(content, matchRegex, buildGenericEntry, cloneReplacements) {
  const matches = [...content.matchAll(matchRegex)];
  let insertBeforeIdx;
  if (content.includes('<!-- ENTRIES -->')) {
    insertBeforeIdx = content.indexOf('<!-- ENTRIES -->');
  } else {
    // No marker comment in this page (true for every month page right now).
    // Insert right before the "back" box itself, as a new sibling -- never
    // match text *inside* it, or new entries get nested inside that link
    // and corrupt the page (this was the bug).
    const backDivIdx = content.indexOf('<div class="back">');
    insertBeforeIdx = backDivIdx !== -1 ? backDivIdx : content.length;
  }

  let newEntry;
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    const template = content.slice(last.index, insertBeforeIdx);
    newEntry = cloneReplacements(template);
  } else {
    newEntry = buildGenericEntry();
  }
  return content.slice(0, insertBeforeIdx) + newEntry + '\n\n' + content.slice(insertBeforeIdx);
}

// ---------------- Monthly page: Editorial ----------------

function editorialMonthPagePath(info) {
  return `editorial-${MONTHS[info.month - 1]}-${info.year}.html`;
}

function ensureEditorialMonthPage(info) {
  const p = editorialMonthPagePath(info);
  if (fs.existsSync(p) && !fs.readFileSync(p, 'utf8').includes('<title>Loading...</title>')) return p;
  const monthCap = cap(MONTHS[info.month - 1]);
  const yearPage = `editorial-${info.year}.html`;
  const skeleton = `<!DOCTYPE html>
<html lang="en">
<head>
<script>
if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Editorial - ${monthCap} ${info.year} - Sampuran English</title>
<style>
body{
margin:0;
font-family:Arial,Helvetica,sans-serif;
background:#f2f2f2;
}
.page-header{
background:#0d4ea6;
color:white;
padding:20px;
text-align:center;
}
.page-header h1{
margin:0;
font-size:38px;
}
.container{
width:90%;
max-width:1000px;
margin:40px auto;
}
.day{
background:white;
padding:20px;
margin-bottom:20px;
border-radius:10px;
box-shadow:0 0 10px rgba(0,0,0,.1);
border:1px solid rgba(13,78,166,0.15);
transition:.3s;
}
.day:hover{
transform:translateY(-3px);
}
.day a{
text-decoration:none;
font-size:22px;
font-weight:bold;
color:#0d4ea6;
display:block;
}
.back{
margin-top:40px;
text-align:center;
}
.back a{
text-decoration:none;
background:#0d4ea6;
color:white;
padding:12px 25px;
border-radius:6px;
font-size:18px;
}
.back a:hover{
background:#083b7d;
}
footer{
margin-top:50px;
background:#222;
color:white;
text-align:center;
padding:20px;
}
</style>
</head>
<body>
<div id="site-header"></div>
<div class="page-header">
<h1>Editorial - ${monthCap} ${info.year}</h1>
</div>
<div class="container">
<!-- ENTRIES -->
<div class="back">
<a href="${yearPage}">← Back to Editorial ${info.year}</a>
</div>
</div>
<footer>
© Sampuran English
</footer>
<script>
fetch('header.html')
  .then(function(response){ return response.text(); })
  .then(function(html){
    document.getElementById('site-header').innerHTML = html;
    window.scrollTo(0, 0);
    document.getElementById('menuToggle').addEventListener('click', function(){
      document.getElementById('menuList').classList.toggle('open');
    });
  });
</script>
</body>
</html>
`;
  fs.writeFileSync(p, skeleton);
  ensureYearListingHasMonth(yearPage, info, 'editorial');
  return p;
}

function updateEditorialMonthPage(info, filename) {
  const p = ensureEditorialMonthPage(info);
  const content = fs.readFileSync(p, 'utf8');
  if (content.includes(filename)) {
    console.log(`"${filename}" is already listed on ${p} -- not adding a duplicate.`);
    return;
  }
  const entryRegex = /<div class="day">\s*<a\b[^>]*href="[^"]*Perfect Editorial Practice \([^)]*\)\.html"[^>]*>/g;
  const monthCap = cap(MONTHS[info.month - 1]);

  const genericEntry = () => `<div class="day">\n<a href="${filename}">📖 ${info.day} ${monthCap} — Perfect Editorial Practice</a>\n</div>`;
  const cloneEntry = (template) => {
    const oldFilenameMatch = template.match(/Perfect Editorial Practice \([^)]*\)\.html/);
    const oldLabelMatch = template.match(/\d{1,2}\s+[A-Za-z]+/);
    if (!oldFilenameMatch || !oldLabelMatch) return genericEntry();
    let out = template.split(oldFilenameMatch[0]).join(filename);
    out = out.split(oldLabelMatch[0]).join(`${info.day} ${monthCap}`);
    return out;
  };

  const updated = insertEntry(content, entryRegex, genericEntry, cloneEntry);
  fs.writeFileSync(p, updated);
}

// ---------------- Monthly page: Mock Test ----------------

function mockTestMonthPagePath(info) {
  return `${MONTHS[info.month - 1]}-${info.year}.html`;
}

function ensureMockTestMonthPage(info) {
  const p = mockTestMonthPagePath(info);
  if (fs.existsSync(p) && !fs.readFileSync(p, 'utf8').includes('<title>Loading...</title>')) return p;
  const monthCap = cap(MONTHS[info.month - 1]);
  const yearPage = `${info.year}.html`;
  const skeleton = `<!DOCTYPE html>
<html lang="en">
<head>
<script>
if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${monthCap} ${info.year} Mock Tests</title>
<style>
body{
margin:0;
font-family:Arial,Helvetica,sans-serif;
background:#f2f2f2;
}
.page-header{

background:#1f2937;
color:white;
padding:20px;
text-align:center;
}
.page-header h1{
margin:0;
font-size:38px;
}
.container{
width:90%;
max-width:1000px;
margin:40px auto;
}
.mock{
background:white;
padding:20px;
margin-bottom:20px;
border-radius:10px;
box-shadow:0 0 10px rgba(0,0,0,.1);
}
.mock h2{
margin-top:0;
color:#004aad;
}
.button{
display:inline-block;
margin-top:15px;
padding:12px 25px;
background:#004aad;
color:white;
text-decoration:none;
border-radius:6px;
font-size:18px;
}
.button:hover{
background:#00317c;
}
.back{
margin-top:40px;
text-align:center;
}
.back a{
text-decoration:none;
background:#222;
color:white;
padding:12px 25px;
border-radius:6px;
font-size:18px;
}
.back a:hover{
background:#000;
}
footer{
margin-top:50px;
background:#222;
color:white;
text-align:center;
padding:20px;
}
</style>
</head>
<body>

<div id="site-header"></div>

<div class="page-header">
<h1>${monthCap} ${info.year} Daily Mock Tests</h1>
</div>
<div class="container">
<!-- ENTRIES -->
<div class="back">
<a href="${yearPage}">← Back to ${info.year}</a>
</div>
</div>
<footer>
© Sampuran English
</footer>

<script>
fetch('header.html')
  .then(function(response){ return response.text(); })
  .then(function(html){
    document.getElementById('site-header').innerHTML = html;
    window.scrollTo(0, 0);
    document.getElementById('menuToggle').addEventListener('click', function(){
      document.getElementById('menuList').classList.toggle('open');
    });
  });
</script>

</body>
</html>
`;
  fs.writeFileSync(p, skeleton);
  ensureYearListingHasMonth(yearPage, info, 'mocktest');
  return p;
}

function updateMockTestMonthPage(info, filename) {
  const p = ensureMockTestMonthPage(info);
  const content = fs.readFileSync(p, 'utf8');
  if (content.includes(filename)) {
    console.log(`"${filename}" is already listed on ${p} -- not adding a duplicate.`);
    return;
  }
  const entryRegex = /<div class="mock">\s*<h[1-6][^>]*>\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}\s*-\s*English Mock Test\s*\d+/g;
  const monthCap = cap(MONTHS[info.month - 1]);

  const genericEntry = () =>
    `<div class="mock">\n<h2>${info.day} ${monthCap} ${info.year} - English Mock Test ${info.testNum}</h2>\n<a class="button" href="${filename}">Start Mock Test</a>\n</div>`;
  const cloneEntry = (template) => {
    const oldHeadingMatch = template.match(/\d{1,2}\s+[A-Za-z]+\s+\d{4}\s*-\s*English Mock Test\s*\d+/);
    const oldFilenameMatch = template.match(/\d{1,2}-\d{1,2}-\d{4} English Mock Test -\d+\.html/);
    if (!oldHeadingMatch || !oldFilenameMatch) return genericEntry();
    let out = template.split(oldFilenameMatch[0]).join(filename);
    out = out.split(oldHeadingMatch[0]).join(`${info.day} ${monthCap} ${info.year} - English Mock Test ${info.testNum}`);
    return out;
  };

  const updated = insertEntry(content, entryRegex, genericEntry, cloneEntry);
  fs.writeFileSync(p, updated);
}

// ---------------- Year listing pages (2026.html / editorial-2026.html) ----------------

function ensureYearListingHasMonth(yearPagePath, info, type) {
  if (!fs.existsSync(yearPagePath)) return; // out of scope: brand-new year page not auto-created
  const content = fs.readFileSync(yearPagePath, 'utf8');
  const monthPage = type === 'editorial' ? editorialMonthPagePath(info) : mockTestMonthPagePath(info);
  if (content.includes(monthPage)) return; // already listed

  const monthCap = cap(MONTHS[info.month - 1]);
  const entryRegex = type === 'editorial'
    ? /<a\b[^>]*href="editorial-[a-z]+-\d{4}\.html"[^>]*>/g
    : /<a\b[^>]*href="[a-z]+-\d{4}\.html"[^>]*>/g;

  const genericEntry = () => `<p><a href="${monthPage}">📅 ${monthCap}</a></p>`;
  const cloneEntry = (template) => {
    const oldHrefMatch = template.match(/href="([a-z-]+\.html)"/);
    const oldLabelMatch = template.match(/[A-Z][a-z]+/); // month name shown, e.g. "September"
    if (!oldHrefMatch || !oldLabelMatch) return genericEntry();
    let out = template.split(oldHrefMatch[1]).join(monthPage);
    out = out.split(oldLabelMatch[0]).join(monthCap);
    return out;
  };

  const updated = insertEntry(content, entryRegex, genericEntry, cloneEntry);
  fs.writeFileSync(yearPagePath, updated);
}

// ---------------- Main processing ----------------

async function processDocument(fileName, fileId) {
  const info = identify(fileName);
  if (!info) {
    console.log(`Skipping "${fileName}": couldn't find a valid date, or couldn't tell if it's an Editorial or Mock Test file (mock tests also need a number, e.g. "-80").`);
    return;
  }
  const finalName = canonicalFilename(info);
  await downloadTelegramFile(fileId, finalName);

  if (info.type === 'editorial') {
    updateEditorialMonthPage(info, finalName);
    console.log(`Uploaded editorial for ${info.day}-${info.month}-${info.year} as "${finalName}".`);
  } else {
    updateMockTestMonthPage(info, finalName);
    console.log(`Uploaded mock test #${info.testNum} for ${info.day}-${info.month}-${info.year} as "${finalName}".`);
  }
}

async function main() {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variable.');
  }
  const offset = readOffset();
  const updates = await tg('getUpdates', { offset: offset + 1, timeout: 0, allowed_updates: ['message'] });

  let highestUpdateId = offset;
  for (const update of updates) {
    highestUpdateId = Math.max(highestUpdateId, update.update_id);
    const msg = update.message;
    if (!msg || !msg.document) continue;
    if (String(msg.chat.id) !== String(CHAT_ID)) continue;
    const fileName = msg.document.file_name || '';
    if (!fileName.toLowerCase().endsWith('.html')) continue;

    try {
      await processDocument(fileName, msg.document.file_id);
    } catch (err) {
      console.error(`Failed to process "${fileName}": ${err.message}`);
    }
  }
  writeOffset(highestUpdateId);
}

main().catch(err => { console.error(err); process.exit(1); });
