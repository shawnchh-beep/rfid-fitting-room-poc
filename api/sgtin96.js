/**
 * SGTIN-96 解碼工具 (Pure JavaScript)
 * 根據 GS1 標準將 24 碼的 Hex EPC 轉為可讀的編號
 */

export const PARTITION_TABLE = {
  0: { companyPrefixBits: 40, itemReferenceBits: 4, companyPrefixDigits: 12, itemReferenceDigits: 1 },
  1: { companyPrefixBits: 37, itemReferenceBits: 7, companyPrefixDigits: 11, itemReferenceDigits: 2 },
  2: { companyPrefixBits: 34, itemReferenceBits: 10, companyPrefixDigits: 10, itemReferenceDigits: 3 },
  3: { companyPrefixBits: 30, itemReferenceBits: 14, companyPrefixDigits: 9, itemReferenceDigits: 4 },
  4: { companyPrefixBits: 27, itemReferenceBits: 17, companyPrefixDigits: 8, itemReferenceDigits: 5 },
  5: { companyPrefixBits: 24, itemReferenceBits: 20, companyPrefixDigits: 7, itemReferenceDigits: 6 },
  6: { companyPrefixBits: 20, itemReferenceBits: 24, companyPrefixDigits: 6, itemReferenceDigits: 7 }
};

export function decodeSGTIN96(hex) {
  const normalized = String(hex || '').trim();
  if (!/^[A-Fa-f0-9]{24}$/.test(normalized)) {
    throw new Error('SGTIN-96 必須為 24 碼 Hex 字串');
  }

  // 1. 將 Hex 轉為 96 位元的二進位字串 (Binary String)
  // padStart 確保即使前面是 0 也不會被忽略
  const binary = BigInt('0x' + normalized).toString(2).padStart(96, '0');

  const header = parseInt(binary.substring(0, 8), 2);
  if (header !== 48) {
    throw new Error(`非 SGTIN-96 header: ${header}`);
  }

  const filter = parseInt(binary.substring(8, 11), 2);

  // 2. 根據標準 SGTIN-96 partition 切分位元：
  // Header (8 bits): 通常是 30
  // Filter (3 bits): 物流標註
  // Partition (3 bits): 決定了 Company 與 Item 的切分點
  const partition = parseInt(binary.substring(11, 14), 2);
  const partitionSpec = PARTITION_TABLE[partition];
  if (!partitionSpec) {
    throw new Error(`不支援的 partition: ${partition}`);
  }

  // 3. 根據 Partition 表拆解
  // Company Prefix: 可變 bits
  // Item Reference: 可變 bits
  // Serial Number: 38 bits
  const companyStart = 14;
  const companyEnd = companyStart + partitionSpec.companyPrefixBits;
  const itemEnd = companyEnd + partitionSpec.itemReferenceBits;

  const companyPrefixBin = binary.substring(companyStart, companyEnd);
  const itemReferenceBin = binary.substring(companyEnd, itemEnd);
  const serialBin = binary.substring(58, 96);

  const companyPrefixRaw = BigInt('0b' + companyPrefixBin).toString();
  const itemReferenceRaw = BigInt('0b' + itemReferenceBin).toString();

  // 4. 將二進位轉回十進位字串供資料庫比對
  return {
    companyPrefix: companyPrefixRaw.padStart(partitionSpec.companyPrefixDigits, '0'),
    itemReference: itemReferenceRaw.padStart(partitionSpec.itemReferenceDigits, '0'),
    serial: BigInt('0b' + serialBin).toString(),
    partition,
    filter,
    header,
    gtinWithoutCheckDigit: `${itemReferenceRaw.padStart(partitionSpec.itemReferenceDigits, '0')}${companyPrefixRaw.padStart(partitionSpec.companyPrefixDigits, '0')}`
  };
}

function toFixedBin(value, bits, fieldName) {
  const n = BigInt(value);
  if (n < 0n) {
    throw new Error(`${fieldName} 不可為負數`);
  }
  const bin = n.toString(2);
  if (bin.length > bits) {
    throw new Error(`${fieldName} 超出 ${bits} bits 範圍`);
  }
  return bin.padStart(bits, '0');
}

export function encodeSGTIN96({ companyPrefix, itemReference, serial, partition = 5, filter = 1 }) {
  const partitionValue = Number(partition);
  const filterValue = Number(filter);
  const partitionSpec = PARTITION_TABLE[partitionValue];

  if (!partitionSpec) {
    throw new Error(`不支援的 partition: ${partition}`);
  }
  if (!Number.isInteger(filterValue) || filterValue < 0 || filterValue > 7) {
    throw new Error('filter 必須為 0~7 的整數');
  }

  const company = String(companyPrefix ?? '').trim();
  const item = String(itemReference ?? '').trim();
  const serialText = String(serial ?? '').trim();

  if (!/^\d+$/.test(company)) throw new Error('companyPrefix 必須為數字字串');
  if (!/^\d+$/.test(item)) throw new Error('itemReference 必須為數字字串');
  if (!/^\d+$/.test(serialText)) throw new Error('serial 必須為數字字串');

  if (company.length > partitionSpec.companyPrefixDigits) {
    throw new Error(`companyPrefix 長度不可超過 ${partitionSpec.companyPrefixDigits}`);
  }
  if (item.length > partitionSpec.itemReferenceDigits) {
    throw new Error(`itemReference 長度不可超過 ${partitionSpec.itemReferenceDigits}`);
  }

  const companyPadded = company.padStart(partitionSpec.companyPrefixDigits, '0');
  const itemPadded = item.padStart(partitionSpec.itemReferenceDigits, '0');

  const headerBin = toFixedBin(48, 8, 'header');
  const filterBin = toFixedBin(filterValue, 3, 'filter');
  const partitionBin = toFixedBin(partitionValue, 3, 'partition');
  const companyBin = toFixedBin(companyPadded, partitionSpec.companyPrefixBits, 'companyPrefix');
  const itemBin = toFixedBin(itemPadded, partitionSpec.itemReferenceBits, 'itemReference');
  const serialBin = toFixedBin(serialText, 38, 'serial');

  const binary = `${headerBin}${filterBin}${partitionBin}${companyBin}${itemBin}${serialBin}`;
  const hex = BigInt(`0b${binary}`).toString(16).toUpperCase().padStart(24, '0');

  return {
    epc: hex,
    companyPrefix: companyPadded,
    itemReference: itemPadded,
    serial: serialText,
    partition: partitionValue,
    filter: filterValue
  };
}
