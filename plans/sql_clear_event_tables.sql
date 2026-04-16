-- WARNING: Destructive operation. This script will permanently delete event records.
-- 警告：此為 destructive operation（會刪除資料），請先確認目標環境後再執行。
-- Supabase SQL Editor 適用：可一次貼上完整腳本執行。

BEGIN;

-- 刪除順序採 FK-safe（由子到父）
-- 1) 事件衍生表（若存在）：直接依賴核心事件表的子表
DO $$
BEGIN
  IF to_regclass('public.fitting_room_alerts') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.fitting_room_alerts';
  END IF;

  IF to_regclass('public.fitting_room_notifications') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.fitting_room_notifications';
  END IF;

  IF to_regclass('public.fitting_room_event_logs') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.fitting_room_event_logs';
  END IF;
END $$;

-- 2) 指定核心事件相關表（依相依關係）
DELETE FROM public.fitting_room_presence;
DELETE FROM public.fitting_room_sessions;
DELETE FROM public.rfid_events;

COMMIT;

-- Verification queries
SELECT COUNT(*) AS fitting_room_presence_count FROM public.fitting_room_presence;
SELECT COUNT(*) AS fitting_room_sessions_count FROM public.fitting_room_sessions;
SELECT COUNT(*) AS rfid_events_count FROM public.rfid_events;
