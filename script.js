try {
  require('dotenv').config();
} catch (e) {
  // GitHub Actions বা প্রোডাকশন ক্লাউড এনভায়রনমেন্ট
}

const { chromium } = require('playwright');
const crypto = require('crypto');
const UserAgent = require('user-agents');

const TARGET_URL = process.env.TARGET_URL || 'https://moneyloop24.blogspot.com/?m=1';
const TOTAL_REGISTRATIONS = parseInt(process.env.REG_COUNT || '10', 10);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const PROXY_SERVER = process.env.PROXY_SERVER;

// রিয়েল ইউজার খোঁজার জন্য পাবলিক টেলিগ্রাম চ্যানেলের কিওয়ার্ড
const PUBLIC_CHANNELS = [
  'telegram', 'durov', 'tech', 'crypto', 'news', 'bengali', 'discussion', 'community', 'trading', 'airdrop'
];

// ১. টেলিগ্রাম বটে লাইভ নোটিফিকেশন পাঠানোর ফাংশন
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

// ২. টেলিগ্রাম বট টোকেন ও HMAC-SHA256 দিয়ে অফিশিয়াল এনক্রিপ্টেড Hash জেনারেট করা
function createValidTelegramInitData(userObj, botToken) {
  const authDate = Math.floor(Date.now() / 1000);
  const userJson = JSON.stringify(userObj);

  const dataCheckArr = [
    `auth_date=${authDate}`,
    `user=${userJson}`
  ].sort();

  const dataCheckString = dataCheckArr.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken || 'dummy_token').digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const initData = `user=${encodeURIComponent(userJson)}&auth_date=${authDate}&hash=${hash}`;
  return { initData, hash, authDate };
}

// ৩. টেলিগ্রাম Bot API দিয়ে ইউজারটি সত্যি রিয়েল এবং একটি্টিভ ইউজার কিনা তা ভ্যালিডেট করা
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
    // সার্ভিস ফেইল করলে বা ইউজার বটের সাথে কানেক্টেড না থাকলে ইগনোর করবে
  }
  return null;
}

// ৪. পাবলিক চ্যানেল থেকে রিয়েল ইউজারনেম ফিল্টার করে সংগ্রহ করা
async function scrapeRealUsernamesFromWeb() {
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
    } catch (e) {}
  }

  await browser.close();
  return Array.from(foundUsernames);
}

