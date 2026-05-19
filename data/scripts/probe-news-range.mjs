// PROBE: 驗證 Google News RSS 的 when 參數是否真的支援長範圍
// 用同一 query 分別打 1y / 5y / 10y，比較回傳新聞的時間分布

const NEGATIVE = ['違法','違規','罰款','裁罰','判賠','勞資','糾紛','訴訟','判決','抗議','罷工','欠薪'];

// 用大公司確保有歷史資料
const COMPANIES = ['南山人壽', '酷澎', '台積電'];
const TIMEFRAMES = ['1y', '5y', '10y'];

function buildUrl(company, timeframe) {
  const q = `"${company}" (${NEGATIVE.join(' OR ')})`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&when=${timeframe}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
}

function parsePubDates(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const titleM = m[1].match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const dateM = m[1].match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/);
    if (dateM) {
      items.push({
        date: new Date(dateM[1].trim()),
        title: titleM ? titleM[1].trim().slice(0, 50) : '(no title)',
      });
    }
  }
  return items;
}

async function probe(company, timeframe) {
  const url = buildUrl(company, timeframe);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobGuard-Probe/0.1)' },
  });
  const xml = await res.text();
  const items = parsePubDates(xml);
  if (items.length === 0) {
    return { total: 0, oldest: null, newest: null, samples: [] };
  }
  items.sort((a, b) => a.date - b.date);
  return {
    total: items.length,
    oldest: items[0].date,
    newest: items[items.length - 1].date,
    samples: [items[0], items[Math.floor(items.length / 2)], items[items.length - 1]],
  };
}

function fmtDate(d) {
  return d ? d.toISOString().slice(0, 10) : '—';
}

function yearsAgo(d) {
  if (!d) return '—';
  const now = new Date();
  const years = (now - d) / (365.25 * 24 * 3600 * 1000);
  return years.toFixed(1) + ' 年前';
}

async function main() {
  console.log('🔬 PROBE Google News RSS `when` 參數實際行為');
  console.log('現在時間:', new Date().toISOString().slice(0, 10));
  console.log('============================================');

  for (const company of COMPANIES) {
    console.log(`\n📌 ${company}`);
    for (const tf of TIMEFRAMES) {
      const r = await probe(company, tf);
      console.log(`  when=${tf.padEnd(3)}  總筆數: ${r.total.toString().padStart(3)} | 範圍: ${fmtDate(r.oldest)} ~ ${fmtDate(r.newest)} | 最舊: ${yearsAgo(r.oldest)}`);
      await new Promise((res) => setTimeout(res, 500));
    }
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
