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

// Example suburb coordinates (lat, lon)
const SUBURB_COORDS: Record<string, [number, number]> = {
  landsdale: [-31.7885, 115.8477],
  perth: [-31.9505, 115.8605],
  joondalup: [-31.7450, 115.7667],
  scarborough: [-31.8925, 115.7561],
  wollongong: [-34.4278, 150.8931],
  corrimal: [-34.4017, 150.9103],
}

// Haversine formula with proper lowercase lookup
function calculateDistanceKm(suburb1: string, suburb2: string): number {
  const key1 = suburb1.trim().toLowerCase()
  const key2 = suburb2.trim().toLowerCase()

  const coord1 = SUBURB_COORDS[key1]
  const coord2 = SUBURB_COORDS[key2]

  if (!coord1 || !coord2) {
    console.log('Missing coordinates:', suburb1, suburb2)
    return Infinity
  }

  const toRad = (x: number) => (x * Math.PI) / 180
  const [lat1, lon1] = coord1
  const [lat2, lon2] = coord2

  console.log('Calculating distance:', lat1, lon1, '->', lat2, lon2)

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const R = 6371 // km
  return R * c
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const client_uuid = localStorage.getItem('client_uuid')
    if (!client_uuid) {
      setError('No patient ID found. Please start onboarding.')
      setLoading(false)
      return
    }

    const fetchPatient = async () => {
      setLoading(true)
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
      const { data, error } = await supabase.from('beds').select('*').eq('status', 'open')
      if (error) {
        console.error('Error loading beds:', error)
        return
      }

      const bedsData = (data as Bed[]).map((bed) => {
        const distance = calculateDistanceKm(patient.preferred_suburb, bed.suburb)
        console.log('Bed:', bed.facility_name)
        console.log('Suburb:', bed.suburb)
        console.log('Distance km:', distance)
        console.log('Patient max distance:', patient.max_distance_km)
        console.log('Patient RAD budget:', patient.rad_budget)
        console.log('Patient DAP budget:', patient.dap_budget)
        console.log('Bed RAD:', bed.rad)
        console.log('Bed DAP:', bed.dap)
        return { ...bed, distance_km: distance }
      })
      setBeds(bedsData)
    }

    fetchBeds()
  }, [patient])

  if (loading) return <div>Loading your preferences…</div>
  if (error) return <div>{error}</div>
  if (!patient) return <div>No patient data found</div>

  const matchedBeds = beds.filter((bed) => {
    if (!bed.distance_km || !patient.max_distance_km) return false
    const withinDistance = bed.distance_km <= patient.max_distance_km

    const withinBudget =
      (patient.dap_budget !== null && bed.dap !== null && bed.dap <= patient.dap_budget) ||
      (patient.rad_budget !== null && bed.rad !== null && bed.rad <= patient.rad_budget)

    return withinDistance && withinBudget
  })

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Bed Finder — Step 3</h1>

      <h2>Your Preferences:</h2>
      <ul>
        <li>
          <strong>Name:</strong> {patient.first_name} {patient.last_name}
        </li>
        <li>
          <strong>Preferred Suburb:</strong> {patient.preferred_suburb}
        </li>
        <li>
          <strong>Max Distance (km):</strong> {patient.max_distance_km}
        </li>
        <li>
          <strong>RAD Budget:</strong> {patient.rad_budget !== null ? `$${patient.rad_budget}` : 'N/A'}
        </li>
        <li>
          <strong>DAP Budget:</strong> {patient.dap_budget !== null ? `$${patient.dap_budget}` : 'N/A'}
        </li>
      </ul>

      <h2>Available Beds:</h2>
      {matchedBeds.length === 0 ? (
        <p>
          No beds currently available within {patient.max_distance_km} km of{' '}
          {patient.preferred_suburb} for your{' '}
          {patient.dap_budget ? `DAP budget of $${patient.dap_budget}` : `RAD budget of $${patient.rad_budget}`}.
          <br />
          The app updates frequently — please check back soon.
        </p>
      ) : (
        <ul>
          {matchedBeds.map((bed) => (
            <li key={bed.id}>
              {bed.facility_name} — {bed.suburb} — {bed.room_type} — Distance:{' '}
              {bed.distance_km?.toFixed(1)} km —{' '}
              {bed.dap !== null ? `DAP $${bed.dap}` : `RAD $${bed.rad}`}
              <button style={{ marginLeft: '1rem' }}>Register Interest</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
