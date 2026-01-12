// client/src/pages/MyRegistrationsPage.jsx
import React, { useState, useEffect } from 'react'
import { getMyRegistrations }      from '../services/registrationService'
import TournamentList              from '../components/TournamentList'
import { useAuth }                 from '../contexts/AuthContext'

export default function MyRegistrationsPage() {
  const [regs, setRegs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    getMyRegistrations()
      .then(data => setRegs(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Ładowanie…</p>
  if (error)   return <p className="error">Błąd: {error}</p>

  // przygotowujemy array turniejów z dodatkowym polem statusu
  const initialTournaments = regs.map(r => ({
    ...r.tournament,
    registrationStatus: r.status
  }))

  return (
      <TournamentList
        title="Moje zgłoszenia"
        showCreateButton={false}
        initialTournaments={initialTournaments}
      />
  )
}
