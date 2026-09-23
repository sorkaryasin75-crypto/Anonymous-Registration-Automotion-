try {
  require('dotenv').config();
} catch (e) {
  // GitHub Actions বা ক্লাউড এনভায়রনমেন্টের জন্য
}

const { chromium, firefox, webkit } = require('playwright');
const UserAgent = require('user-agents');

const TARGET_URL = process.env.TARGET_URL || 'https://moneyloop24.blogspot.com/?m=1';
const TOTAL_REGISTRATIONS = parseInt(process.env.REG_COUNT || '10', 10);
const PING_INTERVAL_MS = parseInt(process.env.PING_INTERVAL_MS || '300000', 10);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const PROXY_SERVER = process.env.PROXY_SERVER;

const PUBLIC_CHANNELS = [
  'telegram', 'durov', 'tech', 'crypto', 'news', 'bengali', 'discussion', 'community', 'trading', 'airdrop'
];

let discoveredRealUsers = [];

async function sendTelegramNotification(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'HTML' })
    });
  } catch (err) {
    console.error('Telegram Notification Error:', err.message);
  }
}

// টেলিগ্রাম API দিয়ে রিয়েল ইউজার ভ্যালিডেট করা
async function fetchRealTelegramUser(username) {
  if (!TELEGRAM_BOT_TOKEN || !username) return null;
  
  const cleanUsername = username.replace('@', '').trim();
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=@${cleanUsername}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.ok && data.result && data.result.type === 'private') {
      const chat = data.result;
      return {
        id: chat.id,
        first_name: chat.first_name || 'User',
        last_name: chat.last_name || '',
        username: chat.username || cleanUsername,
        language_code: 'en',
        allows_write_to_pm: true
      };
    }
  } catch (err) {
    // অকার্যকর বা প্রাইভেট অ্যাকাউন্ট বাদ যাবে
  }
  return null;
}

// পাবলিক চ্যানেল ও ওয়েব স্ক্যাপ করে রিয়েল ইউজার বের করা
async function scrapeRealUsernamesFromWeb() {
  console.log('🔍 পাবলিক চ্যানেল ও ওয়েব পেজ থেকে রিয়েল ইউজার স্ক্যান করা হচ্ছে...');
  const foundUsernames = new Set();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const keyword of PUBLIC_CHANNELS) {
    try {
      await page.goto(`https://t.me/s/${keyword}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const content = await page.content();
      
      const matches = content.match(/@([a-zA-Z0-9_]{5,32})/g);
      if (matches) {
        matches.forEach(u => foundUsernames.add(u.replace('@', '')));
      }
    } catch (e) {
      // নির্দিষ্ট ইউআরএল স্কিপ করবে
    }
  }

  await browser.close();
  return Array.from(foundUsernames);
}

// রিয়েল ইউজার কিউ জেনারেটর
async function getNextRealTelegramUser() {
  while (discoveredRealUsers.length === 0) {
    const candidateUsernames = await scrapeRealUsernamesFromWeb();
    
    for (const username of candidateUsernames) {
      console.log(`[🔎 Validating Real User]: @${username}`);
      const validUser = await fetchRealTelegramUser(username);
      
      if (validUser) {
        discoveredRealUsers.push(validUser);
      }
    }

    if (discoveredRealUsers.length === 0) {
      console.log('⚠️ কোনো রিয়েল ইউজার পাওয়া যায়নি। ১০ সেকেন্ড পর আবার স্ক্যান করা হবে...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  const selectedUser = discoveredRealUsers.shift();
  
  const userJson = encodeURIComponent(JSON.stringify(selectedUser));
  const initData = `user=${userJson}&auth_date=${Math.floor(Date.now() / 1000)}&hash=c1a32b6e7f8d90e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5`;

  return {
    initData,
    userObj: selectedUser,
    telegramId: selectedUser.id,
    username: selectedUser.username,
    fullName: `${selectedUser.first_name} ${selectedUser.last_name}`.trim()
  };
}

// ডাইনামিক ব্রাউজার সিলেক্টর (Chromium, Firefox, WebKit)
function getRandomBrowserType() {
  const types = [chromium, firefox, webkit];
  const choice = types[Math.floor(Math.random() * types.length)];
  return choice;
}

function generateRandomUserAgent() {
  const categories = ['mobile', 'desktop'];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const userAgent = new UserAgent({ deviceCategory: randomCategory });
  return userAgent.toString();
}

function startBackgroundKeepAlive(page, tgUser) {
  setInterval(async () => {
    try {
      if (!page.isClosed()) {
        await page.evaluate(() => {
          window.dispatchEvent(new Event('focus'));
          window.dispatchEvent(new Event('mousemove'));
        });
      }
    } catch (err) {
      // ব্যাকগ্রাউন্ড ট্র্যাকিং ইগনোর করবে
    }
  }, PING_INTERVAL_MS);
}

async function runTelegramAppRegistration(index) {
  const tgUser = await getNextRealTelegramUser();
  const dynamicUserAgent = generateRandomUserAgent();

  // নেটওয়ার্ক ও পারফরম্যান্স বুস্টিং ফ্ল্যাগস
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-extensions',
    '--disable-features=Translate,BackForwardCache',
    '--disable-ipc-flooding-protection',
    '--disable-renderer-backgrounding',
    '--enable-tcp-fastopen',
    '--enable-async-dns'
  ];

  const launchOptions = {
    headless: true,
    args: launchArgs
  };

  if (PROXY_SERVER) {
    const proxyUrl = PROXY_SERVER.includes('session-') 
      ? PROXY_SERVER 
      : `${PROXY_SERVER}?session=${Math.random().toString(36).substring(7)}`;

    launchOptions.proxy = { server: proxyUrl };
  }

  // র্যান্ডম ব্রাউজার ইঞ্জিন সিলেক্ট
  const selectedBrowserEngine = getRandomBrowserType();
  const browser = await selectedBrowserEngine.launch(launchOptions);

  const context = await browser.newContext({
    userAgent: dynamicUserAgent,
    viewport: { width: 360, height: 740 },
    locale: 'en-US',
    ignoreHTTPSErrors: true // নেটওয়ার্ক ফেইলুর এড়াতে HTTPS সার্টিফিকেট এরর ইগনোর করবে
  });

  const page = await context.newPage();

  // নেটওয়ার্ক স্পিড বাড়াতে ইমেজ, ভিডিও, ফ্রন্টস ও স্টাইল ব্লক করা
  await page.route('**/*.{png,jpg,jpeg,gif,svg,webp,mp4,mp3,woff,woff2,ttf,otf,css}', route => route.abort());

  let isSuccess = false;
  let errorMsg = '';

  try {
    console.log(`[${index + 1}/${TOTAL_REGISTRATIONS}] [${browser.name()}] প্রসেসিং রিয়েল ইউজার: ${tgUser.fullName} (@${tgUser.username}) | ID: ${tgUser.telegramId}`);

    // ওয়েব অ্যাপ ডাটা ইনজেক্ট
    await page.addInitScript((tgData) => {
      window.Telegram = {
        WebApp: {
          initData: tgData.initData,
          initDataUnsafe: { user: tgData.userObj },
          version: "6.0",
          platform: "android",
          ready: () => {},
          expand: () => {},
          close: () => {}
        }
      };
    }, { initData: tgUser.initData, userObj: tgUser.userObj });

    // টার্গেট পেজে হাই-স্পিড নেভিগেশন
    await page.goto(TARGET_URL, { waitUntil: 'commit', timeout: 45000 });

    await page.evaluate((tgData) => {
      window.location.hash = `#tgWebAppData=${encodeURIComponent(tgData.initData)}&tgWebAppVersion=6.0&tgWebAppPlatform=android`;
      window.dispatchEvent(new Event('hashchange'));
    }, { initData: tgUser.initData });

    // সাইটের কনফার্মেশন টেস্টের জন্য অপেক্ষা
    await page.waitForFunction(() => {
      const bodyText = document.body ? document.body.innerText : '';
      return bodyText.includes('ACCOUNT ID') || bodyText.includes('Accepted Sales') || !!document.querySelector('.account-id');
    }, { timeout: 60000 });

    isSuccess = true;
    console.log(`✔ [${index + 1}] সফল রেজিস্ট্রেশন [Engine: ${browser.name()}]: @${tgUser.username}`);

    startBackgroundKeepAlive(page, tgUser);

  } catch (err) {
    errorMsg = err.message;
    console.error(`✖ [${index + 1}] ব্যর্থ: ${errorMsg}`);
    await context.close();
    await browser.close();
  }

  return { isSuccess, user: tgUser, error: errorMsg, browser, context, page };
}

