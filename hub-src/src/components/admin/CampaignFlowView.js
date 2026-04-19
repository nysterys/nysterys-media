import React, { useState } from 'react';

const STEPS = {
  inquiry: {
    label: 'Inbound inquiry',
    sub: 'Brand or agency contact',
    phase: 'Negotiation',
    who: 'Admin',
    color: '#888888',
    detail: {
      description: 'Brand, agency, or label reaches out about a campaign opportunity. Initial contact is handled outside the hub via email or DM.',
      fields: [],
      tips: ['Log the inquiry source so you can track which channels drive deals', 'Clarify creator, deliverable count, and rough budget before entering negotiation'],
    },
  },
  negotiation: {
    label: 'Rate negotiation',
    sub: 'Contracted rate agreed',
    phase: 'Negotiation',
    who: 'Admin',
    color: '#9b7fe8',
    detail: {
      description: 'Negotiate rate, deliverable scope, and timeline with the brand or agency. No hub entry yet — this happens externally.',
      fields: ['Contracted rate', 'Number of deliverables', 'Post dates', 'Rush premium (if applicable)'],
      tips: ['Lock in the contracted rate before creating the campaign — it drives all downstream financial calculations'],
    },
  },
  deal_signed: {
    label: 'Deal signed',
    sub: 'Status → Confirmed',
    phase: 'Negotiation',
    who: 'Admin',
    color: '#1db954',
    detail: {
      description: 'Both parties agree on terms. Deal signed date is recorded in the hub.',
      fields: ['Deal signed date', 'Campaign status (set to Confirmed)'],
      tips: ['Set status to Confirmed once the deal is locked — this makes the campaign visible on the calendar'],
    },
  },
  campaign_created: {
    label: 'Campaign created',
    sub: 'Hub entry + agency linked',
    phase: 'Setup',
    who: 'Admin',
    color: '#9b7fe8',
    detail: {
      description: 'Admin creates the campaign record in the hub. Name auto-generates from date, creator, and agency.',
      fields: ['Campaign name (auto: yyyymmdd-NN-Creator-Agency)', 'Creator', 'Agency / Label', 'Brand name', 'Contracted rate', 'Is rush + rush premium', 'Campaign start / end dates', 'Deal signed date', 'Admin notes', 'Campaign brief (Markdown)'],
      tips: ['Select Creator and Agency first — the name auto-generates', 'Paste the full brief from the brand into the brief field; it supports Markdown'],
    },
  },
  deliverables_defined: {
    label: 'Deliverables defined',
    sub: 'Platform, type, post date',
    phase: 'Setup',
    who: 'Admin',
    color: '#9b7fe8',
    detail: {
      description: 'Each deliverable is added to the campaign. If the campaign has multiple identical posts, use Quantity > 1 then Expand to create individual rows.',
      fields: ['Platform (TikTok, Instagram, etc.)', 'Deliverable type (Post, Story, Reel, etc.)', 'Contracted post date', 'Quantity', 'Draft status (starts at Not Started)'],
      tips: ['Use Expand to split a quantity-3 deliverable into 3 individual trackable rows', 'Post dates drive the calendar view and deadline alerts'],
    },
  },
  brief_shared: {
    label: 'Brief shared',
    sub: 'Creator sees campaign',
    phase: 'Setup',
    who: 'Admin',
    color: '#9b7fe8',
    detail: {
      description: 'Once the campaign is created and active, the creator can see it in their dashboard under My Campaigns.',
      fields: ['Campaign status (set to Active to make visible)', 'Brief field — creator reads this in their portal'],
      tips: ['Set status to Active when you\'re ready for the creator to start working', 'The creator cannot edit campaign details — they can only submit drafts and link videos'],
    },
  },
  status_active: {
    label: 'Status → Active',
    sub: 'Campaign goes live',
    phase: 'Setup',
    who: 'Admin',
    color: '#1db954',
    detail: {
      description: 'Campaign status is set to Active. Creator can now see the campaign, submit drafts, and link posted videos.',
      fields: ['Campaign status → Active'],
      tips: ['Active campaigns appear in the creator\'s My Overview as needing attention if deliverables are Not Started'],
    },
  },
  content_created: {
    label: 'Creator makes content',
    sub: 'Records draft video',
    phase: 'Delivery',
    who: 'Creator',
    color: '#e0603a',
    detail: {
      description: 'Creator produces the video or content asset according to the brief.',
      fields: [],
      tips: ['Creator should reference the brief in their My Campaigns panel before starting'],
    },
  },
  draft_submitted: {
    label: 'Draft submitted',
    sub: 'Status → Draft submitted',
    phase: 'Delivery',
    who: 'Creator',
    color: '#e0603a',
    detail: {
      description: 'Creator submits the draft for admin review via their portal. A revision round record is created.',
      fields: ['Draft link or file (submitted by creator)', 'Draft status → Draft Submitted', 'Revision round notes'],
      tips: ['Creator submits from My Campaigns → campaign detail → Submit Draft', 'Admin receives the submission and reviews before approving or requesting changes'],
    },
  },
  revisions: {
    label: 'Revisions requested',
    sub: 'Loop back to draft',
    phase: 'Delivery',
    who: 'Admin',
    color: '#d4a017',
    detail: {
      description: 'Admin requests changes. Draft status is set to Revisions Requested. Creator is notified via their overview and campaigns view.',
      fields: ['Draft status → Revisions Requested', 'Revision notes (visible to creator)'],
      tips: ['Each revision round is tracked with a timestamp — useful for dispute resolution', 'Creator\'s overview shows a "Needs Attention" alert for any deliverable in revision'],
    },
  },
  approved: {
    label: 'Draft approved',
    sub: 'Status → Approved',
    phase: 'Delivery',
    who: 'Admin',
    color: '#1db954',
    detail: {
      description: 'Admin approves the draft. Creator can now post the content to their social channel.',
      fields: ['Draft status → Approved'],
      tips: ['Approval signals to the creator that they are clear to post — make sure the brief requirements are fully met before approving'],
    },
  },
  posted: {
    label: 'Content posted',
    sub: 'Creator links live video',
    phase: 'Delivery',
    who: 'Creator',
    color: '#e0603a',
    detail: {
      description: 'Creator posts the content and links the live URL in the hub. The video is matched to TikTok analytics via the video picker.',
      fields: ['Post URL (linked by creator)', 'Actual post date (auto-set)', 'Draft status → Posted'],
      tips: ['Creator links the video from My Campaigns → Link Video', 'TikTok analytics for the post will appear in the Analytics view once synced via Coupler.io'],
    },
  },
  all_delivered: {
    label: 'All deliverables posted?',
    sub: 'Check all posted',
    phase: 'Delivery',
    who: 'Admin',
    color: '#888888',
    detail: {
      description: 'Once all deliverables have draft status of Posted, the creator can mark the campaign complete from their portal.',
      fields: ['All campaign_deliverables.draft_status = Posted'],
      tips: ['The Mark Complete button only appears when every deliverable is Posted', 'Admin can also mark it complete from the campaign detail panel'],
    },
  },
  campaign_complete: {
    label: 'Campaign complete',
    sub: 'Status → Completed',
    phase: 'Invoicing',
    who: 'Admin',
    color: '#1db954',
    detail: {
      description: 'Campaign status is set to Completed. This triggers the invoicing phase.',
      fields: ['Campaign status → Completed'],
      tips: ['Completed campaigns still appear in Payments view for invoicing and payout tracking'],
    },
  },
  invoice_sent: {
    label: 'Invoice sent',
    sub: 'Agency billed',
    phase: 'Invoicing',
    who: 'Admin',
    color: '#9b7fe8',
    detail: {
      description: 'Admin records the invoice sent to the agency or brand. The hub tracks invoice status.',
      fields: ['Invoice number', 'Invoice date', 'Invoice amount', 'Payment status → Invoiced', 'Payment method'],
      tips: ['Access from Payments → click campaign → Invoice tab', 'Invoice amount defaults to contracted rate but can differ'],
    },
  },
  agency_pays: {
    label: 'Agency pays Patrick',
    sub: 'Invoice amount received',
    phase: 'Settlement',
    who: 'Admin',
    color: '#9b7fe8',
    detail: {
      description: 'Agency transfers payment. Admin records the receipt and marks money as cleared.',
      fields: ['Payment status → Paid', 'Paid date', 'Amount received (may differ from invoice if fees deducted)', 'Payment method'],
      tips: ['Record the exact amount received — any difference from the invoice amount is the processing fee'],
    },
  },
  overdue: {
    label: 'Payment overdue?',
    sub: 'Chase if needed',
    phase: 'Settlement',
    who: 'Admin',
    color: '#d4a017',
    detail: {
      description: 'If payment hasn\'t arrived by the expected date, status can be set to Overdue. Chase the agency externally.',
      fields: ['Payment status → Overdue'],
      tips: ['Use the Admin Notes field on the campaign to log chase activity', 'Overdue campaigns appear in the admin overview under Agency Payments Pending'],
    },
  },
  money_cleared: {
    label: 'Money cleared',
    sub: 'Receipt uploaded',
    phase: 'Settlement',
    who: 'Admin',
    color: '#1db954',
    detail: {
      description: 'Admin confirms money has cleared their account and uploads the payment receipt.',
      fields: ['Money has cleared my account ✓', 'Date cleared', 'Amount received', 'Processing fee', 'Receipt (PDF/JPG) upload'],
      tips: ['Checking "Money cleared" unlocks the Payout tab for this campaign', 'Processing fee = difference between invoice amount and amount received (e.g. PayPal fee)'],
    },
  },
  fee_deducted: {
    label: 'Fee deducted',
    sub: 'PayPal / wire fee noted',
    phase: 'Settlement',
    who: 'Admin',
    color: '#d4a017',
    detail: {
      description: 'Any payment processing fee is recorded. This affects the "You Received" net amount shown in the financial summary.',
      fields: ['Processing fee (numeric, e.g. $14.95)', 'You received = amount received − processing fee'],
      tips: ['The fee is tracked for tax purposes and appears in the Fees column on the overview financial table'],
    },
  },
  payout_created: {
    label: 'Payout created',
    sub: 'Amount + destinations set',
    phase: 'Creator Payout',
    who: 'Admin',
    color: '#e0603a',
    detail: {
      description: 'Admin creates the payout record for the creator, specifying the total payout amount.',
      fields: ['Payout amount', 'Payout status → Pending', 'Payout date (planned)', 'Payout notes'],
      tips: ['Access from Payments → click campaign → Payout tab', 'Payout amount is typically the contracted rate or amount received minus any agreed management fee'],
    },
  },
  splits: {
    label: 'Destination splits',
    sub: '% to bank / UTMA',
    phase: 'Creator Payout',
    who: 'Admin',
    color: '#e0603a',
    detail: {
      description: 'The payout is split across the creator\'s registered payment destinations by percentage. Each split is tracked individually.',
      fields: ['Destination (from Payment Destinations setup)', 'Percentage', 'Dollar amount (auto-calculated from %)', 'Split status → Pending'],
      tips: ['Set up payment destinations first in Setup → Payment Destinations', 'Percentages must total 100% before saving', 'Use "Other" destination type for non-standard payouts like iPhone purchases — the notes field shows in place of account type'],
    },
  },
  transfers_sent: {
    label: 'Transfers sent',
    sub: 'Status → Sent',
    phase: 'Creator Payout',
    who: 'Admin',
    color: '#e0603a',
    detail: {
      description: 'Admin initiates the bank transfers and records sent dates and reference/transaction IDs.',
      fields: ['Split status → Sent', 'Sent date', 'Reference / transaction ID'],
      tips: ['Record the bank reference number for each split — useful if a transfer is disputed or lost'],
    },
  },
  transfers_cleared: {
    label: 'Transfers cleared',
    sub: 'Status → Cleared',
    phase: 'Creator Payout',
    who: 'Admin',
    color: '#1db954',
    detail: {
      description: 'Admin confirms each transfer has cleared in the destination account.',
      fields: ['Split status → Cleared', 'Cleared date'],
      tips: ['Creator can see split status in their My Payments view — updating to Cleared lets them confirm receipt'],
    },
  },
  settlement_complete: {
    label: 'Settlement complete',
    sub: 'Payout status → Paid',
    phase: 'Creator Payout',
    who: 'Admin',
    color: '#1db954',
    detail: {
      description: 'All splits cleared. Payout status is set to Paid. The campaign is fully settled.',
      fields: ['Payout status → Paid', 'Payout date (actual)'],
      tips: ['Once payout is Paid, the campaign appears in the creator\'s "Paid to Me" total on their overview'],
    },
  },
  record_closed: {
    label: 'Campaign record closed',
    sub: '',
    phase: 'Done',
    who: 'System',
    color: '#555555',
    detail: {
      description: 'The campaign is fully complete. All financial records are settled, analytics are linked, and the record is archived.',
      fields: [],
      tips: ['Completed campaigns remain searchable and filterable in the Campaigns view', 'Analytics for posted videos continue to accumulate via Coupler.io sync'],
    },
  },
};

