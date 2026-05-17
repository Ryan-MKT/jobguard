// ============================================
// 把 data/dist/ 的成果複製到 docs/data/
// ============================================
// 為什麼要這步？
//   GitHub Pages 只能從「/」或「/docs」資料夾發布，
//   我們要讓 violations.json 變成公開 URL，
//   所以從 data/dist/ 複製過去 docs/data/。

import { cp, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'dist');
const DEST = join(__dirname, '..', '..', 'docs', 'data');

async function main() {
  await mkdir(DEST, { recursive: true });
  await cp(SRC, DEST, { recursive: true });
  console.log(`✅ 複製 ${SRC} → ${DEST}`);
}

main().catch((err) => {
  console.error('❌ 失敗:', err.message);
  process.exit(1);
});
