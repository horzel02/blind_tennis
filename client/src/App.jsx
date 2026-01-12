// client/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import TournamentListPage from './pages/TournamentListPage';
import TournamentFormPage from './pages/TournamentFormPage';
import TournamentDetailsPage from './pages/TournamentDetailsPage';
import TournamentRegistrationsAdmin from './pages/TournamentRegistrationsAdmin';
import MyRegistrationsPage from './pages/MyRegistrationsPage';
import MyTournamentsPage from './pages/MyTournamentsPage';
import PrivateRoute from './components/PrivateRoute';
import RoleRoute from './components/RoleRoute';
import MatchScorePanel from './components/MatchScorePanel';
import TournamentMatches from './components/TournamentMatches';
import TournamentBracket from './components/TournamentBracket';
import TimetablePage from './pages/TimetablePage';
import PublicProfilePage from './pages/PublicProfilePage';
import AdminPanel from './pages/AdminPanel';
import AccountSettingsPage from './pages/AccountSettingsPage';


export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar
          newestOnTop
          closeOnClick
          pauseOnHover
          theme="colored"
          containerProps={{ 'aria-live': 'assertive' }}
        />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Publiczna lista turniejów */}
          <Route path="/tournaments" element={<TournamentListPage />} />

          {/* Strona ze szczegółami, publiczna, ale wewnątrz mogą być warunki dostępu */}
          <Route path="/tournaments/:id/details" element={<TournamentDetailsPage />} />

          {/* Trasa do wyświetlania meczów turnieju */}
          <Route path="/tournaments/:id/matches" element={<TournamentMatches />} />

          {/* Trasa do wyświetlania drabinki turnieju */}
          <Route path="/tournaments/:id/bracket" element={<TournamentBracket />} />

          {/* trasa do panelu sędziowskiego */}
          <Route
            path="/match-score-panel/:matchId"
            element={
              <PrivateRoute>
                <MatchScorePanel />
              </PrivateRoute>
            }
          />
          {/* 
          <Route
            path="/score-input/:matchId"
            element={
              <PrivateRoute>
                <ScoreInputForm />
              </PrivateRoute>
            }
          />
          */}

          {/* Trasy dla zalogowanych użytkowników (prywatne) */}
          <Route
            path="/tournaments/new"
            element={
              <PrivateRoute>
                <TournamentFormPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/tournaments/:id/edit"
            element={
              <PrivateRoute>
                <TournamentFormPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/tournaments/mine"
            element={
              <PrivateRoute>
                <MyTournamentsPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/tournaments/:id/manage/registrations"
            element={
              <PrivateRoute>
                <TournamentRegistrationsAdmin />
              </PrivateRoute>
            }
          />

          <Route
            path="/registrations/mine"
            element={
              <PrivateRoute>
                <MyRegistrationsPage />
              </PrivateRoute>
            }
          />

          <Route path="/timetable"
            element={
              <PrivateRoute>
                <TimetablePage />
              </PrivateRoute>
            }
          />

          <Route
            path="/account"
            element={
              <PrivateRoute>
                <AccountSettingsPage />
              </PrivateRoute>
            }
          />


          <Route path="/u/:id" element={<PublicProfilePage />} />

          <Route path="/admin" element={<AdminPanel />} />

          <Route path="*" element={<div>404 – nie znaleziono</div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
