'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// Minimal type definitions
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
  available_from_date?: string
  distance_km?: number
}

// Example suburb coordinates (longitude/latitude)
const SUBURB_COORDS: Record<string, { lat: number; lon: number }> = {
  Perth: { lat: -31.9505, lon: 115.8605 },
  Landsdale: { lat: -31.803, lon: 115.843 },
  Joondalup: { lat: -31.745, lon: 115.768 },
  Scarborough: { lat: -31.891, lon: 115.756 },
  Wollongong: { lat: -34.427, lon: 150.893 },
  Corrimal: { lat: -34.333, lon: 150.933 }
}

// Haversine formula
function calculateDistanceKm(from: string, to: string): number {
  const origin = SUBURB_COORDS[from]
  const dest = SUBURB_COORDS[to]
  if (!origin || !dest) return Infinity

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371 // km
  const dLat = toRad(dest.lat - origin.lat)
  const dLon = toRad(dest.lon - origin.lon)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.lat)) *
      Math.cos(toRad(dest.lat)) *
      Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch patient
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
    }

    fetchPatient()
  }, [])

  // Fetch beds after patient is loaded
  useEffect(() => {
    if (!patient) return

    const fetchBeds = async () => {
      const { data, error } = await supabase
        .from('beds')
        .select('*')
        .eq('status', 'open') // filter only open beds
      if (error) {
        setError('Error loading beds: ' + error.message)
        setLoading(false)
        return
      }
      setBeds(data as Bed[])
      setLoading(false)
    }

    fetchBeds()
  }, [patient])

  if (loading) return <div>Loading…</div>
  if (error) return <div>{error}</div>
  if (!patient) return <div>No patient found</div>

  // Map beds with distance
  const bedsWithDistance = beds
    .map((bed) => {
      const distance = calculateDistanceKm(patient.preferred_suburb, bed.suburb)
      return { ...bed, distance_km: distance }
    })
    .filter((bed) => {
      if (!bed.distance_km) return false
      // Budget filter
      const withinBudget =
        (patient.dap_budget !== null && bed.dap !== null && bed.dap <= patient.dap_budget) ||
        (patient.rad_budget !== null && bed.rad !== null && bed.rad <= patient.rad_budget)
      // Distance filter
      const withinDistance = bed.distance_km <= patient.max_distance_km
      return withinBudget && withinDistance
    })
    .sort((a, b) => (a.distance_km! - b.distance_km!)) // closest first

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Bed Finder — Step 3</h1>
      <h2>Patient Preferences:</h2>
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
      {bedsWithDistance.length === 0 ? (
        <div>
          No beds currently available.
          <br />
          There are no beds within {patient.max_distance_km} km of {patient.preferred_suburb} for your{' '}
          {patient.dap_budget !== null ? `DAP budget of $${patient.dap_budget}` : `RAD budget of $${patient.rad_budget}`}.
          <br />
          The app updates frequently — please check back soon.
        </div>
      ) : (
        <ul>
          {bedsWithDistance.map((bed) => (
            <li key={bed.id}>
              {bed.facility_name} — {bed.room_type} — {bed.suburb} —{' '}
              {bed.distance_km?.toFixed(1)} km away —{' '}
              {bed.dap !== null ? `DAP $${bed.dap}` : `RAD $${bed.rad}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