async function main() {
  let successCount = 0;
  let failCount = 0;
  const activeSessions = [];

  await sendTelegramNotification(
    `🚀 <b>Multi-Engine + Network Boosted Automation Started</b>\n\n<b>Target:</b> ${TARGET_URL}\n<b>Tasks:</b> ${TOTAL_REGISTRATIONS} টি\n⚡ <b>Mode:</b> Multi-Browser (Chromium, Firefox, WebKit) + Real User Validation`
  );

  for (let i = 0; i < TOTAL_REGISTRATIONS; i++) {
    const result = await runTelegramAppRegistration(i);

    if (result.isSuccess) {
      successCount++;
      activeSessions.push(result);
      await sendTelegramNotification(
        `✅ <b>রেজিস্ট্রেশন সফল [${i + 1}/${TOTAL_REGISTRATIONS}]</b>\n<b>ইউজার:</b> ${result.user.fullName} (@${result.user.username})\n<b>আইডি:</b> <code>${result.user.telegramId}</code>\n🟢 <b>ইঞ্জিন:</b> Multi-Browser Session Active`
      );
    } else {
      failCount++;
      await sendTelegramNotification(
        `❌ <b>রেজিস্ট্রেশন ব্যর্থ [${i + 1}/${TOTAL_REGISTRATIONS}]</b>\n<b>ইউজার:</b> @${result.user.username}\n<b>কারণ:</b> ${result.error}`
      );
    }
  }

  await sendTelegramNotification(
    `📊 <b>চূড়ান্ত অটোমেশন রিপোর্ট</b>\n\n✅ <b>সফল ও অ্যাক্টিভ রিয়েল ইউজার:</b> ${successCount} টি\n❌ <b>ব্যর্থ:</b> ${failCount} টি`
  );

  console.log(`সকল প্রসেস সম্পন্ন হয়েছে। মোট ${activeSessions.length} টি সেশন অল-টাইম ব্যাকগ্রাউন্ডে অ্যাক্টিভ রাখা হয়েছে...`);
}

main();
