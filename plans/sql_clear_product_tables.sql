-- WARNING: Destructive operation. This script will permanently delete data.
-- 警告：此為 destructive operation（會刪除資料），請先確認目標環境後再執行。

BEGIN;

-- Delete in FK-safe order: inventory_items -> product_translations -> products
DELETE FROM public.inventory_items;
DELETE FROM public.product_translations;
DELETE FROM public.products;

COMMIT;

-- Verification queries
SELECT COUNT(*) AS inventory_items_count FROM public.inventory_items;
SELECT COUNT(*) AS product_translations_count FROM public.product_translations;
SELECT COUNT(*) AS products_count FROM public.products;
