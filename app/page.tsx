'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Patient = {
  id: string
  preferred_suburb: string
  max_distance_km: number
  care_type: 'RAD' | 'DAP'
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

/* -------------------------------------------------- */
/* Suburb coordinates (static for now)                 */
/* -------------------------------------------------- */

const SUBURB_COORDS: Record<string, { lat: number; lon: number }> = {
  // WA
  Perth: { lat: -31.9523, lon: 115.8613 },
  Landsdale: { lat: -31.8075, lon: 115.8346 },
  Joondalup: { lat: -31.7444, lon: 115.7667 },
  Scarborough: { lat: -31.8950, lon: 115.7643 },

  // NSW
  Wollongong: { lat: -34.4278, lon: 150.8931 },
  Corrimal: { lat: -34.3783, lon: 150.9034 },
}

/* -------------------------------------------------- */
/* Haversine formula                                  */
/* -------------------------------------------------- */

function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180

  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function Page() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const { data: patientData } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!patientData) {
      setLoading(false)
      return
    }

    setPatient(patientData)

    const { data: bedsData } = await supabase
      .from('beds')
      .select('*')
      .eq('status', 'Available')

    if (!bedsData) {
      setBeds([])
      setLoading(false)
      return
    }

    const origin = SUBURB_COORDS[patientData.preferred_suburb]

    if (!origin) {
      setBeds([])
      setLoading(false)
      return
    }

    const matchedBeds: Bed[] = bedsData
      .map((bed: Bed) => {
        const dest = SUBURB_COORDS[bed.suburb]
        if (!dest) return null

        const distance = haversineKm(origin, dest)

        return {
          ...bed,
          distance_km: distance,
        }
      })
      .filter((b): b is Bed => b !== null)
      .filter(b => b.distance_km <= patientData.max_distance_km)
      .filter(b => {
        if (patientData.care_type === 'RAD') {
          return b.rad !== null && b.rad <= (patientData.rad_budget ?? 0)
        }
        return b.dap !== null && b.dap <= (patientData.dap_budget ?? 0)
      })
      .sort((a, b) => a.distance_km! - b.distance_km!)

    setBeds(matchedBeds)
    setLoading(false)
  }

  if (loading) return <p>Loading…</p>

  if (!patient) {
    return <p>No patient preferences found.</p>
  }

  if (beds.length === 0) {
    return (
      <div>
        <h2>No beds currently available</h2>
        <p>
          There are currently no beds available within{' '}
          <strong>{patient.max_distance_km}km</strong> of{' '}
          <strong>{patient.preferred_suburb}</strong> for your{' '}
          <strong>
            {patient.care_type === 'RAD'
              ? `RAD budget of $${patient.rad_budget}`
              : `DAP budget of $${patient.dap_budget}`}
          </strong>
          .
        </p>
        <p>The app updates with new beds regularly. Please check back soon.</p>
      </div>
    )
  }

  return (
    <div>
      <h2>Available beds</h2>

      <ul>
        {beds.map(bed => (
          <li key={bed.id}>
            <strong>{bed.facility_name}</strong> — {bed.suburb} (
            {bed.distance_km?.toFixed(1)}km)
          </li>
        ))}
      </ul>
    </div>
  )
}
