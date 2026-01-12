// client/src/components/Breadcrumbs.jsx
import React from 'react';
import { ChevronRight } from 'lucide-react'
import '../styles/tournamentDetails.css'

function Breadcrumbs({ items }) {
  return (
    <nav aria-label="breadcrumb" className="breadcrumbs">
      <ol>
        {items.map((i, idx) => (
          <li key={idx} className="breadcrumb-item">
            {idx < items.length - 1 ? (
              <>
                <a href={i.href}>{i.label}</a>
                <ChevronRight size={16} aria-hidden="true" className="breadcrumb-separator" />
              </>
            ) : (
              <span aria-current="page">{i.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;