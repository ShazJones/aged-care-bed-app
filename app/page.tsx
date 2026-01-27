'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Patient = {
  id: string
  name: string
  email: string
  mobile: string
  preferred_suburb?: string
  max_distance_km?: number
  rad_budget?: number | null
  dap_budget?: number | null
}

type Bed = {
  id: string
  facility_name: string
  suburb: string
  room_type: string
  rad: number | null
  dap: number | null
  status: string
}

type Screen = 'onboarding' | 'preferences' | 'results' | 'interest_done'

export default function Page() {
  const [screen, setScreen] = useState<Screen>('onboarding')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ---------------- ENTRY CHECK ---------------- */

  useEffect(() => {
    const init = async () => {
      const patientId = localStorage.getItem('patient_id')
      if (!patientId) {
        setScreen('onboarding')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()

      if (error || !data) {
        localStorage.removeItem('patient_id')
        setScreen('onboarding')
        setLoading(false)
        return
      }

      setPatient(data)
      if (
        data.preferred_suburb &&
        data.max_distance_km != null &&
        (data.rad_budget != null || data.dap_budget != null)
      ) {
        setScreen('results')
      } else {
        setScreen('preferences')
      }

      setLoading(false)
    }

    init()
  }, [])

  /* ---------------- SCREEN 1: ONBOARDING ---------------- */

  const handleCreatePatient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    const { data, error } = await supabase
      .from('patients')
      .insert({
        name: formData.get('name'),
        email: formData.get('email'),
        mobile: formData.get('mobile'),
      })
      .select()
      .single()

    if (error) {
      setError('Unable to create patient')
      setSaving(false)
      return
    }

    localStorage.setItem('patient_id', data.id)
    setPatient(data)
    setScreen('preferences')
    setSaving(false)
  }

  /* ---------------- SCREEN 2: PREFERENCES ---------------- */

  const handleSavePreferences = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!patient) return

    setSaving(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    const updates = {
      preferred_suburb: formData.get('preferred_suburb'),
      max_distance_km: Number(formData.get('max_distance_km')),
      rad_budget: formData.get('rad_budget')
        ? Number(formData.get('rad_budget'))
        : null,
      dap_budget: formData.get('dap_budget')
        ? Number(formData.get('dap_budget'))
        : null,
    }

    const { data, error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', patient.id)
      .select()
      .single()

    if (error) {
      setError('Unable to save preferences')
      setSaving(false)
      return
    }

    setPatient(data)
    setScreen('results')
    setSaving(false)
  }

  /* ---------------- SCREEN 3: BED MATCHING ---------------- */

  useEffect(() => {
    if (screen !== 'results' || !patient) return

    const loadBeds = async () => {
      const { data } = await supabase
        .from('beds')
        .select('*')
        .eq('status', 'open')

      if (!data) return

      const filtered = data.filter((b: Bed) => {
        if (patient.dap_budget != null && b.dap != null) {
          return b.dap <= patient.dap_budget
        }
        if (patient.rad_budget != null && b.rad != null) {
          return b.rad <= patient.rad_budget
        }
        return false
      })

      setBeds(filtered)
    }

    loadBeds()
  }, [screen, patient])

  const handleRegisterInterest = async (bed: Bed) => {
    if (!patient) return
    setSaving(true)
    setError(null)

    const { error } = await supabase.from('bed_interests').insert({
      patient_id: patient.id,
      bed_id: bed.id,
    })

    if (error) {
      setError('Unable to register interest')
      setSaving(false)
      return
    }

    setSelectedBed(bed)
    setScreen('interest_done')
    setSaving(false)
  }

  /* ---------------- RENDER ---------------- */

  if (loading) return <p>Loading…</p>

  if (screen === 'onboarding') {
    return (
      <form onSubmit={handleCreatePatient}>
        <h1>Start onboarding</h1>
        <input name="name" placeholder="Name" required />
        <input name="email" placeholder="Email" required />
        <input name="mobile" placeholder="Mobile" required />
        <button disabled={saving}>Continue</button>
        {error && <p>{error}</p>}
      </form>
    )
  }

  if (screen === 'preferences' && patient) {
    return (
      <form onSubmit={handleSavePreferences}>
        <h1>Your preferences</h1>
        <input name="preferred_suburb" placeholder="Suburb" required />
        <input
          name="max_distance_km"
          placeholder="Max distance (km)"
          type="number"
          required
        />
        <input name="dap_budget" placeholder="DAP budget" type="number" />
        <input name="rad_budget" placeholder="RAD budget" type="number" />
        <button disabled={saving}>Find beds</button>
        {error && <p>{error}</p>}
      </form>
    )
  }

  if (screen === 'results') {
    return (
      <div>
        <h1>Available beds</h1>
        {beds.length === 0 && <p>No beds currently available.</p>}
        {beds.map(bed => (
          <div key={bed.id}>
            <strong>{bed.facility_name}</strong> – {bed.suburb}
            <button onClick={() => handleRegisterInterest(bed)}>
              Register interest
            </button>
          </div>
        ))}
        {error && <p>{error}</p>}
      </div>
    )
  }

  if (screen === 'interest_done' && selectedBed) {
    return (
      <div>
        <h1>✅ Interest registered</h1>
        <p>
          The provider at <strong>{selectedBed.facility_name}</strong> will be in
          touch.
        </p>
      </div>
    )
  }

  return null
}
