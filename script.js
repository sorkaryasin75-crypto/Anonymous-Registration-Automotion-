const { chromium } = require('playwright');
const UserAgent = require('user-agents');

// এনভায়রনমেন্ট ভেরিয়েবল বা ইনপুট কনফিগারেশন
const TARGET_URL = process.env.TARGET_URL || 'https://moneyloop24.blogspot.com/?m=1';
const TOTAL_REGISTRATIONS = parseInt(process.env.REG_COUNT || '10', 10);

// টেলিগ্রাম কনফিগারেশন
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// মানুষের মতো বিরতি দেওয়ার জন্য হেলপার ফাংশন
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// টেলিগ্রাম নোটিফিকেশন পাঠানোর ফাংশন
async function sendTelegramMessage(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('⚠️ Telegram Token/Chat ID দেওয়া হয়নি, তাই মেসেজ পাঠানো স্থগিত রইল।');
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('❌ Telegram মেসেজ পাঠাতে সমস্যা হয়েছে:', error.message);
  }
}

// ইউনিক অ্যানোনিমাস ইউআইডি (UID) জেনারেটর
function generateAnonymousUID() {
  const prefix = 'anon';
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomStr}`;
}

// হিউম্যান-স্টাইল টাইপিং (একের পর এক কী প্রেস)
async function humanType(element, text) {
  for (const char of text) {
    await element.type(char, { delay: Math.floor(Math.random() * 120) + 40 });
  }
}

async function executeSingleRegistration(index) {
  const userAgent = new UserAgent({ deviceCategory: 'mobile' }).toString();
  const currentUID = generateAnonymousUID();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: userAgent,
    viewport: {
      width: 360 + Math.floor(Math.random() * 50),
      height: 700 + Math.floor(Math.random() * 100)
    },
    locale: 'en-US',
    timezoneId: 'Asia/Dhaka'
  });

  const page = await context.newPage();
  let isSuccess = false;
  let errorMessage = '';

  try {
    console.log(`\n[${index + 1}/${TOTAL_REGISTRATIONS}] রেজিস্ট্রেশন স্টার্ট: ${currentUID}`);

    // ১. পেজে প্রবেশ
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(2000 + Math.random() * 1500);

    // ২. ফিল্ড সনাক্তকরণ ও ইনপুট
    const uidInput = await page.$(
      'input[name*="uid"], input[name*="user"], input[id*="uid"], input[type="text"]'
    );
    const submitButton = await page.$(
      'button[type="submit"], input[type="submit"], button:has-text("Register"), button:has-text("Submit"), form button'
    );

    if (uidInput && submitButton) {
      await uidInput.click();
      await delay(300 + Math.random() * 300);
      await humanType(uidInput, currentUID);
      await delay(800 + Math.random() * 500);

      await submitButton.hover();
      await delay(200);
      await submitButton.click({ delay: Math.floor(Math.random() * 150) + 80 });

      await page.waitForLoadState('networkidle').catch(() => {});
      await delay(2000);

      isSuccess = true;
      console.log(`✔ [${index + 1}] সফল রেজিস্ট্রেশন: ${currentUID}`);
    } else {
      errorMessage = 'ইনপুট ফিল্ড বা সাবমিট বাটন পাওয়া যায়নি।';
    }
  } catch (err) {
    errorMessage = err.message;
    console.error(`✖ [${index + 1}] ব্যর্থ: ${err.message}`);
  } finally {
    await context.close();
    await browser.close();
  }

  return { isSuccess, uid: currentUID, error: errorMessage };
}

async function main() {
  const startTime = new Date().toLocaleTimeString('bn-BD');
  let successCount = 0;
  let failCount = 0;

  // শুরুর নোটিফিকেশন
  await sendTelegramMessage(
    `🚀 <b>অটোমেশন রেজিস্ট্রেশন শুরু হয়েছে</b>\n\n<b>টার্গেট:</b> ${TARGET_URL}\n<b>মোট লক্ষ্যমাত্রা:</b> ${TOTAL_REGISTRATIONS} টি\n<b>শুরুর সময়:</b> ${startTime}`
  );

  for (let i = 0; i < TOTAL_REGISTRATIONS; i++) {
    const result = await executeSingleRegistration(i);

    if (result.isSuccess) {
      successCount++;
    } else {
      failCount++;
      // একক ব্যর্থতার লাইভ নোটিফিকেশন (অপশনাল)
      await sendTelegramMessage(
        `⚠️ <b>রেজিস্ট্রেশন ব্যর্থ [${i + 1}/${TOTAL_REGISTRATIONS}]</b>\n\n<b>UID:</b> <code>${result.uid}</code>\n<b>কারণ:</b> ${result.error}`
      );
    }

    const pauseTime = Math.floor(Math.random() * 4000) + 2000;
    await delay(pauseTime);
  }

  const endTime = new Date().toLocaleTimeString('bn-BD');

  // চূড়ান্ত নোটিফিকেশন রিপোর্ট
  const summaryReport = `
📊 <b>রেজিস্ট্রেশন টাস্ক সমাপ্ত রিপোর্ট</b>

<b>টার্গেট URL:</b> ${TARGET_URL}
<b>মোট অনুরোধ:</b> ${TOTAL_REGISTRATIONS} টি
<b>সফল (Successful):</b> ✅ ${successCount} টি
<b>ব্যর্থ (Unsuccessful):</b> ❌ ${failCount} টি
<b>শেষের সময়:</b> ${endTime}
  `;

  await sendTelegramMessage(summaryReport);
  console.log('\nসফলভাবে টেলিগ্রাম মেসেজ এবং টাস্ক সম্পন্ন হয়েছে।');
}

main();
