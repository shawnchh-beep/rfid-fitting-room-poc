/**
 * 簡易版 SGTIN-96 解碼器
 * 假設使用常見的 Partition 5 (Company Prefix 24 bits, Item Ref 20 bits)
 * 實務上 Partition 位元會決定切分點，此處為 PoC 簡化版。
 */
export function decodeSGTIN96(hex) {
  // 1. Hex 轉 BigInt 再轉為 96 位的二進位字串
  const binary = BigInt('0x' + hex).toString(2).padStart(96, '0');

  // 2. 根據 EPC 標準切分 (以 Partition 5 為例)
  // Header (8), Filter (3), Partition (3), Company (24), Item (20), Serial (38)
  const partition = parseInt(binary.substring(11, 14), 2); 
  
  // 這裡僅示範最常用的長度組合，實際應用需根據 partition 表對照
  const companyPrefixBin = binary.substring(14, 38);
  const itemReferenceBin = binary.substring(38, 58);

  return {
    companyPrefix: parseInt(companyPrefixBin, 2).toString(),
    itemReference: parseInt(itemReferenceBin, 2).toString(),
    serial: BigInt('0b' + binary.substring(58, 96)).toString()
  };
}
