import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Admin client (service role)
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Verify caller is admin
  const authHeader = req.headers.get('Authorization')
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader ?? '' } }
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: '未授權' }), { status: 401, headers: corsHeaders })
  }
  const { data: callerProfile } = await adminClient.from('profiles').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: '需要管理員權限' }), { status: 403, headers: corsHeaders })
  }

  const body = await req.json()
  const { action } = body

  // 列出所有使用者
  if (action === 'list') {
    const { data: profiles, error } = await adminClient
      .from('profiles')
      .select('id, email, full_name, role, phone, license_number, created_at')
      .order('created_at')
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    return new Response(JSON.stringify({ users: profiles }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // 新增使用者
  if (action === 'create') {
    const { email, password, full_name, role = 'nurse', phone = '', license_number = '' } = body
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    // Update profile with role
    await adminClient.from('profiles').update({ role, full_name, phone, license_number }).eq('id', data.user.id)
    return new Response(JSON.stringify({ success: true, user: data.user }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // 更新密碼
  if (action === 'update_password') {
    const { user_id, password } = body
    const { error } = await adminClient.auth.admin.updateUserById(user_id, { password })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // 更新角色
  if (action === 'update_role') {
    const { user_id, role } = body
    const { error } = await adminClient.from('profiles').update({ role }).eq('id', user_id)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // 刪除使用者
  if (action === 'delete') {
    const { user_id } = body
    const { error } = await adminClient.auth.admin.deleteUser(user_id)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ error: '未知操作' }), { status: 400, headers: corsHeaders })
})
