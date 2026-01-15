'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Bed {
  id: string
  room_type: string
  available_from_date: string
  rad_amount: number | null
  dap_amount: number | null
  facilities: {
    facility_name: string
    suburb: string
  }
}

export default function HomePage() {
  const [beds, setBeds] = useState<Bed[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBeds = async () => {
      const { data, error } = await supabase
        .from('beds')
        .select('*, facilities(*)')
        .eq('status', 'open')
        .order('available_from_date', { ascending: true })

      if (error) console.error(error)
      else setBeds(data as Bed[])
      setLoading(false)
    }

    fetchBeds()
  }, [])

  const expressInterest = async (bedId: string) => {
    // for now just log
    console.log('Interest sent for bed', bedId)
    alert('Interest sent! (MVP)')
  }

  if (loading) return <p>Loading beds…</p>

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Available Bed Opportunities</h1>
      {beds.length === 0 && <p>No beds available right now.</p>}
      {beds.map(bed => (
        <div key={bed.id} style={{ border: '1px solid #ccc', margin: '1rem 0', padding: '1rem' }}>
          <p><strong>Facility:</strong> {bed.facilities.facility_name}</p>
          <p><strong>Suburb:</strong> {bed.facilities.suburb}</p>
          <p><strong>Room type:</strong> {bed.room_type}</p>
          <p><strong>RAD:</strong> {bed.rad_amount ?? 'N/A'} | <strong>DAP:</strong> {bed.dap_amount ?? 'N/A'}</p>
          <p><strong>Available from:</strong> {bed.available_from_date}</p>
          <button onClick={() => expressInterest(bed.id)}>I’m interested</button>
        </div>
      ))}
    </div>
  )
}
