import React from 'react';

const STATUS_CLASS = {
  // Campaign status
  'Negotiating': 'badge-negotiating',
  'Confirmed': 'badge-confirmed',
  'Active': 'badge-active',
  'Completed': 'badge-completed',
  'Cancelled': 'badge-cancelled',
  // Payment status
  'Not Invoiced': 'badge-not-invoiced',
  'Invoiced': 'badge-invoiced',
  'Pending': 'badge-pending',
  'Paid': 'badge-paid',
  'Overdue': 'badge-overdue',
  'Disputed': 'badge-disputed',
  // Draft status
  'Not Started': 'badge-not-started',
  'Draft Submitted': 'badge-draft-submitted',
  'Revisions Requested': 'badge-revisions-requested',
  'Approved': 'badge-approved',
  'Posted': 'badge-posted',
};

export default function Badge({ status }) {
  const cls = STATUS_CLASS[status] || 'badge-not-started';
  return <span className={`badge ${cls}`}>{status}</span>;
}
