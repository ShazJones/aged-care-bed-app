'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Patient = {
  id?: string
  client_uuid: string
  first_name: string
  last_name: string
  email: string
  mobile: string
  hospital: string
  approval_code: string
  preferred_suburb: string
  max_distance_km?: number
  rad_budget?: number
  dap_budget?: number
  status: 'draft' | 'ready'
}

type Bed = {
  id: string
  facility_name: string
  suburb: string
  rad?: number
  dap?: number
  room_type: string
  distance_km?: number
}

export default function AgedCareApp() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [step, setStep] = useState<'screen1' | 'screen2' | 'screen3' | 'done'>('screen1')
  const [beds, setBeds] = useState<Bed[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const clientUUID = typeof window !== 'undefined' ? localStorage.getItem('client_uuid') : null

  // ------------------- Load Patient -------------------
  useEffect(() => {
    async function loadPatient() {
      if (!clientUUID) {
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('client_uuid', clientUUID)
        .single()

      if (error || !data) {
        setPatient(null)
        setStep('screen1')
      } else {
        setPatient(data)
        const hasOnboarding =
          data.first_name && data.last_name && data.email && data.mobile && data.hospital && data.approval_code
        const hasPreferences = data.preferred_suburb && data.max_distance_km
        if (!hasOnboarding) setStep('screen1')
        else if (!hasPreferences) setStep('screen2')
        else setStep('screen3')
      }

      setLoading(false)
    }

    loadPatient()
  }, [clientUUID])

  // ------------------- Screen 1 Save -------------------
  const handleScreen1Save = async () => {
    if (!patient) return
    const { first_name, last_name, email, mobile, hospital, approval_code } = patient
    if (!first_name || !last_name || !email || !mobile || !hospital || !approval_code) {
      alert('Please fill all required fields.')
      return
    }

    const approvalCodePattern = /^[1-9]{1}-\d{12}$/
    if (!approvalCodePattern.test(approval_code)) {
      alert('Approval code must match 1 digit (not 0) - dash - 12 digits.')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (!patient.client_uuid) {
        const newUUID = crypto.randomUUID()
        const { data, error } = await supabase.from('patients').insert({
          client_uuid: newUUID,
          first_name,
          last_name,
          email,
          mobile,
          hospital,
          approval_code,
          status: 'draft'
        }).select().single()

        if (error) throw error
        localStorage.setItem('client_uuid', newUUID)
        setPatient(data)
      } else {
        const { error } = await supabase.from('patients')
          .update({ first_name, last_name, email, mobile, hospital, approval_code })
          .eq('client_uuid', patient.client_uuid)
        if (error) throw error
      }

      setStep('screen2')
    } catch (err: any) {
      setError('Error saving: ' + err.message)
    }

    setSaving(false)
  }

  // ------------------- Screen 2 Save -------------------
  const handleScreen2Save = async () => {
    if (!patient) return
    const { preferred_suburb, max_distance_km, rad_budget, dap_budget } = patient
    if (!preferred_suburb || !max_distance_km) {
      alert('Please fill required fields: suburb and max distance.')
      return
    }
    if (!rad_budget && !dap_budget) {
      alert('Please enter either RAD or DAP budget.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { error } = await supabase.from('patients')
        .update({ preferred_suburb, max_distance_km, rad_budget, dap_budget, status: 'ready' })
        .eq('client_uuid', patient.client_uuid)
      if (error) throw error

      setStep('screen3')
    } catch (err: any) {
      setError('Error saving preferences: ' + err.message)
    }

    setSaving(false)
  }

  // ------------------- Load Beds -------------------
  useEffect(() => {
    if (step !== 'screen3' || !patient) return

    async function loadBeds() {
      setLoading(true)
      try {
        const { data: bedData, error } = await supabase
          .from('beds')
          .select('*')
          .eq('status', 'Available')
        if (error) throw error

        // ---------- Guard: patient is guaranteed to have preferred_suburb ----------
        const matchedBeds = bedData
          .map((bed: Bed) => ({
            ...bed,
            distance_km: calculateDistanceKm(patient.preferred_suburb!, bed.suburb)
          }))
          .filter(bed => {
            const withinDistance = bed.distance_km! <= patient.max_distance_km!
            const radOk = !patient.rad_budget || !bed.rad || bed.rad <= patient.rad_budget
            const dapOk = !patient.dap_budget || !bed.dap || bed.dap <= patient.dap_budget
            return withinDistance && (radOk || dapOk)
          })

        setBeds(matchedBeds)
      } catch (err: any) {
        setError('Failed to load beds: ' + err.message)
      }
      setLoading(false)
    }

    loadBeds()
  }, [step, patient])

  // ------------------- Distance Calculation Placeholder -------------------
  const calculateDistanceKm = (suburbA: string, suburbB: string) => {
    // Placeholder: random 5-30 km for MVP
    return Math.floor(Math.random() * 26) + 5
  }

  // ------------------- Register Interest -------------------
  const handleRegisterInterest = async (bed: Bed) => {
    if (!patient) return
    try {
      const { error } = await supabase.from('interests').insert({
        patient_uuid: patient.client_uuid,
        bed_id: bed.id,
        status: 'pending'
      })
      if (error) throw error
      alert('Interest registered for ' + bed.facility_name)
    } catch (err: any) {
      alert('Failed to register interest: ' + err.message)
    }
  }

  if (loading) return <p>Loading…</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  // ------------------- SCREEN 1 -------------------
  if (step === 'screen1')
    return (
      <div style={{ padding: 24 }}>
        <h2>Step 1: Personal Details</h2>
        <div><label>First Name*</label><input type="text" value={patient?.first_name || ''} onChange={e => setPatient({ ...patient!, first_name: e.target.value })} /></div>
        <div><label>Last Name*</label><input type="text" value={patient?.last_name || ''} onChange={e => setPatient({ ...patient!, last_name: e.target.value })} /></div>
        <div><label>Email*</label><input type="email" value={patient?.email || ''} onChange={e => setPatient({ ...patient!, email: e.target.value })} /></div>
        <div><label>Mobile*</label><input type="text" value={patient?.mobile || ''} onChange={e => setPatient({ ...patient!, mobile: e.target.value })} /></div>
        <div><label>Hospital*</label><input type="text" value={patient?.hospital || ''} onChange={e => setPatient({ ...patient!, hospital: e.target.value })} /></div>
        <div><label>Approval Code*</label><input type="text" placeholder="2-123456789012" value={patient?.approval_code || ''} onChange={e => setPatient({ ...patient!, approval_code: e.target.value })} /></div>
        <button onClick={handleScreen1Save} disabled={saving}>{saving ? 'Saving…' : 'Continue'}</button>
      </div>
    )

  // ------------------- SCREEN 2 -------------------
  if (step === 'screen2')
    return (
      <div style={{ padding: 24 }}>
        <h2>Step 2: Preferences</h2>
        <div><label>Preferred Suburb*</label><input type="text" value={patient?.preferred_suburb || ''} onChange={e => setPatient({ ...patient!, preferred_suburb: e.target.value })} /></div>
        <div><label>Maximum Distance (km)*</label><input type="number" value={patient?.max_distance_km || ''} onChange={e => setPatient({ ...patient!, max_distance_km: parseInt(e.target.value) })} /></div>
        <div><label>RAD Budget</label><input type="number" step="0.01" value={patient?.rad_budget || ''} onChange={e => setPatient({ ...patient!, rad_budget: parseFloat(e.target.value) })} /></div>
        <div><label>DAP Budget</label><input type="number" step="0.01" value={patient?.dap_budget || ''} onChange={e => setPatient({ ...patient!, dap_budget: parseFloat(e.target.value) })} /></div>
        <button onClick={handleScreen2Save} disabled={saving}>{saving ? 'Saving…' : 'Continue'}</button>
      </div>
    )

  // ------------------- SCREEN 3 -------------------
  if (step === 'screen3')
    return (
      <div style={{ padding: 24 }}>
        <h2>Available Beds</h2>
        {beds.length === 0 && <p>No beds match your preferences.</p>}
        {beds.map(bed => (
          <div key={bed.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 12, borderRadius: 8 }}>
            <h3>{bed.facility_name}</h3>
            <p>Suburb: {bed.suburb}</p>
            <p>Room Type: {bed.room_type}</p>
            {bed.rad && <p>RAD: ${bed.rad.toLocaleString()}</p>}
            {bed.dap && <p>DAP: ${bed.dap.toFixed(2)}</p>}
            <p>Distance: {bed.distance_km} km</p>
            <button onClick={() => handleRegisterInterest(bed)}>Register Interest</button>
          </div>
        ))}
      </div>
    )

  return <p>Done!</p>
}