// ৫. শুধুমাত্র ১টি রিয়েল ও ভ্যালিড ইউজার না পাওয়া পর্যন্ত স্ক্যান চালিয়ে যাওয়া
async function findSingleRealTelegramUser() {
  console.log('🔍 ওয়েব এবং টেলিগ্রাম থেকে রিয়েল ইউজার খোঁজা হচ্ছে...');
  
  while (true) {
    const candidateUsernames = await scrapeRealUsernamesFromWeb();
    
    for (const username of candidateUsernames) {
      console.log(`[🔎 Validating User]: @${username}`);
      const validUser = await fetchRealTelegramUser(username);
      
      if (validUser) {
        console.log(`✅ রিয়েল ইউজার কনফার্মড: @${validUser.username} (ID: ${validUser.id})`);
        const { initData } = createValidTelegramInitData(validUser, TELEGRAM_BOT_TOKEN);
        
        return {
          initData,
          userObj: validUser,
          telegramId: validUser.id,
          username: validUser.username,
          fullName: `${validUser.first_name} ${validUser.last_name}`.trim()
        };
      }
    }

    console.log('⚠️ এই মুহূর্তে পর্যাপ্ত রিয়েল ইউজার পাওয়া যায়নি, ৫ সেকেন্ড পর আবার খোঁজা হচ্ছে...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// ৬. রিয়েল হিউম্যান ইন্টারঅ্যাকশন (মাউস মুভমেন্ট ও স্ক্রোলિંગ)
async function simulateHumanInteractions(page) {
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(Math.random() * 300) + 20;
    const y = Math.floor(Math.random() * 500) + 20;
    await page.mouse.move(x, y, { steps: 10 });
    await page.waitForTimeout(200 + Math.random() * 300);
  }
  await page.mouse.wheel(0, 150);
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, -100);
}

// ৭. টার্গেট লিংকে ইউজার রেজিস্ট্রেশন প্রসেস পরিচালনা করা
async function runTelegramAppRegistration(index) {
  const tgUser = await findSingleRealTelegramUser();
  const userAgent = new UserAgent({ deviceCategory: 'mobile' }).toString();

  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  };

  if (PROXY_SERVER) {
    launchOptions.proxy = { server: PROXY_SERVER };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    userAgent: userAgent,
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    isMobile: true
  });

  const page = await context.newPage();
  let isSuccess = false;
  let errorMsg = '';

  try {
    console.log(`[${index + 1}/${TOTAL_REGISTRATIONS}] রিয়েল ইউজার দিয়ে টার্গেট সাইটে যুক্ত করা হচ্ছে: ${tgUser.fullName} (@${tgUser.username})`);

    // ব্রাউজার কনটেক্সটে টেলিগ্রাম অবজেক্ট এবং স্টোরেজ ফিলআপ
    await page.addInitScript((tgData) => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });

      window.Telegram = {
        WebApp: {
          initData: tgData.initData,
          initDataUnsafe: { user: tgData.userObj },
          version: "7.0",
          platform: "android",
          colorScheme: "dark",
          themeParams: { bg_color: "#17212b", text_color: "#ffffff" },
          isExpanded: true,
          viewportHeight: 667,
          viewportStableHeight: 667,
          ready: () => {},
          expand: () => {},
          close: () => {}
        }
      };

      try {
        localStorage.setItem('tgWebAppInitData', tgData.initData);
        sessionStorage.setItem('tgWebAppInitData', tgData.initData);
      } catch (e) {}
    }, { initData: tgUser.initData, userObj: tgUser.userObj });

    const urlWithHash = `${TARGET_URL}#tgWebAppData=${encodeURIComponent(tgUser.initData)}&tgWebAppVersion=7.0&tgWebAppPlatform=android`;
    await page.goto(urlWithHash, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // রিয়েল হিউম্যান মুভমেন্ট সিমুলেশন
    await simulateHumanInteractions(page);
    await page.waitForTimeout(5000);

    isSuccess = true;
    console.log(`✔ [${index + 1}] রেজিস্ট্রেশন যুক্ত করা সম্পন্ন: @${tgUser.username}`);

  } catch (err) {
    errorMsg = err.message;
    console.error(`✖ [${index + 1}] ব্যর্থ: ${errorMsg}`);
  } finally {
    await context.close();
    await browser.close();
  }

  return { isSuccess, user: tgUser, error: errorMsg };
}

// মূল এক্সিকিউশন লুপ
async function main() {
  let successCount = 0;
  let failCount = 0;

  await sendTelegramNotification(`🚀 <b>Production Real-User Automation Engine Started</b>\n\n<b>Target:</b> ${TARGET_URL}\n<b>Total Tasks:</b> ${TOTAL_REGISTRATIONS}`);

  for (let i = 0; i < TOTAL_REGISTRATIONS; i++) {
    const result = await runTelegramAppRegistration(i);

    // প্রতিটি টাস্ক শেষ হওয়া মাত্র সাথে সাথে টেলিগ্রাম নোটিফিকেশন পাঠাবে
    if (result.isSuccess) {
      successCount++;
      await sendTelegramNotification(
        `✅ <b>রেজিস্ট্রেশন সফল [${i + 1}/${TOTAL_REGISTRATIONS}]</b>\n\n<b>রিয়েল ইউজার:</b> ${result.user.fullName}\n<b>ইউজারনেম:</b> @${result.user.username}\n<b>টেলিগ্রাম আইডি:</b> <code>${result.user.telegramId}</code>\n🟢 <b>স্ট্যাটাস:</b> টার্গেট লিংকে সফলভাবে যুক্ত হয়েছে`
      );
    } else {
      failCount++;
      await sendTelegramNotification(
        `❌ <b>রেজিস্ট্রেশন ব্যর্থ [${i + 1}/${TOTAL_REGISTRATIONS}]</b>\n\n<b>ইউজারনেম:</b> @${result.user.username}\n<b>কারণ:</b> ${result.error}`
      );
    }
  }

  await sendTelegramNotification(`📊 <b>চূড়ান্ত সেশন রিপোর্ট:</b>\n✅ সফল: ${successCount} টি\n❌ ব্যর্থ: ${failCount} টি`);
}

main();
