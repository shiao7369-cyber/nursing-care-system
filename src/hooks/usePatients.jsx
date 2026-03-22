import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function usePatients() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPatients = useCallback(async (filters = {}) => {
    setLoading(true)
    let query = supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,case_number.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) setError(error.message)
    else setPatients(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  async function getPatient(id) {
    const { data, error } = await supabase
      .from('patients')
      .select(`
        *,
        visit_records(*),
        medical_resources(*),
        hospitalizations(*)
      `)
      .eq('id', id)
      .single()
    return { data, error }
  }

  async function createPatient(patientData) {
    // 若外部已預分配案號就直接用，否則才自動產生（單筆新增用）
    const caseNumber = patientData.case_number || `P-${String(patients.length + 1).padStart(5, '0')}`
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('patients')
      .insert([{ ...patientData, case_number: caseNumber, created_by: user?.id }])
      .select()
      .single()

    if (!error) setPatients(prev => [data, ...prev])
    return { data, error }
  }

  async function updatePatient(id, updates) {
    const { data, error } = await supabase
      .from('patients')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (!error) setPatients(prev => prev.map(p => p.id === id ? data : p))
    return { data, error }
  }

  async function deletePatient(id) {
    const { error } = await supabase.from('patients').delete().eq('id', id)
    if (!error) setPatients(prev => prev.filter(p => p.id !== id))
    return { error }
  }

  async function geocodeAddress(address) {
    if (!address) return null
    const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
    try {
      const encoded = encodeURIComponent(address)
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?country=TW&language=zh&limit=1&bbox=121.0,24.65,121.45,25.15&proximity=121.31,24.99&access_token=${MAPBOX_TOKEN}`
      )
      if (res.ok) {
        const data = await res.json()
        if (data?.features?.length > 0) {
          const [lng, lat] = data.features[0].center
          return { lat, lng }
        }
      }
    } catch (e) {
      console.error('Mapbox geocoding error:', e)
    }
    return null
  }

  return {
    patients,
    loading,
    error,
    fetchPatients,
    getPatient,
    createPatient,
    updatePatient,
    deletePatient,
    geocodeAddress,
  }
}

export function useVisitRecords(patientId) {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId) { setLoading(false); return }
    fetchVisits()
  }, [patientId])

  async function fetchVisits() {
    const { data } = await supabase
      .from('visit_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false })
    setVisits(data || [])
    setLoading(false)
  }

  async function createVisit(visitData) {
    const { data, error } = await supabase
      .from('visit_records')
      .insert([{ ...visitData, patient_id: patientId }])
      .select()
      .single()
    if (!error) setVisits(prev => [data, ...prev])
    return { data, error }
  }

  async function updateVisit(id, updates) {
    const { data, error } = await supabase
      .from('visit_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error) setVisits(prev => prev.map(v => v.id === id ? data : v))
    return { data, error }
  }

  return { visits, loading, fetchVisits, createVisit, updateVisit }
}
