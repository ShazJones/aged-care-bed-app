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

// Suburb coordinates (lat, lon)
const SUBURB_COORDS: Record<string, [number, number]> = {
  landsdale: [-31.7885, 115.8477],
  perth: [-31.9505, 115.8605],
  joondalup: [-31.745, 115.7667],
  scarborough: [-31.8925, 115.7561],
  wollongong: [-34.4278, 150.8931],
  corrimal: [-34.4017, 150.9103],
}

// Haversine formula
function calculateDistanceKm(suburb1: string, suburb2: string): number {
  const key1 = suburb1.trim().toLowerCase()
  const key2 = suburb2.trim().toLowerCase()

  const coord1 = SUBURB_COORDS[key1]
  const coord2 = SUBURB_COORDS[key2]

  if (!coord1 || !coord2) {
    console.log('Missing coordinates for:', suburb1, suburb2)
    return Infinity
  }

  const toRad = (x: number) => (x * Math.PI) / 180
  const [lat1, lon1] = coord1
  const [lat2, lon2] = coord2

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const R = 6371
  return R * c
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [error, setError] = useState<string | null>(null)

  const [registeringBedId, setRegisteringBedId] = useState<string | null>(null)
  const [registeredBedIds, setRegisteredBedIds] = useState<string[]>([])

  useEffect(() => {
    const client_uuid = localStorage.getItem('client_uuid')
    if (!client_uuid) {
      setError('No patient ID found. Please start onboarding.')
      setLoading(false)
      return
    }

    const fetchPatient = async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('client_uuid', client_uuid)
        .single()

      if (error) {
        setError('Error loading patient info: ' + error.message)
        setLoading(false)
        return
      }

      setPatient(data as Patient)
      setLoading(false)
    }

    fetchPatient()
  }, [])

  useEffect(() => {
    if (!patient) return

    const fetchBeds = async () => {
      const { data, error } = await supabase
        .from('beds')
        .select('*')
        .eq('status', 'open')

      if (error) {
        console.error('Error loading beds:', error)
        return
      }

      const bedsWithDistance = (data as Bed[]).map((bed) => ({
        ...bed,
        distance_km: calculateDistanceKm(
          patient.preferred_suburb,
          bed.suburb
        ),
      }))

      setBeds(bedsWithDistance)
    }

    fetchBeds()
  }, [patient])

  async function registerInterest(bedId: string) {
    if (!patient) return

    setRegisteringBedId(bedId)

    const { error } = await supabase.from('bed_interests').insert({
      patient_id: patient.id,
      bed_id: bedId,
    })

    setRegisteringBedId(null)

    if (error) {
      console.error('Register interest error:', error)
      alert('Unable to register interest. Please try again.')
      return
    }

    setRegisteredBedIds((prev) => [...prev, bedId])
  }

  if (loading) return <div>Loading your preferences…</div>
  if (error) return <div>{error}</div>
  if (!patient) return <div>No patient data found</div>

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
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Bed Finder — Step 3</h1>

      <h2>Your Preferences</h2>
      <ul>
        <li>
          <strong>Preferred Suburb:</strong> {patient.preferred_suburb}
        </li>
        <li>
          <strong>Max Distance:</strong> {patient.max_distance_km} km
        </li>
        <li>
          <strong>RAD Budget:</strong>{' '}
          {patient.rad_budget ?? 'N/A'}
        </li>
        <li>
          <strong>DAP Budget:</strong>{' '}
          {patient.dap_budget ?? 'N/A'}
        </li>
      </ul>

      <h2>Available Beds</h2>

      {matchedBeds.length === 0 ? (
        <p>
          No beds currently available within {patient.max_distance_km} km
          of {patient.preferred_suburb} for your budget.
          <br />
          The app updates frequently — please check back soon.
        </p>
      ) : (
        <ul>
          {matchedBeds.map((bed) => (
            <li key={bed.id} style={{ marginBottom: '1rem' }}>
              <strong>{bed.facility_name}</strong> — {bed.suburb} —{' '}
              {bed.room_type} —{' '}
              {bed.distance_km?.toFixed(1)} km —{' '}
              {bed.dap !== null ? `DAP $${bed.dap}` : `RAD $${bed.rad}`}

              {registeredBedIds.includes(bed.id) ? (
                <div style={{ color: 'green', marginTop: '0.5rem' }}>
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
