-- 新增管路狀態欄位
ALTER TABLE patients ADD COLUMN IF NOT EXISTS catheter_status TEXT
  CHECK (catheter_status IN ('有管路', '無管路'));
