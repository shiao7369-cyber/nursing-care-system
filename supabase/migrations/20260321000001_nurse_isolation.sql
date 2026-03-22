-- =============================================
-- 護理師資料隔離 + 管理員使用者設定
-- =============================================

-- 設定 test@nursing.com 為管理員（蕭輝哲）
UPDATE profiles
SET role = 'admin', full_name = '蕭輝哲'
WHERE email = 'test@nursing.com';

-- 管理員判斷 helper（避免遞迴）
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- =============================================
-- 重建 patients RLS：admin 看全部，護理師看自己建立的
-- =============================================
DROP POLICY IF EXISTS "patients_select" ON patients;
DROP POLICY IF EXISTS "patients_insert" ON patients;
DROP POLICY IF EXISTS "patients_update" ON patients;
DROP POLICY IF EXISTS "patients_delete" ON patients;

CREATE POLICY "patients_select" ON patients FOR SELECT TO authenticated
  USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "patients_insert" ON patients FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "patients_update" ON patients FOR UPDATE TO authenticated
  USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "patients_delete" ON patients FOR DELETE TO authenticated
  USING (is_admin() OR created_by = auth.uid());

-- =============================================
-- 重建 visit_records RLS
-- =============================================
DROP POLICY IF EXISTS "visits_select" ON visit_records;
DROP POLICY IF EXISTS "visits_insert" ON visit_records;
DROP POLICY IF EXISTS "visits_update" ON visit_records;

CREATE POLICY "visits_select" ON visit_records FOR SELECT TO authenticated
  USING (
    is_admin() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = visit_records.patient_id AND patients.created_by = auth.uid())
  );

CREATE POLICY "visits_insert" ON visit_records FOR INSERT TO authenticated
  WITH CHECK (
    is_admin() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = visit_records.patient_id AND patients.created_by = auth.uid())
  );

CREATE POLICY "visits_update" ON visit_records FOR UPDATE TO authenticated
  USING (
    is_admin() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = visit_records.patient_id AND patients.created_by = auth.uid())
  );

-- =============================================
-- 重建 visit_schedules RLS
-- =============================================
DROP POLICY IF EXISTS "schedules_all" ON visit_schedules;

CREATE POLICY "schedules_select" ON visit_schedules FOR SELECT TO authenticated
  USING (
    is_admin() OR nurse_id = auth.uid() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = visit_schedules.patient_id AND patients.created_by = auth.uid())
  );

CREATE POLICY "schedules_insert" ON visit_schedules FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "schedules_update" ON visit_schedules FOR UPDATE TO authenticated
  USING (
    is_admin() OR nurse_id = auth.uid() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = visit_schedules.patient_id AND patients.created_by = auth.uid())
  );

CREATE POLICY "schedules_delete" ON visit_schedules FOR DELETE TO authenticated
  USING (
    is_admin() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = visit_schedules.patient_id AND patients.created_by = auth.uid())
  );

-- =============================================
-- 其他資料表 RLS 也隔離
-- =============================================
DROP POLICY IF EXISTS "resources_all" ON medical_resources;
CREATE POLICY "resources_all" ON medical_resources FOR ALL TO authenticated
  USING (
    is_admin() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = medical_resources.patient_id AND patients.created_by = auth.uid())
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = medical_resources.patient_id AND patients.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "hospitalizations_all" ON hospitalizations;
CREATE POLICY "hospitalizations_all" ON hospitalizations FOR ALL TO authenticated
  USING (
    is_admin() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = hospitalizations.patient_id AND patients.created_by = auth.uid())
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = hospitalizations.patient_id AND patients.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "receipts_all" ON receipts;
CREATE POLICY "receipts_all" ON receipts FOR ALL TO authenticated
  USING (
    is_admin() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = receipts.patient_id AND patients.created_by = auth.uid())
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (SELECT 1 FROM patients WHERE patients.id = receipts.patient_id AND patients.created_by = auth.uid())
  );
