'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// 1️⃣ Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Bed {
  id: string
  facility_name: string
  suburb: string
  room_type: string
  available_from_date: string
  rad_amount: number | null
  dap_amount: number | null
}

interface Interest {
  id: string
  bed_id: string
  user_id: string
}

export default function HomePage() {
  // 2️⃣ Bed state
  const [beds, setBeds] = useState<Bed[]>([])
  const [loadingBeds, setLoadingBeds] = useState(true)

  // 3️⃣ User onboarding fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [hospital, setHospital] = useState('')
  const [approvalCode, setApprovalCode] = useState('')
  const [rad, setRad] = useState<number | null>(null)
  const [dap, setDap] = useState<number | null>(null)
  const [basicFee, setBasicFee] = useState<number>(65.55)
  const [meansTestedFee, setMeansTestedFee] = useState<number>(0)

  const [activeInterest, setActiveInterest] = useState<Interest | null>(null)

  // 4️⃣ Load localStorage data on page load
  useEffect(() => {
    const stored = localStorage.getItem('userInfo')
    if (stored) {
      const data = JSON.parse(stored)
      setFirstName(data.firstName)
      setLastName(data.lastName)
      setPhone(data.phone)
      setEmail(data.email)
      setHospital(data.hospital)
      setApprovalCode(data.approvalCode)
      setRad(data.rad)
      setDap(data.dap)
      setBasicFee(data.basicFee)
      setMeansTestedFee(data.meansTestedFee)
    }
  }, [])

  // 5️⃣ Fetch available beds
  useEffect(() => {
    const fetchBeds = async () => {
      const { data, error } = await supabase
        .from('beds')
        .select('*')
        .eq('status', 'open')
        .order('available_from_date', { ascending: true })

      if (error) console.error(error)
      else setBeds(data as Bed[])
      setLoadingBeds(false)
    }

    fetchBeds()
  }, [])

  // 6️⃣ Fetch existing active interest (demo user)
  useEffect(() => {
    const userId = 'demo-patient'
    const fetchInterest = async () => {
      const { data } = await supabase
        .from('interests')
        .select('*')
        .eq('user_id', userId)
        .single()
      if (data) setActiveInterest(data)
    }
    fetchInterest()
  }, [])

  // 7️⃣ Approval code validation
  const isApprovalCodeValid = (code: string) => /^[1-9]-\d{12}$/.test(code)

  // 8️⃣ Submit interest
  const submitInterest = async (bedId: string) => {
    if (!firstName || !lastName) return alert('Please enter your full name.')
    if (!hospital) return alert('Please enter your current hospital.')
    if (!isApprovalCodeValid(approvalCode)) return alert('Invalid Approval Code format.')
    if (activeInterest) return alert('You already have an active interest.')

    const userId = 'demo-patient'

    const { error } = await supabase.from('interests').insert([
      {
        bed_id: bedId,
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        hospital,
        approval_code: approvalCode,
        rad_amount: rad,
        dap_amount: dap,
        basic_daily_fee: basicFee,
        means_tested_fee: meansTestedFee,
        created_at: new Date()
      }
    ])

    if (error) {
      console.error(error)
      alert('Error submitting interest.')
    } else {
      alert('Interest submitted successfully!')
      setActiveInterest({ id: 'temp', bed_id: bedId, user_id: userId })

      // Save info to localStorage
      localStorage.setItem('userInfo', JSON.stringify({
        firstName,
        lastName,
        phone,
        email,
        hospital,
        approvalCode,
        rad,
        dap,
        basicFee,
        meansTestedFee
      }))
    }
  }

  // 9️⃣ Render form + bed feed
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Available Bed Opportunities</h1>

      {/* Onboarding form */}
      <div style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '2rem' }}>
        <h2>Your Details (Hospital Patients Only)</h2>

        <label>
          First Name:<br />
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} />
        </label>
        <br /><br />

        <label>
          Last Name:<br />
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} />
        </label>
        <br /><br />

        <label>
          Phone:<br />
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
        <br /><br />

        <label>
          Email:<br />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <br /><br />

        <label>
          Current Hospital:<br />
          <input type="text" value={hospital} onChange={e => setHospital(e.target.value)} />
        </label>
        <br /><br />

        <label>
          Permanent Residential Approval Code:<br />
          <input type="text" value={approvalCode} onChange={e => setApprovalCode(e.target.value)} placeholder="0-123456789012" />
        </label>
        <br /><br />

        <label>
          RAD Amount (optional):<br />
          <input type="number" value={rad ?? ''} onChange={e => setRad(e.target.value ? Number(e.target.value) : null)} />
        </label>
        <br /><br />

        <label>
          DAP Amount (optional):<br />
          <input type="number" value={dap ?? ''} onChange={e => setDap(e.target.value ? Number(e.target.value) : null)} />
        </label>
        <br /><br />

        <label>
          Basic Daily Fee ($):<br />
          <input type="number" value={basicFee} onChange={e => setBasicFee(Number(e.target.value))} />
        </label>
        <br /><br />

        <label>
          Means-Tested Care Fee ($):<br />
          <input type="number" value={meansTestedFee} onChange={e => setMeansTestedFee(Number(e.target.value))} />
        </label>
      </div>

      {/* Bed Feed */}
      {loadingBeds ? (
        <p>Loading beds…</p>
      ) : beds.length === 0 ? (
        <p>No beds available at the moment.</p>
      ) : (
        beds.map(bed => (
          <div key={bed.id} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
            <p><strong>Facility:</strong> {bed.facility_name}</p>
            <p><strong>Suburb:</strong> {bed.suburb}</p>
            <p><strong>Room Type:</strong> {bed.room_type}</p>
            <p><strong>Available From:</strong> {bed.available_from_date}</p>
            <p><strong>RAD:</strong> {bed.rad_amount ?? 'N/A'} | <strong>DAP:</strong> {bed.dap_amount ?? 'N/A'}</p>
            <button onClick={() => submitInterest(bed.id)} disabled={!!activeInterest}>
              {activeInterest ? 'Interest Already Submitted' : "I'm Interested"}
            </button>
          </div>
        ))
      )}
    </div>
  )
}
