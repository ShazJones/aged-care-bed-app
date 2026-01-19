'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Patient = {
  id: string
  client_uuid: string
  first_name: string
  last_name: string
  email: string
  mobile: string
  hospital: string
  approval_code: string
  preferred_suburb: string | null
  max_distance_km: number | null
  rad_budget: number | null
  dap_budget: number | null
  status: 'draft' | 'ready'
}

export default function PatientOnboarding() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'screen1' | 'screen2' | 'done'>(
    'screen1'
  )

  const clientUUID =
    typeof window !== 'undefined'
      ? localStorage.getItem('client_uuid')
      : null

  useEffect(() => {
    async function loadPatient() {
      if (!clientUUID) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('client_uuid', clientUUID)
        .single()

      if (error) {
        // No row yet, Screen 1 will create it
        setPatient(null)
        setStep('screen1')
      } else {
        setPatient(data)
        // Determine initial step: if onboarding info complete → screen2
        const hasOnboarding =
          data.first_name &&
          data.last_name &&
          data.email &&
          data.mobile &&
          data.hospital &&
          data.approval_code
        setStep(hasOnboarding ? 'screen2' : 'screen1')
      }

      setLoading(false)
    }

    loadPatient()
  }, [clientUUID])

  // -------------------- SCREEN 1 HANDLER --------------------
  const handleScreen1Save = async () => {
    if (
      !patient?.first_name ||
      !patient?.last_name ||
      !patient?.email ||
      !patient?.mobile ||
      !patient?.hospital ||
      !patient?.approval_code
    ) {
      alert('Please fill all required fields and a valid approval code')
      return
    }

    const approvalCodePattern = /^[1-9]{1}-\d{12}$/
    if (!approvalCodePattern.test(patient.approval_code)) {
      alert(
        'Approval code must be 1 digit (not 0) - dash - 12 digits, e.g. 2-123456789012'
      )
      return
    }

    setSaving(true)
    setError('')

    if (!patient?.client_uuid) {
      // Create new patient
      const newUUID = crypto.randomUUID()
      const { data, error } = await supabase.from('patients').insert({
        client_uuid: newUUID,
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
        mobile: patient.mobile,
        hospital: patient.hospital,
        approval_code: patient.approval_code,
        status: 'draft'
      }).select().single()

      if (error) {
        setError('Failed to create patient: ' + error.message)
        setSaving(false)
        return
      }

      localStorage.setItem('client_uuid', newUUID)
      setPatient(data)
    } else {
      // Update existing row
      const { error } = await supabase
        .from('patients')
        .update({
          first_name: patient.first_name,
          last_name: patient.last_name,
          email: patient.email,
          mobile: patient.mobile,
          hospital: patient.hospital,
          approval_code: patient.approval_code
        })
        .eq('client_uuid', patient.client_uuid)

      if (error) {
        setError('Failed to save: ' + error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setStep('screen2')
  }

  // -------------------- SCREEN 2 HANDLER --------------------
  const handleScreen2Save = async () => {
    if (!patient) return

    // Validate required preferences
    if (!patient.preferred_suburb || !patient.max_distance_km) {
      alert('Please enter preferred suburb and maximum distance')
      return
    }

    // Ensure at least one of RAD or DAP entered
    if (!patient.rad_budget && !patient.dap_budget) {
      alert('Please enter either RAD or DAP budget')
      return
    }

    setSaving(true)
    setError('')

    const { error } = await supabase
      .from('patients')
      .update({
        preferred_suburb: patient.preferred_suburb,
        max_distance_km: patient.max_distance_km,
        rad_budget: patient.rad_budget,
        dap_budget: patient.dap_budget,
        status: 'ready'
      })
      .eq('client_uuid', patient.client_uuid)

    setSaving(false)

    if (error) {
      setError('Failed to save preferences: ' + error.message)
    } else {
      setStep('done')
    }
  }

  if (loading) return <p>Loading patient info…</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  if (!patient) {
    // Initialize blank patient
    setPatient({
      id: '',
      client_uuid: '',
      first_name: '',
      last_name: '',
      email: '',
      mobile: '',
      hospital: '',
      approval_code: '',
      preferred_suburb: null,
      max_distance_km: null,
      rad_budget: null,
      dap_budget: null,
      status: 'draft'
    })
    return <p>Initializing…</p>
  }

  // -------------------- SCREEN 1 UI --------------------
  if (step === 'screen1')
    return (
      <div style={{ padding: 24 }}>
        <h2>Step 1: Enter your personal details</h2>

        <div>
          <label>First Name*</label>
          <input
            type="text"
            value={patient.first_name}
            onChange={e =>
              setPatient({ ...patient, first_name: e.target.value })
            }
          />
        </div>

        <div>
          <label>Last Name*</label>
          <input
            type="text"
            value={patient.last_name}
            onChange={e =>
              setPatient({ ...patient, last_name: e.target.value })
            }
          />
        </div>

        <div>
          <label>Email*</label>
          <input
            type="email"
            value={patient.email}
            onChange={e =>
              setPatient({ ...patient, email: e.target.value })
            }
          />
        </div>

        <div>
          <label>Mobile*</label>
          <input
            type="text"
            value={patient.mobile}
            onChange={e =>
              setPatient({ ...patient, mobile: e.target.value })
            }
          />
        </div>

        <div>
          <label>Hospital*</label>
          <input
            type="text"
            value={patient.hospital}
            onChange={e =>
              setPatient({ ...patient, hospital: e.target.value })
            }
          />
        </div>

        <div>
          <label>Approval Code*</label>
          <input
            type="text"
            placeholder="2-123456789012"
            value={patient.approval_code}
            onChange={e =>
              setPatient({ ...patient, approval_code: e.target.value })
            }
          />
        </div>

        <button
          style={{ marginTop: 20 }}
          onClick={handleScreen1Save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Continue to Preferences'}
        </button>
      </div>
    )

  // -------------------- SCREEN 2 UI --------------------
  if (step === 'screen2')
    return (
      <div style={{ padding: 24 }}>
        <h2>Step 2: Set your care preferences</h2>

        <div>
          <label>Preferred Suburb*</label>
          <input
            type="text"
            value={patient.preferred_suburb || ''}
            onChange={e =>
              setPatient({ ...patient, preferred_suburb: e.target.value })
            }
          />
        </div>

        <div>
          <label>Maximum Distance (km)*</label>
          <input
            type="number"
            value={patient.max_distance_km || ''}
            onChange={e =>
              setPatient({
                ...patient,
                max_distance_km: parseInt(e.target.value)
              })
            }
          />
        </div>

        <div>
          <label>RAD Budget</label>
          <input
            type="number"
            step="0.01"
            value={patient.rad_budget || ''}
            onChange={e =>
              setPatient({
                ...patient,
                rad_budget: parseFloat(e.target.value)
              })
            }
          />
        </div>

        <div>
          <label>DAP Budget</label>
          <input
            type="number"
            step="0.01"
            value={patient.dap_budget || ''}
            onChange={e =>
              setPatient({
                ...patient,
                dap_budget: parseFloat(e.target.value)
              })
            }
          />
        </div>

        <button
          style={{ marginTop: 20 }}
          onClick={handleScreen2Save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Register Interest'}
        </button>
      </div>
    )

  // -------------------- DONE --------------------
  return (
    <div style={{ padding: 24 }}>
      <h2>Preferences saved!</h2>
      <p>You can now proceed to view available beds.</p>
    </div>
  )
}
