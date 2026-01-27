'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Patient = {
  id: string
  first_name: string
  last_name: string
  email: string
  mobile: string
  hospital: string
  approval_code: string
  preferred_suburb: string
  max_distance_km: number
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

const SUBURB_COORDS: Record<string, [number, number]> = {
  landsdale: [-31.7885, 115.8477],
  perth: [-31.9505, 115.8605],
  joondalup: [-31.745, 115.7667],
  scarborough: [-31.8925, 115.7561],
  wollongong: [-34.4278, 150.8931],
  corrimal: [-34.4017, 150.9103],
}

function calculateDistanceKm(a: string, b: string): number {
  const c1 = SUBURB_COORDS[a.trim().toLowerCase()]
  const c2 = SUBURB_COORDS[b.trim().toLowerCase()]
  if (!c1 || !c2) return Infinity

  const toRad = (x: number) => (x * Math.PI) / 180
  const [lat1, lon1] = c1
  const [lat2, lon2] = c2

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const aVal =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2

  return 6371 * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [registeredBedIds, setRegisteredBedIds] = useState<string[]>([])
  const [registeringBedId, setRegisteringBedId] = useState<string | null>(null)

  useEffect(() => {
    const client_uuid = localStorage.getItem('client_uuid')

    if (!client_uuid) {
      setLoading(false)
      return
    }

    async function loadPatient() {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('client_uuid', client_uuid)
        .single()

      if (error || !data) {
        setLoading(false)
        return
      }

      setPatient(data)

      const { data: bedsData } = await supabase
        .from('beds')
        .select('*')
        .eq('status', 'open')

      if (bedsData) {
        setBeds(
          bedsData.map((bed: Bed) => ({
            ...bed,
            distance_km: calculateDistanceKm(
              data.preferred_suburb,
              bed.suburb
            ),
          }))
        )
      }

      setLoading(false)
    }

    loadPatient()
  }, [])

  async function registerInterest(bedId: string) {
    if (!patient) return

    setRegisteringBedId(bedId)

    const { error } = await supabase.from('bed_interests').insert({
      patient_id: patient.id,
      bed_id: bedId,
    })

    setRegisteringBedId(null)

    if (!error) {
      setRegisteredBedIds((prev) => [...prev, bedId])
    } else {
      alert('Unable to register interest. Please try again.')
      console.error(error)
    }
  }

  if (loading) {
    return <div>Loading…</div>
  }

  // 🔑 SAFETY FIX: restart onboarding without routing or 404
  if (!patient) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Find an Aged Care Bed</h1>
        <p>Let’s get started.</p>
        <button
          onClick={() => {
            localStorage.clear()
            window.location.reload()
          }}
        >
          Start onboarding
        </button>
      </div>
    )
  }

  const matchedBeds = beds.filter((bed) => {
    if (bed.distance_km === undefined) return false

    const withinDistance = bed.distance_km <= patient.max_distance_km
    const withinBudget =
      (patient.dap_budget !== null &&
        bed.dap !== null &&
        bed.dap <= patient.dap_budget) ||
      (patient.rad_budget !== null &&
        bed.rad !== null &&
        bed.rad <= patient.rad_budget)

    return withinDistance && withinBudget
  })

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Available Beds</h1>

      {matchedBeds.length === 0 ? (
        <p>
          No beds currently available within {patient.max_distance_km} km
          of {patient.preferred_suburb}.
        </p>
      ) : (
        <ul>
          {matchedBeds.map((bed) => (
            <li key={bed.id} style={{ marginBottom: '1rem' }}>
              <strong>{bed.facility_name}</strong> — {bed.suburb} —{' '}
              {bed.distance_km?.toFixed(1)} km —{' '}
              {bed.dap !== null ? `DAP $${bed.dap}` : `RAD $${bed.rad}`}

              {registeredBedIds.includes(bed.id) ? (
                <div style={{ color: 'green' }}>
                  ✅ Interest registered. The provider will be in touch.
                </div>
              ) : (
                <button
                  style={{ marginLeft: '1rem' }}
                  disabled={registeringBedId === bed.id}
                  onClick={() => registerInterest(bed.id)}
                >
                  {registeringBedId === bed.id
                    ? 'Registering…'
                    : 'Register Interest'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
