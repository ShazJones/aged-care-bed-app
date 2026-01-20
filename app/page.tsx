'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Patient = {
  id: string
  client_uuid: string
  first_name: string | null
  last_name: string | null
  email: string | null
  mobile: string | null
  hospital: string | null
  approval_code: string | null

  preferred_suburb: string | null
  max_distance_km: number | null
  rad_budget: number | null
  dap_budget: number | null
}

type Bed = {
  id: string
  facility_name: string
  suburb: string
  room_type: string
  rad: number | null
  dap: number | null
  status: string
  distance_km?: number
}

export default function Page() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [screen, setScreen] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ------------------------------
     Load or create patient
  ------------------------------ */
  useEffect(() => {
    const init = async () => {
      let client_uuid = localStorage.getItem('client_uuid')

      if (!client_uuid) {
        client_uuid = crypto.randomUUID()
        localStorage.setItem('client_uuid', client_uuid)
      }

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('client_uuid', client_uuid)
        .single()

      if (data) {
        setPatient(data)
        setLoading(false)
        return
      }

      const { data: created, error: createError } = await supabase
        .from('patients')
        .insert({ client_uuid })
        .select()
        .single()

      if (createError) {
        setError('Error creating patient')
      } else {
        setPatient(created)
      }

      setLoading(false)
    }

    init()
  }, [])

  /* ------------------------------
     Derive screen from data
  ------------------------------ */
  useEffect(() => {
    if (!patient) return

    const screen1Complete =
      patient.first_name &&
      patient.last_name &&
      patient.email &&
      patient.mobile &&
      patient.hospital &&
      patient.approval_code

    const screen2Complete =
      patient.preferred_suburb &&
      patient.max_distance_km &&
      (patient.rad_budget || patient.dap_budget)

    if (!screen1Complete) setScreen(1)
    else if (!screen2Complete) setScreen(2)
    else setScreen(3)
  }, [patient])

  /* ------------------------------
     Load beds (Screen 3 only)
  ------------------------------ */
  useEffect(() => {
    if (screen !== 3 || !patient) return

    const loadBeds = async () => {
      const { data } = await supabase
        .from('beds')
        .select('*')
        .eq('status', 'Available')

      if (!data) return

      const withDistance = data.map((bed: Bed) => ({
        ...bed,
        distance_km: 0 // placeholder until suburb distance table added
      }))

      setBeds(withDistance)
    }

    loadBeds()
  }, [screen, patient])

  /* ------------------------------
     Save helpers
  ------------------------------ */
  const updatePatient = async (updates: Partial<Patient>) => {
    if (!patient) return
    setSaving(true)
    setError(null)

    const { data, error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', patient.id)
      .select()
      .single()

    if (error) {
      setError('Failed to save details')
    } else {
      setPatient(data)
    }

    setSaving(false)
  }

  if (loading) return <p>Loading…</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  /* ==============================
     SCREEN 1 — Onboarding
  ============================== */
  if (screen === 1) {
    return (
      <div>
        <h1>Patient details</h1>

        <input placeholder="First name" onBlur={e => updatePatient({ first_name: e.target.value })} />
        <input placeholder="Last name" onBlur={e => updatePatient({ last_name: e.target.value })} />
        <input placeholder="Email" onBlur={e => updatePatient({ email: e.target.value })} />
        <input placeholder="Mobile" onBlur={e => updatePatient({ mobile: e.target.value })} />
        <input placeholder="Hospital" onBlur={e => updatePatient({ hospital: e.target.value })} />
        <input
          placeholder="Approval code (e.g. 2-123456789012)"
          onBlur={e => updatePatient({ approval_code: e.target.value })}
        />

        {saving && <p>Saving…</p>}
      </div>
    )
  }

  /* ==============================
     SCREEN 2 — Preferences
  ============================== */
  if (screen === 2) {
    return (
      <div>
        <h1>Care preferences</h1>

        <input
          placeholder="Preferred suburb"
          onBlur={e => updatePatient({ preferred_suburb: e.target.value })}
        />

        <input
          type="number"
          placeholder="Max distance (km)"
          onBlur={e => updatePatient({ max_distance_km: Number(e.target.value) })}
        />

        <input
          type="number"
          placeholder="RAD budget ($)"
          onBlur={e => updatePatient({ rad_budget: Number(e.target.value) })}
        />

        <input
          type="number"
          step="0.01"
          placeholder="DAP budget ($/day)"
          onBlur={e => updatePatient({ dap_budget: Number(e.target.value) })}
        />

        {saving && <p>Saving…</p>}
      </div>
    )
  }

  /* ==============================
     SCREEN 3 — Bed Feed
  ============================== */
  return (
    <div>
      <h1>Available beds</h1>

      {beds.length === 0 && <p>No beds currently available</p>}

      {beds.map(bed => (
        <div key={bed.id} style={{ border: '1px solid #ccc', marginBottom: 12, padding: 12 }}>
          <strong>{bed.facility_name}</strong>
          <p>{bed.suburb}</p>
          <p>{bed.room_type}</p>
          {bed.rad && <p>RAD: ${bed.rad.toLocaleString()}</p>}
          {bed.dap && <p>DAP: ${bed.dap.toFixed(2)} / day</p>}
          <button>Register Interest</button>
        </div>
      ))}
    </div>
  )
}
