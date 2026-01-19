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
  phone: string
  hospital: string
  approval_code: string
  preferred_suburb: string | null
  max_distance_km: number | null
  rad_budget: number | null
  dap_budget: number | null
}

export default function Screen2() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [step, setStep] = useState<'form' | 'done'>('form')

  const clientUUID =
    typeof window !== 'undefined'
      ? localStorage.getItem('client_uuid')
      : null

  useEffect(() => {
    async function loadPatient() {
      if (!clientUUID) {
        setError('Missing client UUID')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('client_uuid', clientUUID)
        .single()

      if (error) {
        setError('Error loading patient: ' + error.message)
      } else {
        setPatient(data)
      }
      setLoading(false)
    }

    loadPatient()
  }, [clientUUID])

  const handleSave = async () => {
    if (!patient) return

    // Validation
    if (
      !patient.first_name ||
      !patient.last_name ||
      !patient.email ||
      !patient.phone ||
      !patient.hospital
    ) {
      alert('Please fill all required fields')
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

    const { error } = await supabase
      .from('patients')
      .update({
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
        phone: patient.phone,
        hospital: patient.hospital,
        approval_code: patient.approval_code,
        preferred_suburb: patient.preferred_suburb,
        max_distance_km: patient.max_distance_km,
        rad_budget: patient.rad_budget,
        dap_budget: patient.dap_budget
      })
      .eq('client_uuid', patient.client_uuid)

    setSaving(false)

    if (error) {
      console.error(error)
      setError('Failed to save preferences: ' + error.message)
    } else {
      setStep('done')
    }
  }

  if (loading) return <p>Loading patient info…</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>
  if (!patient) return <p>No patient found</p>

  if (step === 'done')
    return (
      <div style={{ padding: 24 }}>
        <h2>Preferences saved!</h2>
        <p>You can now proceed to view available beds.</p>
      </div>
    )

  return (
    <div style={{ padding: 24 }}>
      <h2>Step 2: Set your preferences</h2>

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
        <label>Phone*</label>
        <input
          type="text"
          value={patient.phone}
          onChange={e =>
            setPatient({ ...patient, phone: e.target.value })
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

      <div>
        <label>Preferred Suburb</label>
        <input
          type="text"
          value={patient.preferred_suburb || ''}
          onChange={e =>
            setPatient({ ...patient, preferred_suburb: e.target.value })
          }
        />
      </div>

      <div>
        <label>Maximum Distance (km)</label>
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
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </div>
  )
}
