'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

/* =====================
   Types
===================== */

type Patient = {
  id: string
  name: string | null
  email: string | null
  mobile: string | null
  hospital: string | null
  acat_number: string | null
  rad_budget: number | null
  dap_budget: number | null
  preferred_suburb: string | null
  room_type: string | null
  max_distance_km: number | null
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

/* =====================
   Helper checks
===================== */

function hasScreen1(p: Patient) {
  return Boolean(
    p.name &&
      p.email &&
      p.mobile &&
      p.hospital &&
      p.acat_number &&
      (p.rad_budget !== null || p.dap_budget !== null)
  )
}

function hasScreen2(p: Patient) {
  return Boolean(
    p.preferred_suburb &&
      p.room_type &&
      p.max_distance_km !== null
  )
}

/* =====================
   Page
===================== */

export default function Page() {
  const [patientId, setPatientId] = useState<string | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)

  /* ---------- Phase 0: read patient_id ---------- */
  useEffect(() => {
    const id = localStorage.getItem('patient_id')
    setPatientId(id)
  }, [])

  /* ---------- Phase 1: load patient ---------- */
  useEffect(() => {
    if (!patientId) {
      setLoading(false)
      return
    }

    supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single()
      .then(({ data }) => {
        setPatient(data)
        setLoading(false)
      })
  }, [patientId])

  /* =====================
     Render decisions
  ===================== */

  if (loading) {
    return <div>Loading…</div>
  }

  /* ---------- No patient_id → Screen 1 ---------- */
  if (!patientId || !patient) {
    return <Screen1Onboarding />
  }

  /* ---------- Screen 1 incomplete ---------- */
  if (!hasScreen1(patient)) {
    return <Screen1Onboarding />
  }

  /* ---------- Screen 2 incomplete ---------- */
  if (!hasScreen2(patient)) {
    return <Screen2Preferences patient={patient} />
  }

  /* ---------- Fully onboarded ---------- */
  return <Screen3Beds patient={patient} />
}

/* =====================
   Screen 1 – Onboarding
===================== */

function Screen1Onboarding() {
  return (
    <div>
      <h1>Find an aged care bed</h1>
      <p>Please complete your details to get started.</p>

      {/* Your EXISTING Screen 1 form goes here unchanged */}
      {/* name, email, mobile, hospital, acat, rad/dap */}
    </div>
  )
}

/* =====================
   Screen 2 – Preferences
===================== */

function Screen2Preferences({ patient }: { patient: Patient }) {
  return (
    <div>
      <h1>Your preferences</h1>

      {/* Your EXISTING Screen 2 form goes here unchanged */}
      {/* suburb, room type, distance */}
    </div>
  )
}

/* =====================
   Screen 3 – Matching
===================== */

function Screen3Beds({ patient }: { patient: Patient }) {
  const [beds, setBeds] = useState<Bed[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('beds')
      .select('*')
      .eq('status', 'open')
      .then(({ data }) => {
        setBeds(data || [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div>Loading beds…</div>

  return (
    <div>
      <h1>Available beds</h1>

      {beds.map(bed => (
        <div key={bed.id}>
          <strong>{bed.facility_name}</strong>
          <div>{bed.suburb}</div>

          {/* EXISTING register interest button logic untouched */}
          <button>Register interest</button>
        </div>
      ))}
    </div>
  )
}
