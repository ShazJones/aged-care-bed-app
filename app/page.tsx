'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Patient = {
  id: string
  preferred_suburb: string
  max_distance_km: number
  rad_budget?: number | null
  dap_budget?: number | null
}

type Bed = {
  id: string
  suburb: string
  status: string
  rad?: number | null
  dap?: number | null
  distance_km?: number
}

/**
 * TEMP distance calc stub
 * (Until we add suburb lat/long table)
 */
function calculateDistanceKm(_: string, __: string): number {
  return Math.floor(Math.random() * 40) + 1
}

export default function Page() {
  const [step, setStep] = useState<'screen1' | 'screen2' | 'screen3'>('screen1')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * SCREEN 3 — Load matching beds
   */
  useEffect(() => {
    if (step !== 'screen3') return
    if (!patient) return   // 🔒 hard guard

    const safePatient: Patient = patient

    async function loadBeds() {
      setLoading(true)
      setError(null)

      try {
        const { data, error } = await supabase
          .from('beds')
          .select('*')
          .eq('status', 'Available')

        if (error) throw error
        if (!data) {
          setBeds([])
          return
        }

        const matchedBeds: Bed[] = data
          .filter(bed => bed.suburb)
          .map((bed: Bed) => ({
            ...bed,
            distance_km: calculateDistanceKm(
              safePatient.preferred_suburb,
              bed.suburb
            )
          }))
          .filter(bed => {
            if (!bed.distance_km) return false

            const withinDistance =
              bed.distance_km <= safePatient.max_distance_km

            const radOk =
              !safePatient.rad_budget ||
              !bed.rad ||
              bed.rad <= safePatient.rad_budget

            const dapOk =
              !safePatient.dap_budget ||
              !bed.dap ||
              bed.dap <= safePatient.dap_budget

            return withinDistance && (radOk || dapOk)
          })

        setBeds(matchedBeds)
      } catch (err: any) {
        setError(err.message || 'Failed to load beds')
      } finally {
        setLoading(false)
      }
    }

    loadBeds()
  }, [step, patient])

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Bed Finder</h1>

      {step === 'screen1' && (
        <button
          className="btn"
          onClick={() =>
            setPatient({
              id: 'demo',
              preferred_suburb: 'Sydney',
              max_distance_km: 25,
              rad_budget: 800,
              dap_budget: 600
            })
          }
        >
          Go to Screen 2
        </button>
      )}

      {step === 'screen2' && (
        <button className="btn" onClick={() => setStep('screen3')}>
          Find Beds
        </button>
      )}

      {step === 'screen3' && (
        <>
          {loading && <p>Loading beds…</p>}
          {error && <p className="text-red-600">{error}</p>}

          {!loading && beds.length === 0 && (
            <p>No suitable beds found.</p>
          )}

          <ul className="space-y-4">
            {beds.map(bed => (
              <li key={bed.id} className="border p-4 rounded">
                <p><strong>Suburb:</strong> {bed.suburb}</p>
                <p><strong>Distance:</strong> {bed.distance_km} km</p>
                {bed.rad && <p>RAD: ${bed.rad}</p>}
                {bed.dap && <p>DAP: ${bed.dap}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
