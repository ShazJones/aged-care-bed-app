'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Patient = {
  id: string
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
  const c1 = SUBURB_COORDS[a.toLowerCase()]
  const c2 = SUBURB_COORDS[b.toLowerCase()]
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

export default function Page() {
  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [registeredBedIds, setRegisteredBedIds] = useState<string[]>([])
  const [registeringBedId, setRegisteringBedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const client_uuid = localStorage.getItem('client_uuid')
      if (!client_uuid) {
        setLoading(false)
        return
      }

      // Load patient
      const { data: patientData } = await supabase
        .from('patients')
        .select('*')
        .eq('client_uuid', client_uuid)
        .single()

      if (!patientData) {
        setLoading(false)
        return
      }

      setPatient(patientData)

      // 🔑 Load existing bed interests (FIX #2)
      const { data: interests } = await supabase
        .from('bed_interests')
        .select('bed_id')
        .eq('patient_id', patientData.id)

      if (interests) {
        setRegisteredBedIds(interests.map(i => i.bed_id))
      }

      // Load beds
      const { data: bedsData } = await supabase
        .from('beds')
        .select('*')
        .eq('status', 'open')

      if (bedsData) {
        setBeds(
          bedsData.map((bed: Bed) => ({
            ...bed,
            distance_km: calculateDistanceKm(
              patientData.preferred_suburb,
              bed.suburb
            ),
          }))
        )
      }

      setLoading(false)
    }

    load()
  }, [])

  async function registerInterest(bedId: string) {
    // 🔒 Hard guard against duplicates (FIX #3)
    if (!patient || registeredBedIds.includes(bedId)) return

    setRegisteringBedId(bedId)

    const { error } = await supabase.from('bed_interests').insert({
      patient_id: patient.id,
      bed_id: bedId,
    })

    setRegisteringBedId(null)

    if (!error) {
      // Immediately lock UI
      setRegisteredBedIds(prev => [...prev, bedId])
    } else {
      console.error(error)
      alert('Unable to register interest. Please try again.')
    }
  }

  if (loading) return <div>Loading…</div>

  if (!patient) {
    return <div>Please start onboarding.</div>
  }

  const matchedBeds = beds.filter(bed => {
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
        <p>No suitable beds currently available.</p>
      ) : (
        <ul>
          {matchedBeds.map(bed => (
            <li key={bed.id} style={{ marginBottom: '1rem' }}>
              <strong>{bed.facility_name}</strong> — {bed.suburb} —{' '}
              {bed.distance_km?.toFixed(1)} km

              {registeredBedIds.includes(bed.id) ? (
                <div style={{ color: 'green', marginTop: 4 }}>
                  ✅ Interest registered. The provider will be in touch.
                </div>
              ) : (
                <button
                  style={{ marginLeft: 12 }}
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
