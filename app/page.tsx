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

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Step 1: fetch patient data
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

      if (!data) {
        setError('Patient record not found. Please start onboarding.')
        setLoading(false)
        return
      }

      setPatient(data as Patient)
      setLoading(false)
    }

    fetchPatient()
  }, [])

  // Screen render logic
  if (loading) return <div>Loading your preferences…</div>
  if (error) return <div>{error}</div>
  if (!patient) return <div>No patient data found</div>

  // At this point we have a fully loaded patient
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Bed Finder — Step 3 Preview</h1>
      <h2>Patient Preferences:</h2>
      <ul>
        <li>
          <strong>Name:</strong> {patient.first_name} {patient.last_name}
        </li>
        <li>
          <strong>Email:</strong> {patient.email}
        </li>
        <li>
          <strong>Mobile:</strong> {patient.mobile}
        </li>
        <li>
          <strong>Hospital:</strong> {patient.hospital}
        </li>
        <li>
          <strong>Approval Code:</strong> {patient.approval_code}
        </li>
        <li>
          <strong>Preferred Suburb:</strong> {patient.preferred_suburb}
        </li>
        <li>
          <strong>Max Distance (km):</strong> {patient.max_distance_km}
        </li>
        <li>
          <strong>RAD Budget:</strong>{' '}
          {patient.rad_budget !== null ? `$${patient.rad_budget}` : 'N/A'}
        </li>
        <li>
          <strong>DAP Budget:</strong>{' '}
          {patient.dap_budget !== null ? `$${patient.dap_budget}` : 'N/A'}
        </li>
      </ul>

      <div style={{ marginTop: '2rem', color: '#555' }}>
        {/* Placeholder for future bed feed */}
        No beds are calculated yet. Distance and matching logic will come next.
      </div>
    </div>
  )
}