const WHO_COLOR = {
  Admin: '#9b7fe8',
  Creator: '#e0603a',
  System: '#555555',
};

function Tooltip({ step, x, y, side = 'right' }) {
  const d = step.detail;
  const left = side === 'right' ? x : 'auto';
  const right = side === 'left' ? `calc(100% - ${x}px)` : 'auto';
  return (
    <div style={{
      position: 'absolute',
      top: y,
      left: side === 'right' ? x : 'auto',
      right: side === 'left' ? `calc(100% - ${x}px)` : 'auto',
      width: 280,
      background: '#1a1a1a',
      border: `1px solid ${step.color}44`,
      borderLeft: `3px solid ${step.color}`,
      borderRadius: 8,
      padding: '14px 16px',
      zIndex: 100,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: step.color, marginBottom: 6 }}>
        {step.phase} · {step.who}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e8e8', marginBottom: 8, lineHeight: 1.4 }}>
        {step.label}
      </div>
      <div style={{ fontSize: 11, color: '#888', lineHeight: 1.6, marginBottom: d.fields.length > 0 ? 10 : 0 }}>
        {step.detail.description}
      </div>
      {d.fields.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#555', marginBottom: 5 }}>Fields to fill</div>
          <ul style={{ margin: 0, padding: '0 0 0 14px', listStyle: 'disc' }}>
            {d.fields.map((f, i) => (
              <li key={i} style={{ fontSize: 11, color: '#aaa', lineHeight: 1.7 }}>{f}</li>
            ))}
          </ul>
        </>
      )}
      {d.tips.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#555', marginBottom: 5 }}>Tips</div>
          {d.tips.map((t, i) => (
            <div key={i} style={{ fontSize: 11, color: '#777', lineHeight: 1.6, marginBottom: 4 }}>◦ {t}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Node({ id, label, sub, color, x, y, w = 170, h = 50, onHover, hovered }) {
  const isHovered = hovered === id;
  return (
    <g
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
    >
      <rect
        x={x} y={y} width={w} height={h} rx={7}
        fill={isHovered ? `${color}22` : `${color}11`}
        stroke={color}
        strokeWidth={isHovered ? 1.5 : 0.5}
        style={{ transition: 'all 0.15s ease' }}
      />
      {sub ? (
        <>
          <text x={x + w / 2} y={y + 18} textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 12, fontWeight: 500, fill: isHovered ? '#fff' : '#e8e8e8', fontFamily: 'DM Sans, sans-serif', transition: 'fill 0.15s' }}>
            {label}
          </text>
          <text x={x + w / 2} y={y + 34} textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 10, fill: '#888', fontFamily: 'DM Sans, sans-serif' }}>
            {sub}
          </text>
        </>
      ) : (
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: 12, fontWeight: 500, fill: isHovered ? '#fff' : '#e8e8e8', fontFamily: 'DM Sans, sans-serif', transition: 'fill 0.15s' }}>
          {label}
        </text>
      )}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, dashed }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  const ex = x2 - ux * 8, ey = y2 - uy * 8;
  const angle = Math.atan2(uy, ux) * 180 / Math.PI;
  return (
    <g>
      <line x1={x1} y1={y1} x2={ex} y2={ey}
        stroke="#444" strokeWidth={0.8}
        strokeDasharray={dashed ? '4 3' : undefined} />
      <polygon
        points={`${x2},${y2} ${x2 - 8 * ux + 4 * uy},${y2 - 8 * uy - 4 * ux} ${x2 - 8 * ux - 4 * uy},${y2 - 8 * uy + 4 * ux}`}
        fill="#444" />
    </g>
  );
}

