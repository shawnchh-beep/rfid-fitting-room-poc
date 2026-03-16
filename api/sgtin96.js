/**
 * SGTIN-96 解碼工具 (Pure JavaScript)
 * 根據 GS1 標準將 24 碼的 Hex EPC 轉為可讀的編號
 */

export function decodeSGTIN96(hex) {
  // 1. 將 Hex 轉為 96 位元的二進位字串 (Binary String)
  // padStart 確保即使前面是 0 也不會被忽略
  const binary = BigInt('0x' + hex).toString(2).padStart(96, '0');

  // 2. 根據標準 SGTIN-96 (Partition 5 為例) 切分位元：
  // Header (8 bits): 通常是 30
  // Filter (3 bits): 物流標註
  // Partition (3 bits): 決定了 Company 與 Item 的切分點
  const partition = parseInt(binary.substring(11, 14), 2);

  // 3. 根據 Partition 表拆解 (此處簡化為最常用的 Partition 5)
  // Company Prefix: 24 bits
  // Item Reference: 20 bits
  // Serial Number: 38 bits
  const companyPrefixBin = binary.substring(14, 38);
  const itemReferenceBin = binary.substring(38, 58);
  const serialBin = binary.substring(58, 96);

  // 4. 將二進位轉回十進位字串供資料庫比對
  return {
    companyPrefix: parseInt(companyPrefixBin, 2).toString(),
    itemReference: parseInt(itemReferenceBin, 2).toString(),
    serial: BigInt('0b' + serialBin).toString(),
    partition: partition
  };
}