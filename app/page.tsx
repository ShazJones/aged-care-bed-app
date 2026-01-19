
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

/* ------------------------------------------------------------------ */
/* SUPABASE CLIENT                                                     */
/* ------------------------------------------------------------------ */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */
function getClientUUID(): string {
  let id = localStorage.getItem('client_uuid')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('client_uuid', id)
  }
  return id
}

const approvalCodeRegex = /^[1-9]-\d{12}$/

const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email)

const parseCurrency = (value: string): number | null => {
  const numeric = value.replace(/[^0-9]/g, '')
  return numeric ? Number(numeric) : null
}

const formatCurrency = (value: string) => {
  const numeric = value.replace(/[^0-9]/g, '')
  if (!numeric) return ''
  return `$${Number(numeric).toLocaleString('en-AU')}`
}

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */
export default function Page() {
  const [clientUUID, setClientUUID] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [step, setStep] = useState<'screen1' | 'screen2' | 'done'>('screen1')

  /* ---------------- SCREEN 1 ---------------- */
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [hospital, setHospital] = useState('')
  const [approvalCode, setApprovalCode] = useState('')

  /* ---------------- SCREEN 2 ---------------- */
  const [radInput, setRadInput] = useState('')
  const [preferredSuburb, setPreferredSuburb] = useState('')
  const [maxDistance, setMaxDistance] = useState('')

  const [saving, setSaving] = useState(false)

  /* ------------------------------------------------------------------ */
  /* LOAD OR CREATE PATIENT                                             */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const uuid = getClientUUID()
    setClientUUID(uuid)
    loadPatient(uuid)
  }, [])

  async function loadPatient(uuid: string) {
    setLoading(true)

    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('client_uuid', uuid)
      .maybeSingle()

    if (error) {
      setError('Error loading patient')
      setLoading(false)
      return
    }

    if (!data) {
      await supabase.from('patients').insert({
        client_uuid: uuid,
        status: 'draft'
      })
      setLoading(false)
      return
    }

    setFirstName(data.first_name || '')
    setLastName(data.last_name || '')
    setEmail(data.email || '')
    setMobile(data.mobile || '')
    setHospital(data.hospital || '')
    setApprovalCode(data.approval_code || '')

    if (data.rad_or_dap) {
      setRadInput(`$${Number(data.rad_or_dap).toLocaleString('en-AU')}`)
    }

    setPreferredSuburb(data.preferred_suburb || '')
    setMaxDistance(data.max_travel_distance?.toString() || '')

    if (data.status === 'ready_to_match') setStep('done')
    else if (data.status === 'onboarded') setStep('screen2')

    setLoading(false)
  }

  /* ------------------------------------------------------------------ */
  /* VALIDATION                                                         */
  /* ------------------------------------------------------------------ */
  const screen1Valid =
    firstName.trim() &&
    lastName.trim() &&
    isValidEmail(email) &&
    mobile.trim() &&
    hospital.trim() &&
    approvalCodeRegex.test(approvalCode)

  const screen2Valid =
    parseCurrency(radInput) !== null &&
    preferredSuburb.trim() &&
    Number(maxDistance) > 0

  /* ------------------------------------------------------------------ */
  /* ACTIONS                                                            */
  /* ------------------------------------------------------------------ */
  async function saveScreen1() {
    if (!clientUUID || !screen1Valid) return
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
    if (!error) setStep('screen2')
  }

  async function saveScreen2() {
    if (!clientUUID || !screen2Valid) return
    setSaving(true)

    const { error } = await supabase
      .from('patients')
      .update({
        rad_or_dap: parseCurrency(radInput),
        preferred_suburb: preferredSuburb.trim(),
        max_travel_distance: Number(maxDistance),
        status: 'ready_to_match'
      })
      .eq('client_uuid', clientUUID)

    setSaving(false)
    if (!error) setStep('done')
  }

  /* ------------------------------------------------------------------ */
  /* RENDER                                                             */
  /* ------------------------------------------------------------------ */
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>
  if (error) return <div style={{ padding: 24, color: 'red' }}>{error}</div>

  /* ---------------- SCREEN 1 ---------------- */
  if (step === 'screen1') {
    return (
      <div style={{ padding: 24, maxWidth: 480 }}>
        <h2>Patient details</h2>

        <input placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} />
        <input placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="Mobile phone" value={mobile} onChange={e => setMobile(e.target.value)} />
        <input placeholder="Hospital" value={hospital} onChange={e => setHospital(e.target.value)} />
        <input
          placeholder="Approval code (e.g. 2-163295213558)"
          value={approvalCode}
          onChange={e => setApprovalCode(e.target.value.trim())}
        />

        <button disabled={!screen1Valid || saving} onClick={saveScreen1}>
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    )
  }

  /* ---------------- SCREEN 2 ---------------- */
  if (step === 'screen2') {
    return (
      <div style={{ padding: 24, maxWidth: 480 }}>
        <h2>Care preferences</h2>

        <input
          placeholder="RAD or DAP ($)"
          value={radInput}
          onChange={e => setRadInput(formatCurrency(e.target.value))}
        />

        <input
          placeholder="Preferred suburb"
          value={preferredSuburb}
          onChange={e => setPreferredSuburb(e.target.value)}
        />

        <input
          placeholder="Max distance willing to travel (km)"
          type="number"
          value={maxDistance}
          onChange={e => setMaxDistance(e.target.value)}
        />

        <button disabled={!screen2Valid || saving} onClick={saveScreen2}>
          {saving ? 'Saving…' : 'See available beds'}
        </button>
      </div>
    )
  }

  /* ---------------- DONE ---------------- */
  return (
    <div style={{ padding: 24 }}>
      <h2>Ready to match</h2>
      <p>We’ll now show bed opportunities that fit your criteria.</p>
    </div>
  )
}
