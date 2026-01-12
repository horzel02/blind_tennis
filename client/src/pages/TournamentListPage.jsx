// client/src/pages/TournamentListPage.jsx
import React, { Suspense } from 'react';
import { ToastContainer } from 'react-toastify';

const TournamentListWithControls = React.lazy(() =>
  import('../components/TournamentList')
);

export default function TournamentListPage() {
  return (
    <>
      <Suspense fallback={<p>Ładowanie listy turniejów…</p>}>
        <TournamentListWithControls />
      </Suspense>
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
    </>
  );
}
