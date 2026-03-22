-- =============================================
-- 居護所個案管理系統 - 初始化資料庫結構
-- =============================================



-- =============================================
-- 護理師/用戶檔案
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'nurse' CHECK (role IN ('admin', 'nurse', 'consultant')),
  phone TEXT,
  license_number TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 個案病歷主表
-- =============================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('男', '女')),
  birth_date DATE,
  age INTEGER,
  id_number TEXT,
  phone TEXT,
  address TEXT,
  address_lat DECIMAL(10, 8),
  address_lng DECIMAL(11, 8),
  referral_unit TEXT,
  admission_type TEXT CHECK (admission_type IN ('自費收入戶', '中低收入戶', '低收入戶', '一般戶')),
  language TEXT[],
  education TEXT,
  marital_status TEXT CHECK (marital_status IN ('未婚', '已婚', '離婚', '喪偶')),
  religion TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  emergency_address TEXT,
  height DECIMAL(5,1),
  weight DECIMAL(5,1),
  blood_type TEXT,
  past_diseases TEXT[],
  allergy TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discharged', 'hospitalized')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 訪視紀錄
-- =============================================
CREATE TABLE IF NOT EXISTS visit_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  visit_date DATE NOT NULL,
  visit_start_time TIMESTAMPTZ,
  visit_end_time TIMESTAMPTZ,
  nurse_id UUID REFERENCES profiles(id),
  nurse_name TEXT,
  nurse_signature TEXT,
  visit_notes TEXT,
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  temperature DECIMAL(4,1),
  respiratory_rate INTEGER,
  spo2 DECIMAL(4,1),
  blood_sugar DECIMAL(5,1),
  wound_condition TEXT,
  next_visit_date DATE,
  visit_location_lat DECIMAL(10, 8),
  visit_location_lng DECIMAL(11, 8),
  status TEXT DEFAULT 'completed' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_answer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 使用醫療資源
-- =============================================
CREATE TABLE IF NOT EXISTS medical_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  resource_date DATE NOT NULL,
  resource_type TEXT NOT NULL,
  provider TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 住院紀錄
-- =============================================
CREATE TABLE IF NOT EXISTS hospitalizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  admission_date DATE NOT NULL,
  discharge_date DATE,
  hospital_name TEXT,
  ward TEXT,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 收據
-- =============================================
CREATE TABLE IF NOT EXISTS receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  issue_date DATE NOT NULL,
  service_period_start DATE,
  service_period_end DATE,
  items JSONB DEFAULT '[]',
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 訪視排程
-- =============================================
CREATE TABLE IF NOT EXISTS visit_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  nurse_id UUID REFERENCES profiles(id),
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitalizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_schedules ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Patients
CREATE POLICY "patients_select" ON patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "patients_insert" ON patients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "patients_update" ON patients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "patients_delete" ON patients FOR DELETE TO authenticated USING (true);

-- Visit records
CREATE POLICY "visits_select" ON visit_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "visits_insert" ON visit_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "visits_update" ON visit_records FOR UPDATE TO authenticated USING (true);

-- Medical resources
CREATE POLICY "resources_all" ON medical_resources FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Hospitalizations
CREATE POLICY "hospitalizations_all" ON hospitalizations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Receipts
CREATE POLICY "receipts_all" ON receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Visit schedules
CREATE POLICY "schedules_all" ON visit_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 自動建立 Profile 的 Trigger
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 範例資料（測試用）
-- =============================================
-- 注意：需先登入建立用戶後，sample data 才可插入
