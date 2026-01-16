'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// -------------------------
// Supabase setup
// -------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables missing!')
}

const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

// -------------------------
// Helper: client UUID
// -------------------------
function getClientUUID() {
  if (typeof window === 'undefined') return null
  let id = localStorage.getItem('client_uuid')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('client_uuid', id)
    console.log('Generated new client_uuid:', id)
  } else {
    console.log('Loaded client_uuid from localStorage:', id)
  }
  return id
}

// -------------------------
// Types
// -------------------------
type Patient = {
  id: string
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  hospital: string
  approval_code: string
  rad_amount?: number
  dap_amount?: number
  means_tested_care_fee?: number
}

type Bed = {
  id: string
  facility_name: string
  suburb: string
  room_type: string
  available_from_date: string
  rad: number | null
  dap: number | null
  status: string
}

type Interest = {
  id: string
  bed_id: string
  status: string
}

// -------------------------
// Main Component
// -------------------------
export default function Home() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [interests, setInterests] = useState<Interest[]>([])
  const [step, setStep] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  // -------------------------
  // Load or create patient
  // -------------------------
  useEffect(() => {
    async function loadOrCreatePatient() {
      const clientUUID = getClientUUID()
      if (!clientUUID) {
        console.error('client_uuid not available')
        setLoading(false)
        return
      }

      try {
        // Try to fetch existing patient
        const { data: existing, error: selectError } = await supabase
          .from('patients')
          .select('*')
          .eq('client_uuid', clientUUID)
          .single()

        if (selectError && selectError.code !== 'PGRST116') {
          console.error('Error loading patient:', selectError)
        }

        if (existing) {
          setPatient(existing)
        } else {
          // Create new patient row if none exists
          const { data: created, error: insertError } = await supabase
            .from('patients')
            .insert({ client_uuid: clientUUID, hospital: '', approval_code: '' })
            .select()
            .single()

          if (insertError) console.error('Error creating patient:', insertError)
          else setPatient(created)
        }
      } catch (err) {
        console.error('Unexpected error loading/creating patient:', err)
      } finally {
        setLoading(false)
      }
    }

    loadOrCreatePatient()
  }, [])

  // -------------------------
  // Load beds
  // -------------------------
  useEffect(() => {
    async function loadBeds() {
      try {
        const { data, error } = await supabase
          .from('beds')
          .select('*')
          .eq('status', 'open')
          .order('available_from_date', { ascending: true })
        if (error) console.error('Error loading beds:', error)
        else setBeds(data || [])
      } catch (err) {
        console.error('Unexpected error fetching beds:', err)
      }
    }
    loadBeds()
  }, [])

  // -------------------------
  // Load interests
  // -------------------------
  useEffect(() => {
    async function loadInterest() {
      if (!patient) return
      try {
        const { data, error } = await supabase
          .from('interests')
          .select('*')
          .eq('patient_id', patient.id)
          .in('status', ['waiting', 'offered'])
        if (error) console.error('Error loading interests:', error)
        else setInterests(data || [])
      } catch (err) {
        console.error('Unexpected error loading interests:', err)
      }
    }
    loadInterest()
  }, [patient])

  // -------------------------
  // Save patient field
  // -------------------------
  const savePatientField = async (field: keyof Patient, value: any) => {
    if (!patient) return
    try {
      const { data, error } = await supabase
        .from('patients')
        .update({ [field]: value })
        .eq('id', patient.id)
        .select()
        .single()
      if (error) console.error('Error updating patient:', error)
      else setPatient(data)
    } catch (err) {
      console.error('Unexpected error saving patient field:', err)
    }
  }

  // -------------------------
  // Create interest
  // -------------------------
  const createInterest = async (bed_id: string) => {
    if (!patient) return
    if (interests.length > 0) {
      alert('You can only have one active interest at a time.')
      return
    }
    try {
      const { data, error } = await supabase
        .from('interests')
        .insert({ patient_id: patient.id, bed_id })
        .select()
        .single()
      if (error) console.error('Error creating interest:', error)
      else setInterests([data])
    } catch (err) {
      console.error('Unexpected error creating interest:', err)
    }
  }

  if (loading) return <div>Loading...</div>

  // -------------------------
  // Step Screens
  // -------------------------
  if (!patient) return <div>Error loading patient info</div>

  // Step 0: Eligibility
  if (step === 0)
    return (
      <div>
        <h2>Eligibility (people waiting in hospital)</h2>
        <label>
          Hospital:
          <input
            type="text"
            value={patient.hospital || ''}
            onChange={(e) => savePatientField('hospital', e.target.value)}
          />
        </label>
        <label>
          Approval Code (0-123456789012):
          <input
            type="text"
            value={patient.approval_code || ''}
            onChange={(e) => savePatientField('approval_code', e.target.value)}
          />
        </label>
        <button onClick={() => setStep(1)}>Next</button>
      </div>
    )

  // Step 1: Identity
  if (step === 1)
    return (
      <div>
        <h2>Identity</h2>
        <label>
          First Name:
          <input
            type="text"
            value={patient.first_name || ''}
            onChange={(e) => savePatientField('first_name', e.target.value)}
          />
        </label>
        <label>
          Last Name:
          <input
            type="text"
            value={patient.last_name || ''}
            onChange={(e) => savePatientField('last_name', e.target.value)}
          />
        </label>
        <label>
          Phone:
          <input
            type="text"
            value={patient.phone || ''}
            onChange={(e) => savePatientField('phone', e.target.value)}
          />
        </label>
        <label>
          Email:
          <input
            type="email"
            value={patient.email || ''}
            onChange={(e) => savePatientField('email', e.target.value)}
          />
        </label>
        <button onClick={() => setStep(2)}>Next</button>
      </div>
    )

  // Step 2: Constraints
  if (step === 2)
    return (
      <div>
        <h2>Admission Constraints</h2>
        <label>
          Room Type:
          <select
            value={patient.rad_amount ? 'single' : 'shared'}
            onChange={(e) => savePatientField('rad_amount', e.target.value)}
          >
            <option value="single">Single</option>
            <option value="shared">Shared</option>
          </select>
        </label>
        <label>
          RAD amount:
          <input
            type="number"
            value={patient.rad_amount || 0}
            onChange={(e) => savePatientField('rad_amount', Number(e.target.value))}
          />
        </label>
        <label>
          DAP amount:
          <input
            type="number"
            value={patient.dap_amount || 0}
            onChange={(e) => savePatientField('dap_amount', Number(e.target.value))}
          />
        </label>
        <label>
          Means-Tested Care Fee ($0-$400):
          <input
            type="number"
            value={patient.means_tested_care_fee || 0}
            onChange={(e) => savePatientField('means_tested_care_fee', Number(e.target.value))}
          />
        </label>
        <button onClick={() => setStep(3)}>Next</button>
      </div>
    )

  // Step 3: Bed Feed
  if (step === 3)
    return (
      <div>
        <h2>Available Beds</h2>
        {beds.length === 0 ? (
          <p>No beds available right now.</p>
        ) : (
          beds.map((bed) => (
            <div key={bed.id} style={{ border: '1px solid black', margin: 5, padding: 5 }}>
              <p>
                <strong>{bed.facility_name}</strong> — {bed.suburb} — {bed.room_type}
              </p>
              <p>Available From: {bed.available_from_date}</p>
              <p>RAD: {bed.rad || '-'} | DAP: {bed.dap || '-'}</p>
              <button
                disabled={interests.length > 0}
                onClick={() => createInterest(bed.id)}
              >
                {interests.length > 0 ? 'Interest Active' : 'Express Interest'}
              </button>
            </div>
          ))
        )}
      </div>
    )

  return <div>Unknown step</div>
}
