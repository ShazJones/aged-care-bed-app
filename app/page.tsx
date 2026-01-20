'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

/* ============================
   Types
============================ */
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

type Suburb = {
  name: string
  lat: number
  lng: number
}

/* ============================
   Distance (Haversine)
============================ */
function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2

  return Math.round((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 10) / 10
}

/* ============================
   Page
============================ */
export default function Page() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [screen, setScreen] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ============================
     Load / create patient
  ============================ */
  useEffect(() => {
    const init = async () => {
      let client_uuid = localStorage.getItem('client_uuid')

      if (!client_uuid) {
        client_uuid = crypto.randomUUID()
        localStorage.setItem('client_uuid', client_uuid)
      }

      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('client_uuid', client_uuid)
        .single()

      if (data) {
        setPatient(data)
        setLoading(false)
        return
      }

      const { data: created, error } = await supabase
        .from('patients')
        .insert({ client_uuid })
        .select()
        .single()

      if (error) {
        setError('Failed to create patient')
      } else {
        setPatient(created)
      }

      setLoading(false)
    }

    init()
  }, [])

  /* ============================
     Derive screen from data
  ============================ */
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

  /* ============================
     Load beds + distance match
  ============================ */
  useEffect(() => {
    if (screen !== 3 || !patient) return

    const loadBeds = async () => {
      const { data: suburbs } = await supabase
        .from('suburbs')
        .select('*')

      if (!suburbs) return

      const suburbMap: Record<string, Suburb> = {}
      suburbs.forEach(s => {
        suburbMap[s.name] = s
      })

      const patientSuburb = suburbMap[patient.preferred_suburb!]
      if (!patientSuburb) return

      const { data: bedsData } = await supabase
        .from('beds')
        .select('*')
        .eq('status', 'Available')

      if (!bedsData) return

      const matched = bedsData
        .map((bed: Bed) => {
          const bedSuburb = suburbMap[bed.suburb]
          if (!bedSuburb) return null

          const distance = calculateDistanceKm(
            patientSuburb.lat,
            patientSuburb.lng,
            bedSuburb.lat,
            bedSuburb.lng
          )

          return { ...bed, distance_km: distance }
        })
        .filter((b): b is Bed => b !== null)
        .filter(b => b.distance_km! <= patient.max_distance_km!)
        .sort((a, b) => a.distance_km! - b.distance_km!)

      setBeds(matched)
    }

    loadBeds()
  }, [screen, patient])

  /* ============================
     Save helper
  ============================ */
  const updatePatient = async (updates: Partial<Patient>) => {
    if (!patient) return
    setSaving(true)

    const { data, error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', patient.id)
      .select()
      .single()

    if (!error) setPatient(data)
    setSaving(false)
  }

  if (loading) return <p>Loading…</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  /* ============================
     SCREEN 3 — Bed feed
  ============================ */
  if (screen === 3 && patient) {
    return (
      <div>
        <h1>Available beds</h1>

        {beds.length === 0 && (
          <p>
            No beds currently available within {patient.max_distance_km} km of{' '}
            {patient.preferred_suburb} for your{' '}
            {patient.rad_budget
              ? `RAD budget of $${patient.rad_budget.toLocaleString()}`
              : `DAP budget of $${patient.dap_budget?.toFixed(2)} per day`}
            .
            <br />
            This app updates as new beds become available.
            Please check back tomorrow.
          </p>
        )}

        {beds.map(bed => (
          <div key={bed.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 12 }}>
            <strong>{bed.facility_name}</strong>
            <p>{bed.suburb} · {bed.distance_km} km away</p>
            <p>{bed.room_type}</p>
            {bed.rad && <p>RAD: ${bed.rad.toLocaleString()}</p>}
            {bed.dap && <p>DAP: ${bed.dap.toFixed(2)} / day</p>}
            <button>Register Interest</button>
          </div>
        ))}
      </div>
    )
  }

  return <p>Preparing your bed feed…</p>
}
