'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

/* ------------------------------------------------------------------ */
/* SUPABASE CLIENT                                                     */
/* ------------------------------------------------------------------ */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

/* ------------------------------------------------------------------ */
/* UTILITIES                                                           */
/* ------------------------------------------------------------------ */
function getClientUUID(): string {
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

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email)
}

// ✅ Approval code: 1 digit non-zero, dash, 12 digits
function isValidApprovalCode(code: string) {
  return /^[1-9]-\d{12}$/.test(code)
}

function isScreen1Valid(data: {
  firstName: string
  lastName: string
  email: string
  mobile: string
  hospital: string
  approvalCode: string
}) {
  return (
    data.firstName.trim() !== '' &&
    data.lastName.trim() !== '' &&
    isValidEmail(data.email) &&
    data.mobile.trim().length >= 8 &&
    data.hospital.trim() !== '' &&
    isValidApprovalCode(data.approvalCode)
  )
}

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */
export default function Page() {
  const [clientUUID, setClientUUID] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'screen1' | 'next'>('screen1')

  /* ---------------- Screen 1 state ---------------- */
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [hospital, setHospital] = useState('')
  const [approvalCode, setApprovalCode] = useState('')
  const [saving, setSaving] = useState(false)

  /* ------------------------------------------------------------------ */
  /* INITIAL LOAD                                                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const id = getClientUUID()
    setClientUUID(id)
    loadOrCreatePatient(id)
  }, [])

  async function loadOrCreatePatient(uuid: string) {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('client_uuid', uuid)
      .maybeSingle()

    if (error) {
      console.error('Error loading patient:', error)
      setError('Error loading patient info')
      setLoading(false)
      return
    }

    if (!data) {
      // Create draft patient
      const { error: insertError } = await supabase.from('patients').insert({
        client_uuid: uuid,
        status: 'draft'
      })

      if (insertError) {
        console.error('Error creating patient:', insertError)
        setError('Error creating patient record')
        setLoading(false)
        return
      }

      setStep('screen1')
      setLoading(false)
      return
    }

    // Pre-fill data
    setFirstName(data.first_name || '')
    setLastName(data.last_name || '')
    setEmail(data.email || '')
    setMobile(data.mobile || '')
    setHospital(data.hospital || '')
    setApprovalCode(data.approval_code || '')

    if (data.status === 'onboarded') {
      setStep('next')
    } else {
      setStep('screen1')
    }

    setLoading(false)
  }

  /* ------------------------------------------------------------------ */
  /* SCREEN 1 CONTINUE                                                   */
  /* ------------------------------------------------------------------ */
  const screen1Valid = isScreen1Valid({
    firstName,
    lastName,
    email,
    mobile,
    hospital,
    approvalCode
  })

  async function handleScreen1Continue() {
    setError(null)

    if (!clientUUID) return

    if (!screen1Valid) {
      setError('Please complete all fields correctly before continuing.')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('patients')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        hospital: hospital.trim(),
        approval_code: approvalCode.trim(),
        status: 'onboarded'
      })
      .eq('client_uuid', clientUUID)

    setSaving(false)

    if (error) {
      console.error('Error saving Screen 1:', error)
      setError('Unable to save details. Please try again.')
      return
    }

    setStep('next')
  }

  /* ------------------------------------------------------------------ */
  /* RENDER                                                             */
  /* ------------------------------------------------------------------ */
  if (loading) {
    return <div style={{ padding: 24 }}>Loading…</div>
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: 'red' }}>
        {error}
      </div>
    )
  }

  /* ---------------- Screen 1 ---------------- */
  if (step === 'screen1') {
    return (
      <div style={{ padding: 24, maxWidth: 480 }}>
        <h2>Patient Details</h2>

        <input
          placeholder="First name"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
        />

        <input
          placeholder="Last name"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
        />

        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          placeholder="Mobile phone"
          value={mobile}
          onChange={e => setMobile(e.target.value)}
        />

        <input
          placeholder="Hospital"
          value={hospital}
          onChange={e => setHospital(e.target.value)}
        />

        <input
          placeholder="Approval code (e.g. 2-163295213558)"
          value={approvalCode}
          onChange={e => setApprovalCode(e.target.value.trim())}
        />

        <div style={{ marginTop: 16 }}>
          <button
            onClick={handleScreen1Continue}
            disabled={!screen1Valid || saving}
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </div>

        {!screen1Valid && (
          <p style={{ color: '#666', marginTop: 8 }}>
            All fields are required. Approval code must be 1 digit (not 0), dash, 12 digits.
          </p>
        )}
      </div>
    )
  }

  /* ---------------- Next screen placeholder ---------------- */
  return (
    <div style={{ padding: 24 }}>
      <h2>Next screen</h2>
      <p>Screen 1 complete. Patient is onboarded.</p>
    </div>
  )
}
