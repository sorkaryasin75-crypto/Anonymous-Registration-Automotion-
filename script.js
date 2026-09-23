const { chromium } = require('playwright');
const UserAgent = require('user-agents');
const { faker } = require('@faker-js/faker');

const TARGET_URL = process.env.TARGET_URL || 'https://moneyloop24.blogspot.com/?m=1';
const TOTAL_REGISTRATIONS = parseInt(process.env.REG_COUNT || '10', 10);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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

function generateTelegramUserData() {
  const telegramId = Math.floor(100000000 + Math.random() * 900000000);
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const username = faker.internet.userName({ firstName, lastName }).toLowerCase();

  const userObj = {
    id: telegramId,
    first_name: firstName,
    last_name: lastName,
    username: username,
    language_code: "en",
    allows_write_to_pm: true
  };

  const userJson = encodeURIComponent(JSON.stringify(userObj));
  const initData = `user=${userJson}&auth_date=${Math.floor(Date.now() / 1000)}&hash=c1a32b6e7f8d90e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5`;

  return { initData, userObj, telegramId, username, fullName: `${firstName} ${lastName}` };
}

async function runTelegramAppRegistration(index) {
  const tgUser = generateTelegramUserData();
  const userAgent = new UserAgent({ deviceCategory: 'mobile' }).toString();

  const browser = await chromium.launch({
    headless: true,
    args: [
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
      '--disable-renderer-backgrounding'
    ]
  });

  const context = await browser.newContext({
    userAgent: userAgent,
    viewport: { width: 360, height: 740 },
    locale: 'en-US'
  });

  const page = await context.newPage();

  await page.route('**/*.{png,jpg,jpeg,gif,svg,webp,mp4,mp3,woff,woff2,ttf,otf,css}', route => route.abort());

  let isSuccess = false;
  let errorMsg = '';

  try {
    console.log(`[${index + 1}/${TOTAL_REGISTRATIONS}] প্রসেসিং: ${tgUser.fullName} (@${tgUser.username})`);

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

    await page.goto(TARGET_URL, { waitUntil: 'commit', timeout: 0 });

    await page.evaluate((tgData) => {
      window.location.hash = `#tgWebAppData=${encodeURIComponent(tgData.initData)}&tgWebAppVersion=6.0&tgWebAppPlatform=android`;
      window.dispatchEvent(new Event('hashchange'));
    }, { initData: tgUser.initData });

    await page.waitForFunction(() => {
      const bodyText = document.body ? document.body.innerText : '';
      return bodyText.includes('ACCOUNT ID') || bodyText.includes('Accepted Sales') || !!document.querySelector('.account-id');
    }, { timeout: 0 });

    isSuccess = true;
    console.log(`✔ [${index + 1}] সাইটের লোডিং সম্পন্ন এবং ডাটা রেজিস্টার্ড: @${tgUser.username}`);

  } catch (err) {
    errorMsg = err.message;
    console.error(`✖ [${index + 1}] ব্যর্থ: ${errorMsg}`);
  } finally {
    await context.close();
    await browser.close();
  }

  return { isSuccess, user: tgUser, error: errorMsg };
}

async function main() {
  let successCount = 0;
  let failCount = 0;

  await sendTelegramNotification(
    `🚀 <b>ডাইনামিক সিস্টেম-ভিত্তিক অটোমেশন শুরু</b>\n\n<b>টার্গেট:</b> ${TARGET_URL}\n<b>মোট টাস্ক:</b> ${TOTAL_REGISTRATIONS} টি`
  );

  for (let i = 0; i < TOTAL_REGISTRATIONS; i++) {
    const result = await runTelegramAppRegistration(i);

    if (result.isSuccess) {
      successCount++;
      await sendTelegramNotification(
        `✅ <b>রেজিস্ট্রেশন সফল [${i + 1}/${TOTAL_REGISTRATIONS}]</b>\n<b>ইউজার:</b> ${result.user.fullName} (@${result.user.username})\n<b>আইডি:</b> <code>${result.user.telegramId}</code>`
      );
    } else {
      failCount++;
      await sendTelegramNotification(
        `❌ <b>রেজিস্ট্রেশন ব্যর্থ [${i + 1}/${TOTAL_REGISTRATIONS}]</b>\n<b>ইউজার:</b> @${result.user.username}\n<b>কারণ:</b> ${result.error}`
      );
    }
  }

  await sendTelegramNotification(
    `📊 <b>চূড়ান্ত অটোমেশন রিপোর্ট</b>\n\n✅ <b>সফল:</b> ${successCount} টি\n❌ <b>ব্যর্থ:</b> ${failCount} টি`
  );

  console.log('সকল প্রসেস সম্পন্ন হয়েছে।');
}

main();
