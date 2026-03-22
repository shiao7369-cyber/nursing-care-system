-- 重設管理員密碼（pgcrypto 在 extensions schema）
UPDATE auth.users
SET encrypted_password = extensions.crypt('蕭輝哲蕭輝哲', extensions.gen_salt('bf')),
    updated_at = NOW()
WHERE email = 'test@nursing.com';
