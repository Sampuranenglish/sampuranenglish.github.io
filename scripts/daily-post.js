// daily-post.js
//
// What this does, in plain English:
// 1. Downloads your live homepage (index.html).
// 2. Pulls out the same three lists of Rules / Words / Idioms that your
//    site's own JavaScript uses.
// 3. Works out which one is "today's", using the exact same formula your
//    site uses (day-of-year), calculated for India time (Asia/Kolkata) so
//    it matches what visitors see.
// 4. Sends it to your Telegram group as one plain text message.
//
// If step 1-3 fail for any reason (site unreachable, format changed,
// list empty), the script simply stops and posts NOTHING -- no error
// message, no placeholder text is ever sent to the group.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SITE_URL = 'https://sampuranenglish.github.io/index.html';

function extractArray(html, varName) {
  const re = new RegExp(`var ${varName} = (\\[[\\s\\S]*?\\]);`);
  const match = html.match(re);
  if (!match) return null;
  try {
    // The site's own array literal is valid JavaScript, so we let the JS
    // engine itself parse it -- this avoids any manual quote-escaping bugs.
    // eslint-disable-next-line no-new-func
    return new Function(`return ${match[1]};`)();
  } catch (e) {
    return null;
  }
}

function todayDayOfYearIST() {
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const startOfYear = new Date(nowIST.getFullYear(), 0, 0);
  const diff = nowIST - startOfYear;
  return Math.floor(diff / 86400000);
}

async function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      disable_web_page_preview: true
    })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMessage failed: ${JSON.stringify(data)}`);
}

async function main() {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variable.');
  }

  const res = await fetch(SITE_URL, { cache: 'no-cache' });
  if (!res.ok) {
    console.log(`Site fetch failed (${res.status}). Not posting today.`);
    return;
  }
  const html = await res.text();

  const rules = extractArray(html, 'rules');
  const words = extractArray(html, 'words');
  const idioms = extractArray(html, 'idioms');

  if (!rules || !rules.length || !words || !words.length || !idioms || !idioms.length) {
    console.log('Could not read Rule/Word/Idiom lists from the site. Not posting today.');
    return;
  }

  const dayOfYear = todayDayOfYearIST();
  const rule = rules[dayOfYear % rules.length];
  const word = words[dayOfYear % words.length];
  const idiom = idioms[dayOfYear % idioms.length];

  if (!rule || !word || !idiom) {
    console.log('Could not determine today\'s content. Not posting today.');
    return;
  }

  const text =
`📜 Rule of the Day

${rule.rule}
${rule.wrong}
${rule.right}

🔤 Word of the Day

${word.word} — ${word.meaning}
Ex- ${word.example}
Synonyms: ${word.synonyms}
Antonyms: ${word.antonyms}

🗣️ Idiom of the Day

${idiom.idiom} — ${idiom.meaning}
Ex- ${idiom.example}`;

  await sendTelegramMessage(text);
  console.log('Posted today\'s Rule/Word/Idiom to Telegram.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
