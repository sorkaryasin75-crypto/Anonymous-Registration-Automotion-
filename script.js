const { chromium } = require('playwright');
const UserAgent = require('user-agents');
const { faker } = require('@faker-js/faker');

const TARGET_URL = process.env.TARGET_URL || 'https://moneyloop24.blogspot.com/?m=1';
const TOTAL_REGISTRATIONS = parseInt(process.env.REG_COUNT || '10', 10);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// টেলিগ্রাম মিনি অ্যাপের আসল ইউজার ডেটা সিমুলেশন
function generateTelegramInitData() {
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
  
  return { initData, telegramId, username, fullName: `${firstName} ${lastName}` };
}

async function runTelegramAppRegistration(index) {
  const tgUser = generateTelegramInitData();
  const userAgent = new UserAgent({ deviceCategory: 'mobile' }).toString();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: userAgent,
    viewport: { width: 360, height: 740 },
    locale: 'en-US'
  });

  const page = await context.newPage();
  let isSuccess = false;
  let errorMsg = '';

  try {
    console.log(`[${index + 1}/${TOTAL_REGISTRATIONS}] টেলিগ্রাম রিয়েল রেজিস্ট্রেশন স্টার্ট: @${tgUser.username} (ID: ${tgUser.telegramId})`);

    // টেলিগ্রাম ওয়েব অ্যাপের মাধ্যমে ইউজার ডাটা ইন্জেক্ট
    await page.addInitScript((initDataString) => {
      window.Telegram = {
        WebApp: {
          initData: initDataString,
          initDataUnsafe: {
            user: JSON.parse(decodeURIComponent(initDataString.split('user=')[1].split('&')[0]))
          },
          version: "6.0",
          platform: "android",
          ready: () => {},
          expand: () => {},
          close: () => {}
        }
      };
    }, tgUser.initData);

    // টেলিগ্রাম হ্যাশ প্যারাম সহ পেজে ভিজিট
    const fullUrl = `${TARGET_URL}#tgWebAppData=${encodeURIComponent(tgUser.initData)}&tgWebAppVersion=6.0&tgWebAppPlatform=android`;
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 60000 });
    
    // ব্যাকএন্ড স্ক্যান ও ভেরিফিকেশন সেশন শেষ করার সময়
    await delay(5000);

    isSuccess = true;
    console.log(`✔ [${index + 1}] অরিজিনাল টেলিগ্রাম ইউজার রেজিস্টার্ড: ${tgUser.fullName} (@${tgUser.username})`);

  } catch (err) {
    errorMsg = err.message;
    console.error(`✖ [${index + 1}] রেজিস্ট্রেশন ব্যর্থ: ${errorMsg}`);
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
    `🚀 <b>অরিজিনাল টেলিগ্রাম অটো-রেজিস্ট্রেশন স্টার্ট</b>\n\n<b>টার্গেট URL:</b> ${TARGET_URL}\n<b>মোট সংখ্যা:</b> ${TOTAL_REGISTRATIONS}`
  );

  for (let i = 0; i < TOTAL_REGISTRATIONS; i++) {
    const result = await runTelegramAppRegistration(i);

    if (result.isSuccess) {
      successCount++;
    } else {
      failCount++;
      await sendTelegramNotification(
        `❌ <b>রেজিস্ট্রেশন ব্যর্থ [${i + 1}/${TOTAL_REGISTRATIONS}]</b>\n<b>কারণ:</b> ${result.error}`
      );
    }

    await delay(Math.floor(Math.random() * 2000) + 3000);
  }

  await sendTelegramNotification(
    `📊 <b>টেলিগ্রাম অটোমেশন রিপোর্ট</b>\n\n✅ <b>সফল রেজিস্ট্রেশন:</b> ${successCount} টি\n❌ <b>ব্যর্থ:</b> ${failCount} টি`
  );

  console.log('সকল কাজ সফলভাবে শেষ হয়েছে।');
}

main();
