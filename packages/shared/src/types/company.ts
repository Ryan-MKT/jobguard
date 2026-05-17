// 「公司」的型別說明書
// 不管是 extension 抓到的、政府資料來的，全部都用這個結構

export interface Company {
  // 公司在 104 上顯示的名字（可能是品牌名）
  displayName: string;

  // 法人全名（例：嘉韻診所股份有限公司），可能拿不到
  legalName?: string;

  // 統一編號（8 碼），如果有的話
  taxId?: string;
}