function ElbowArrow({ points, dashed }) {
  const pts = points;
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const dx = last[0] - prev[0], dy = last[1] - prev[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  const ex = last[0] - ux * 8, ey = last[1] - uy * 8;
  return (
    <g>
      <path d={d} fill="none" stroke="#444" strokeWidth={0.8} strokeDasharray={dashed ? '4 3' : undefined} />
      <polygon
        points={`${last[0]},${last[1]} ${ex + 4 * uy},${ey - 4 * ux} ${ex - 4 * uy},${ey + 4 * ux}`}
        fill="#444" />
    </g>
  );
}

function PhaseLabel({ label, y1, y2, x = 22 }) {
  const mid = (y1 + y2) / 2;
  return (
    <>
      <line x1={x + 8} y1={y1} x2={x + 8} y2={y2} stroke="#2a2a2a" strokeWidth={1} />
      <text
        x={x + 4} y={mid} textAnchor="middle" dominantBaseline="central"
        transform={`rotate(-90, ${x + 4}, ${mid})`}
        style={{ fontSize: 9, fill: '#444', fontFamily: 'DM Sans, sans-serif', letterSpacing: 2, textTransform: 'uppercase' }}>
        {label}
      </text>
    </>
  );
}

export default function CampaignFlowView() {
  const [hovered, setHovered] = useState(null);

  const hoveredStep = hovered ? STEPS[hovered] : null;

  // Layout constants — left col x=42, right col x=260, SVG width=520
  const L = 42, R = 230, W = 170, H = 50;
  const gap = 22;
  const rowH = H + gap;

  // Row y positions
  const rows = {
    inquiry:          0,
    negotiation:      0,
    deal_signed:      0,
    campaign_created: 1,
    deliverables:     2,
    brief_shared:     3,
    status_active:    3,
    content_created:  4,
    draft_submitted:  5,
    revisions:        5,
    approved:         6,
    posted:           7,
    all_delivered:    7,
    campaign_complete:8,
    invoice_sent:     8,
    agency_pays:      9,
    overdue:          9,
    money_cleared:    10,
    fee_deducted:     10,
    payout_created:   11,
    splits:           11,
    transfers_sent:   12,
    transfers_cleared:13,
    settlement_complete:13,
    record_closed:    14,
  };

  const ry = (row) => 80 + row * rowH;
  const svgH = ry(15) + 20;

  // Tooltip positioning: show to the right of SVG at fixed offset from hovered node
  function getTooltipPos(id) {
    if (!id) return {};
    const col = ['negotiation', 'deal_signed', 'status_active', 'revisions', 'all_delivered',
      'invoice_sent', 'overdue', 'fee_deducted', 'splits', 'settlement_complete'].includes(id) ? R : L;
    const rowKey = Object.keys(rows).find(k => k === id.replace('_created', id.includes('campaign_created') ? '_created' : '') );
    const row = rows[id] ?? 0;
    return { top: ry(row) - 10, left: col === R ? 430 : 430 };
  }

  const s = STEPS;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">CAMPAIGN FLOW</div>
          <div className="page-subtitle">End-to-end process — hover any step for field details</div>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {[['Admin', '#9b7fe8'], ['Creator', '#e0603a'], ['Milestone', '#1db954'], ['Decision', '#d4a017']].map(([lbl, col]) => (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: col, opacity: 0.7 }} />
              <span style={{ fontSize: 11, color: '#888' }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 520 ${svgH}`} style={{ display: 'block' }}>
          {/* Phase labels */}
          <PhaseLabel label="Negotiation" y1={ry(0) - 10} y2={ry(0) + H + 10} />
          <PhaseLabel label="Setup"       y1={ry(1) - 10} y2={ry(3) + H + 10} />
          <PhaseLabel label="Delivery"    y1={ry(4) - 10} y2={ry(7) + H + 10} />
          <PhaseLabel label="Invoicing"   y1={ry(8) - 10} y2={ry(8) + H + 10} />
          <PhaseLabel label="Settlement"  y1={ry(9) - 10} y2={ry(10) + H + 10} />
          <PhaseLabel label="Payout"      y1={ry(11) - 10} y2={ry(14) + H + 10} />

          {/* ── NEGOTIATION ── */}
          <Node id="inquiry"     label={s.inquiry.label}     sub={s.inquiry.sub}     color={s.inquiry.color}     x={L}  y={ry(0)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W} y1={ry(0)+H/2} x2={R} y2={ry(0)+H/2} />
          <Node id="negotiation" label={s.negotiation.label} sub={s.negotiation.sub} color={s.negotiation.color} x={R}  y={ry(0)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <ElbowArrow points={[[R+W, ry(0)+H/2],[420, ry(0)+H/2],[420, ry(0)-20],[L+W/2, ry(0)-20],[L+W/2, ry(0)]]} />
          {/* deal signed — below left */}
          <Arrow x1={L+W/2} y1={ry(0)+H} x2={L+W/2} y2={ry(0)+H+gap-2} />
          <Node id="deal_signed" label={s.deal_signed.label} sub={s.deal_signed.sub} color={s.deal_signed.color} x={L} y={ry(0)+H+gap} w={W} h={H} onHover={setHovered} hovered={hovered} />

          {/* ── SETUP ── */}
          <Arrow x1={L+W/2} y1={ry(0)+H+gap+H} x2={L+W/2} y2={ry(1)-2} />
          <Node id="campaign_created"   label={s.campaign_created.label}   sub={s.campaign_created.sub}   color={s.campaign_created.color}   x={L} y={ry(1)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W/2} y1={ry(1)+H} x2={L+W/2} y2={ry(2)-2} />
          <Node id="deliverables_defined" label={s.deliverables_defined.label} sub={s.deliverables_defined.sub} color={s.deliverables_defined.color} x={L} y={ry(2)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W/2} y1={ry(2)+H} x2={L+W/2} y2={ry(3)-2} />
          <Node id="brief_shared" label={s.brief_shared.label} sub={s.brief_shared.sub} color={s.brief_shared.color} x={L} y={ry(3)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W} y1={ry(3)+H/2} x2={R} y2={ry(3)+H/2} />
          <Node id="status_active" label={s.status_active.label} sub={s.status_active.sub} color={s.status_active.color} x={R} y={ry(3)} w={W} h={H} onHover={setHovered} hovered={hovered} />

          {/* ── DELIVERY ── */}
          <ElbowArrow points={[[R+W/2, ry(3)+H],[R+W/2, ry(3)+H+gap/2],[L+W/2, ry(3)+H+gap/2],[L+W/2, ry(4)]]} />
          <Node id="content_created" label={s.content_created.label} sub={s.content_created.sub} color={s.content_created.color} x={L} y={ry(4)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W/2} y1={ry(4)+H} x2={L+W/2} y2={ry(5)-2} />
          <Node id="draft_submitted" label={s.draft_submitted.label} sub={s.draft_submitted.sub} color={s.draft_submitted.color} x={L} y={ry(5)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W} y1={ry(5)+H/2} x2={R} y2={ry(5)+H/2} />
          <Node id="revisions" label={s.revisions.label} sub={s.revisions.sub} color={s.revisions.color} x={R} y={ry(5)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          {/* revisions loop */}
          <ElbowArrow points={[[R+W/2, ry(5)],[R+W/2, ry(4)+H/2],[L+W, ry(4)+H/2]]} dashed />
          {/* approved — revisions → down */}
          <ElbowArrow points={[[R+W/2, ry(5)+H],[R+W/2, ry(5)+H+gap/2],[L+W/2, ry(5)+H+gap/2],[L+W/2, ry(6)]]} />
          <Node id="approved" label={s.approved.label} sub={s.approved.sub} color={s.approved.color} x={L} y={ry(6)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W/2} y1={ry(6)+H} x2={L+W/2} y2={ry(7)-2} />
          <Node id="posted" label={s.posted.label} sub={s.posted.sub} color={s.posted.color} x={L} y={ry(7)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W} y1={ry(7)+H/2} x2={R} y2={ry(7)+H/2} />
          <Node id="all_delivered" label={s.all_delivered.label} sub={s.all_delivered.sub} color={s.all_delivered.color} x={R} y={ry(7)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          {/* No loop */}
          <ElbowArrow points={[[R+W, ry(7)+H/2],[420, ry(7)+H/2],[420, ry(5)+H/2],[R+W, ry(5)+H/2]]} dashed />
          <text x={425} y={ry(6)+4} style={{ fontSize: 9, fill: '#555', fontFamily: 'DM Sans, sans-serif' }}>No</text>

          {/* ── INVOICING ── */}
          <ElbowArrow points={[[R+W/2, ry(7)+H],[R+W/2, ry(7)+H+gap/2],[L+W/2, ry(7)+H+gap/2],[L+W/2, ry(8)]]} />
          <text x={L+W/2+6} y={ry(7)+H+gap/2+3} style={{ fontSize: 9, fill: '#555', fontFamily: 'DM Sans, sans-serif' }}>Yes</text>
          <Node id="campaign_complete" label={s.campaign_complete.label} sub={s.campaign_complete.sub} color={s.campaign_complete.color} x={L} y={ry(8)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W} y1={ry(8)+H/2} x2={R} y2={ry(8)+H/2} />
          <Node id="invoice_sent" label={s.invoice_sent.label} sub={s.invoice_sent.sub} color={s.invoice_sent.color} x={R} y={ry(8)} w={W} h={H} onHover={setHovered} hovered={hovered} />

          {/* ── SETTLEMENT ── */}
          <ElbowArrow points={[[R+W/2, ry(8)+H],[R+W/2, ry(8)+H+gap/2],[L+W/2, ry(8)+H+gap/2],[L+W/2, ry(9)]]} />
          <Node id="agency_pays" label={s.agency_pays.label} sub={s.agency_pays.sub} color={s.agency_pays.color} x={L} y={ry(9)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W} y1={ry(9)+H/2} x2={R} y2={ry(9)+H/2} />
          <Node id="overdue" label={s.overdue.label} sub={s.overdue.sub} color={s.overdue.color} x={R} y={ry(9)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          {/* overdue loop */}
          <ElbowArrow points={[[R+W/2, ry(9)],[R+W/2, ry(8)+H+gap/2],[L+W/2, ry(8)+H+gap/2]]} dashed />
          <text x={R+W+4} y={ry(9)-4} style={{ fontSize: 9, fill: '#555', fontFamily: 'DM Sans, sans-serif' }}>Chase</text>
          <Arrow x1={L+W/2} y1={ry(9)+H} x2={L+W/2} y2={ry(10)-2} />
          <Node id="money_cleared" label={s.money_cleared.label} sub={s.money_cleared.sub} color={s.money_cleared.color} x={L} y={ry(10)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W} y1={ry(10)+H/2} x2={R} y2={ry(10)+H/2} />
          <Node id="fee_deducted" label={s.fee_deducted.label} sub={s.fee_deducted.sub} color={s.fee_deducted.color} x={R} y={ry(10)} w={W} h={H} onHover={setHovered} hovered={hovered} />

          {/* ── PAYOUT ── */}
          <ElbowArrow points={[[L+W/2, ry(10)+H],[L+W/2, ry(10)+H+gap/2],[R+W/2, ry(10)+H+gap/2],[R+W/2, ry(10)+H]]} />
          <ElbowArrow points={[[L+W/2, ry(10)+H+gap/2],[L+W/2, ry(11)]]} />
          <Node id="payout_created" label={s.payout_created.label} sub={s.payout_created.sub} color={s.payout_created.color} x={L} y={ry(11)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W} y1={ry(11)+H/2} x2={R} y2={ry(11)+H/2} />
          <Node id="splits" label={s.splits.label} sub={s.splits.sub} color={s.splits.color} x={R} y={ry(11)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <ElbowArrow points={[[L+W/2, ry(11)+H],[L+W/2, ry(12)]]} />
          <ElbowArrow points={[[R+W/2, ry(11)+H],[R+W/2, ry(11)+H+gap/2],[L+W/2, ry(11)+H+gap/2]]} />
          <Node id="transfers_sent" label={s.transfers_sent.label} sub={s.transfers_sent.sub} color={s.transfers_sent.color} x={L} y={ry(12)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W/2} y1={ry(12)+H} x2={L+W/2} y2={ry(13)-2} />
          <Node id="transfers_cleared" label={s.transfers_cleared.label} sub={s.transfers_cleared.sub} color={s.transfers_cleared.color} x={L} y={ry(13)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <Arrow x1={L+W} y1={ry(13)+H/2} x2={R} y2={ry(13)+H/2} />
          <Node id="settlement_complete" label={s.settlement_complete.label} sub={s.settlement_complete.sub} color={s.settlement_complete.color} x={R} y={ry(13)} w={W} h={H} onHover={setHovered} hovered={hovered} />
          <ElbowArrow points={[[L+W/2, ry(13)+H],[L+W/2, ry(13)+H+gap/2],[R+W/2, ry(13)+H+gap/2],[R+W/2, ry(13)+H+gap/2],[R+W/2, ry(13)+H]]} />
          <ElbowArrow points={[[L+W/2, ry(13)+H+gap/2],[L+W/2+W/2-15, ry(13)+H+gap/2],[L+W/2+W/2-15, ry(14)]]} />
          <Node id="record_closed" label={s.record_closed.label} sub="" color={s.record_closed.color} x={L+10} y={ry(14)} w={W+20} h={40} onHover={setHovered} hovered={hovered} />
        </svg>

        {/* Tooltip overlay */}
        {hoveredStep && (() => {
          const col = ['negotiation','deal_signed','status_active','revisions','all_delivered',
            'invoice_sent','overdue','fee_deducted','splits','settlement_complete'].includes(hovered) ? R : L;
          const row = rows[hovered] ?? 0;
          const tooltipTop = ry(row);
          return (
            <div style={{ position: 'absolute', top: tooltipTop, left: 430, width: 280, zIndex: 100, pointerEvents: 'none' }}>
              <Tooltip step={hoveredStep} x={0} y={0} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
