// ============================================
// CSV 三層容錯解析
// ============================================
//
// 三層策略：
//   1. 嚴格模式：標準 CSV 規則（最準）
//   2. 寬鬆模式：容忍格式錯誤的引號、欄位數變動
//   3. 容錯模式：跳過壞行、繼續處理後面
//
// 任一層成功就回傳，全部失敗才拋錯

import { parse as parseCsv } from 'csv-parse/sync';

/**
 * 三層容錯解析 CSV
 * @param {string} csvText 原始 CSV 文字（不含 BOM）
 * @param {Object} options
 * @param {boolean} options.columns 是否把第 1 行當欄位名（預設 true）
 * @returns {{records: Object[], strategy: string, errors: string[]}}
 */
export function parseRobust(csvText, options = {}) {
  const errors = [];

  // 策略 1：嚴格模式
  try {
    const records = parseCsv(csvText, {
      columns: options.columns !== false,
      skip_empty_lines: true,
      trim: true,
    });
    return { records, strategy: 'strict', errors };
  } catch (e) {
    errors.push(`strict: ${e.message}`);
  }

  // 策略 2：寬鬆模式（容忍引號 + 欄位數）
  try {
    const records = parseCsv(csvText, {
      columns: options.columns !== false,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    });
    return { records, strategy: 'relaxed', errors };
  } catch (e) {
    errors.push(`relaxed: ${e.message}`);
  }

  // 策略 3：最寬鬆 + 跳過錯誤行
  try {
    const records = parseCsv(csvText, {
      columns: options.columns !== false,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true,
      on_record: (record) => record, // 容錯接受所有
    });
    return { records, strategy: 'tolerant', errors };
  } catch (e) {
    errors.push(`tolerant: ${e.message}`);
  }

  // 策略 4：手動逐行（最後備案）
  return parseManual(csvText, errors);
}

/**
 * 手動逐行解析（最後備案，會丟失精細度但不會整包失敗）
 */
function parseManual(csvText, errors) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) {
    return { records: [], strategy: 'manual-empty', errors };
  }

  // 取第一行當欄位
  const headers = splitCsvLine(lines[0]);
  const records = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const cells = splitCsvLine(line);
      if (cells.length === 0) continue;
      const record = {};
      for (let j = 0; j < Math.min(headers.length, cells.length); j++) {
        record[headers[j]] = cells[j];
      }
      records.push(record);
    } catch {
      skipped++;
    }
  }

  errors.push(`manual: 抓到 ${records.length} 筆，跳過 ${skipped} 行`);
  return { records, strategy: 'manual', errors };
}

/**
 * 簡易 CSV 行解析（處理引號內含逗號）
 */
function splitCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // 處理引號內的引號 ""
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}
