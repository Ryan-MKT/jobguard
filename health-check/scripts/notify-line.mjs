// ============================================
// LINE Messaging API 通知腳本
// ============================================
//
// 用 env var 傳憑證（避免 hard-code）：
//   LINE_CHANNEL_ACCESS_TOKEN  必要
//   LINE_USER_ID               必要（U 開頭）
//   LINE_MESSAGE               必要（訊息主體，會自動加「求職門神 專案」開頭）
//   LINE_DRY_RUN=1             可選，dry-run 不真的送
//
// 用法：
//   LINE_CHANNEL_ACCESS_TOKEN=... LINE_USER_ID=U... LINE_MESSAGE="測試" node scripts/notify-line.mjs

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const USER_ID = process.env.LINE_USER_ID;
const RAW_MESSAGE = process.env.LINE_MESSAGE;
const DRY_RUN = process.env.LINE_DRY_RUN === '1';

// LINE 單則 text message 上限 5000 字
const MAX_LEN = 4800;

function bail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!TOKEN) bail('缺 LINE_CHANNEL_ACCESS_TOKEN env var');
if (!USER_ID) bail('缺 LINE_USER_ID env var');
if (!RAW_MESSAGE) bail('缺 LINE_MESSAGE env var');

// 訊息開頭固定「求職門神 專案」
const header = '求職門神 專案';
let body = RAW_MESSAGE.trim();

let fullMessage = `${header}\n${'─'.repeat(15)}\n${body}`;
if (fullMessage.length > MAX_LEN) {
  fullMessage = fullMessage.slice(0, MAX_LEN - 20) + '\n…（已截斷）';
}

console.log('📨 準備發送 LINE 訊息');
console.log(`👤 to: ${USER_ID.slice(0, 6)}...${USER_ID.slice(-4)}`);
console.log(`📝 length: ${fullMessage.length} chars`);
console.log('─'.repeat(40));
console.log(fullMessage);
console.log('─'.repeat(40));

if (DRY_RUN) {
  console.log('🔵 DRY_RUN=1，不實際發送');
  process.exit(0);
}

const payload = {
  to: USER_ID,
  messages: [{ type: 'text', text: fullMessage }],
};

try {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    bail(`LINE API HTTP ${res.status}: ${text}`);
  }

  const data = await res.json().catch(() => ({}));
  console.log('✅ 訊息已送出');
  if (data.sentMessages) {
    console.log('   sentMessages:', JSON.stringify(data.sentMessages));
  }
} catch (err) {
  bail(`網路錯誤: ${err.message}`);
}
