// client/src/pages/NewTournamentsPage.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import TournamentForm from '../components/TournamentForm';
import { Navigate } from 'react-router-dom';

export default function NewTournamentPage() {
  const { user, loading } = useAuth();
  if (loading) return null; // albo spinner
  if (!user.roles.includes('organizer')) {
    return <Navigate to="/tournaments" replace />;
  }
  return <TournamentForm />;
}
