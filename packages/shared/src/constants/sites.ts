// 求職門神支援的求職網站清單
// 之後新增網站時，只要加在這裡，其他地方都會自動知道

export const SUPPORTED_SITES = [
  {
    id: '104',
    name: '104 人力銀行',
    hostPattern: '*://*.104.com.tw/*',
  },
  {
    id: '1111',
    name: '1111 人力銀行',
    hostPattern: '*://*.1111.com.tw/*',
  },
  {
    id: 'yes123',
    name: 'yes123 求職網',
    hostPattern: '*://*.yes123.com.tw/*',
  },
  {
    id: '518',
    name: '518 熊班',
    hostPattern: '*://*.518.com.tw/*',
  },
] as const;

export type SiteId = (typeof SUPPORTED_SITES)[number]['id'];
