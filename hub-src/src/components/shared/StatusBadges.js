import React from 'react';

const PAYOUT_MAP = {
  'Pending':  'badge-not-invoiced',
  'Partial':  'badge-pending',
  'Paid':     'badge-paid',
  'On Hold':  'badge-overdue',
  'N/A':      'badge-not-invoiced',
};

export function PayoutBadge({ status }) {
  return (
    <span className={`badge ${PAYOUT_MAP[status] || 'badge-not-invoiced'}`}>
      {status || 'Pending'}
    </span>
  );
}

const SPLIT_MAP = {
  'Pending': 'badge-not-invoiced',
  'Sent':    'badge-invoiced',
  'Cleared': 'badge-paid',
  'Failed':  'badge-overdue',
};

export function SplitStatusBadge({ status }) {
  return (
    <span className={`badge ${SPLIT_MAP[status] || 'badge-not-invoiced'}`}>
      {status}
    </span>
  );
}
