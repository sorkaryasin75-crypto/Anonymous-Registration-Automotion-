const { chromium } = require('playwright');
const UserAgent = require('user-agents');

// ইনপুট কনফিগারেশন
const TARGET_URL = process.env.TARGET_URL || 'https://moneyloop24.blogspot.com';
const TOTAL_REGISTRATIONS = parseInt(process.env.REG_COUNT || '10', 10);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// টেলিগ্রাম মেসেজ পাঠানোর সিস্টেম
async function sendTelegramMessage(text) {
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

async function runSingleGuestSession(index) {
  // ১. ইউনিক মোবাইল ইউজার এজেন্টস জেনারেট
  const userAgent = new UserAgent({ deviceCategory: 'mobile' }).toString();
  
  // ব্রাউজার ইনেবর্ট
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // সম্পূর্ণ আলাদা সেশন তৈরি (নতুন কুকিজ, লোকাল স্টোরেজ, ক্যাশ)
  const context = await browser.newContext({
    userAgent: userAgent,
    viewport: { width: 360, height: 740 },
    locale: 'en-US',
    timezoneId: 'Asia/Dhaka'
  });

  const page = await context.newPage();
  let isSuccess = false;
  let registeredId = 'N/A';
  let errorMsg = '';

  try {
    console.log(`[${index + 1}/${TOTAL_REGISTRATIONS}] সেশন প্রসেস হচ্ছে...`);

    // সাইটে ভিজিট
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
    
    // সাইটের ইন্টারনাল জাভাস্ক্রিপ্ট অটো-রেজিস্ট্রেশন কমপ্লিট হওয়ার জন্য অপেক্ষা
    await delay(4000);

    // সাইটের UI থেকে তৈরি হওয়া Account ID ফেচ করা
    const idText = await page.evaluate(() => {
      // সাইটের টেক্সট থেকে অ্যাকাউন্ট আইডি ফিল্টার
      const bodyText = document.body.innerText;
      const match = bodyText.match(/ACCOUNT ID\s*\n\s*([a-zA-Z0-9]+)/i) || bodyText.match(/bux[a-zA-Z0-9]+/i);
      return match ? match[1] || match[0] : null;
    });

    if (idText) {
      registeredId = idText;
    } else {
      registeredId = 'Auto-Registered';
    }

    isSuccess = true;
    console.log(`✔ [${index + 1}] সফল রেজিস্ট্রেশন ID: ${registeredId}`);

  } catch (err) {
    errorMsg = err.message;
    console.error(`✖ [${index + 1}] ব্যর্থ: ${errorMsg}`);
  } finally {
    await context.close();
    await browser.close();
  }

  return { isSuccess, id: registeredId, error: errorMsg };
}

async function main() {
  let successCount = 0;
  let failCount = 0;

  await sendTelegramMessage(
    `🚀 <b>অটোমেশন স্টার্ট হয়েছে</b>\n\n<b>টার্গেট:</b> ${TARGET_URL}\n<b>মোট লক্ষ্যমাত্রা:</b> ${TOTAL_REGISTRATIONS}`
  );

  for (let i = 0; i < TOTAL_REGISTRATIONS; i++) {
    const result = await runSingleGuestSession(i);

    if (result.isSuccess) {
      successCount++;
    } else {
      failCount++;
      await sendTelegramMessage(
        `❌ <b>রেজিস্ট্রেশন ব্যর্থ [${i + 1}/${TOTAL_REGISTRATIONS}]</b>\n\n<b>কারণ:</b> ${result.error}`
      );
    }

    // ব্যাকএন্ড রেট লিমিটিং এড়াতে র্যান্ডম পজ (৩-৫ সেকেন্ড)
    await delay(Math.floor(Math.random() * 2000) + 3000);
  }

  // ফাইনাল টেলিগ্রাম সামারি রিপোর্ট
  await sendTelegramMessage(
    `📊 <b>রেজিস্ট্রেশন রিপোর্ট</b>\n\n✅ <b>সফল:</b> ${successCount}\n❌ <b>ব্যর্থ:</b> ${failCount}`
  );

  console.log('টাস্ক সম্পন্ন হয়েছে।');
}

main();
