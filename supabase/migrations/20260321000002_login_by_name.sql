-- 允許透過姓名查詢登入信箱（供登入頁使用，不需驗證）
CREATE OR REPLACE FUNCTION get_email_by_name(p_name TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT email FROM profiles WHERE full_name = p_name LIMIT 1;
$$;

-- 開放 anon 呼叫
GRANT EXECUTE ON FUNCTION get_email_by_name(TEXT) TO anon;
