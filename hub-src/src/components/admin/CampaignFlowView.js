import React, { useState } from 'react';

// ── Color definitions using app CSS vars ──────────────────────────────────────
const C = {
  admin:     { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: '#a78bfa' },
  creator:   { color: '#ff8c42', bg: 'rgba(255,140,66,0.15)',  border: '#ff8c42' },
  milestone: { color: '#3ddc84', bg: 'rgba(61,220,132,0.15)',  border: '#3ddc84' },
  decision:  { color: '#4a9eff', bg: 'rgba(74,158,255,0.15)',  border: '#4a9eff' },
};

// ── Flow layout ───────────────────────────────────────────────────────────────
// Each row has: phase, left node (col A), right node (col B, optional), connector type
// connector: 'down' | 'right' | 'loop-right' | 'loop-left' | 'none'

const ROWS = [
  // Phase label  | Left node          | Right node        | A→? | B→?
  { phase: 'Negotiation', divider: true },
  {
    a: { id: 'inquiry', label: 'Inbound inquiry', sub: 'Brand or agency contact', who: 'admin' },
    b: { id: 'negotiation', label: 'Rate negotiation', sub: 'Contracted rate agreed', who: 'admin' },
    ab: 'right',   // A →  B
    aNext: false,  // A goes down?
    bNext: true,   // B goes down to next row?
  },
  {
    a: { id: 'deal_signed', label: 'Deal signed', sub: 'Status → Confirmed', who: 'milestone' },
    b: null,
    ab: null,
    aNext: true,
    bNext: false,
    aFrom: 'b-prev', // line comes from right col above
  },
  { phase: 'Setup', divider: true },
  {
    a: { id: 'campaign_created', label: 'Campaign created', sub: 'Hub entry + agency linked', who: 'admin' },
    b: null, ab: null, aNext: true, bNext: false,
  },
  {
    a: { id: 'deliverables', label: 'Deliverables defined', sub: 'Platform, type, post date', who: 'admin' },
    b: null, ab: null, aNext: true, bNext: false,
  },
  {
    a: { id: 'brief_shared', label: 'Brief shared', sub: 'Creator sees campaign', who: 'admin' },
    b: { id: 'status_active', label: 'Status → Active', sub: 'Campaign live', who: 'milestone' },
    ab: 'right', aNext: false, bNext: true,
  },
  { phase: 'Delivery', divider: true },
  {
    a: { id: 'content_made', label: 'Creator makes content', sub: 'Draft video recorded', who: 'creator' },
    b: null, ab: null, aNext: true, bNext: false,
    aFrom: 'b-prev',
  },
  {
    a: { id: 'draft_submitted', label: 'Draft submitted', sub: 'Status → Draft Submitted', who: 'creator' },
    b: { id: 'revisions', label: 'Revisions requested', sub: '↩ Loop back to draft', who: 'decision' },
    ab: 'right', aNext: true, bNext: false,
  },
  {
    a: { id: 'approved', label: 'Draft approved', sub: 'Status → Approved', who: 'milestone' },
    b: null, ab: null, aNext: true, bNext: false,
  },
  {
    a: { id: 'posted', label: 'Content posted', sub: 'Creator links live video', who: 'creator' },
    b: null, ab: null, aNext: true, bNext: false,
  },
  {
    a: { id: 'all_posted', label: 'All deliverables posted', sub: 'Campaign → Completed', who: 'milestone' },
    b: null, ab: null, aNext: true, bNext: false,
  },
  { phase: 'Invoicing', divider: true },
  {
    a: { id: 'invoice_sent', label: 'Invoice sent to agency', sub: 'Invoice amount recorded', who: 'admin' },
    b: null, ab: null, aNext: true, bNext: false,
  },
  { phase: 'Settlement', divider: true },
  {
    a: { id: 'agency_pays', label: 'Agency pays Patrick', sub: 'Receipt uploaded + cleared', who: 'admin' },
    b: { id: 'overdue', label: 'Overdue?', sub: '↩ Chase, then re-check', who: 'decision' },
    ab: 'right', aNext: true, bNext: false,
  },
  {
    a: { id: 'fee_noted', label: 'Processing fee noted', sub: 'PayPal / wire fee recorded', who: 'admin' },
    b: null, ab: null, aNext: true, bNext: false,
  },
  { phase: 'Creator Payout', divider: true },
  {
    a: { id: 'payout_created', label: 'Payout created', sub: 'Amount + destination splits', who: 'admin' },
    b: null, ab: null, aNext: true, bNext: false,
  },
  {
    a: { id: 'transfers_sent', label: 'Transfers sent', sub: 'Reference IDs recorded', who: 'admin' },
    b: null, ab: null, aNext: true, bNext: false,
  },
  {
    a: { id: 'cleared', label: 'Settlement complete', sub: 'Payout status → Paid', who: 'milestone' },
    b: null, ab: null, aNext: false, bNext: false,
  },
];

// ── Detail content ────────────────────────────────────────────────────────────
const DETAIL = {
  inquiry:          { desc: 'Brand, agency, or label reaches out. Initial contact happens outside the hub via email or DM.', fields: [], tips: ['Log the inquiry source so you can track which channels drive deals', 'Clarify creator, deliverable count, and rough budget before negotiating'] },
  negotiation:      { desc: 'Negotiate rate, deliverable scope, and timeline with the brand. No hub entry yet.', fields: ['Contracted rate', 'Number of deliverables', 'Post dates', 'Rush premium (if applicable)'], tips: ['Lock the contracted rate before creating the campaign — it drives all downstream financial calculations'] },
  deal_signed:      { desc: 'Both parties agree on terms. Deal signed date is recorded in the hub.', fields: ['Deal signed date', 'Campaign status → Confirmed'], tips: ['Set status to Confirmed once locked — campaign becomes visible on the calendar'] },
  campaign_created: { desc: 'Admin creates the campaign record. Name auto-generates from date, creator, and agency.', fields: ['Campaign name (auto: yyyymmdd-NN-Creator-Agency)', 'Creator', 'Agency / Label', 'Brand name', 'Contracted rate', 'Is rush + rush premium', 'Campaign start / end dates', 'Deal signed date', 'Campaign brief (Markdown)'], tips: ['Select Creator and Agency first — the name auto-generates', 'Paste the full brief into the brief field; it supports Markdown'] },
  deliverables:     { desc: 'Each deliverable is added to the campaign. Use Quantity then Expand to create individual trackable rows.', fields: ['Platform (TikTok, Instagram, etc.)', 'Deliverable type (Post, Story, Reel, etc.)', 'Contracted post date', 'Quantity'], tips: ['Expand splits a quantity-3 deliverable into 3 individual rows', 'Post dates drive the calendar and deadline alerts'] },
  brief_shared:     { desc: 'Brief field is visible to the creator in their My Campaigns view once the campaign is Active.', fields: ['Campaign brief field (Markdown)', 'Admin notes'], tips: [] },
  status_active:    { desc: 'Campaign status set to Active. Creator can now see it in My Campaigns and submit drafts.', fields: ['Campaign status → Active'], tips: ['Active campaigns show as "Needs Attention" on the creator overview when deliverables are Not Started'] },
  content_made:     { desc: 'Creator produces the video or content asset per the brief. No hub action required yet.', fields: [], tips: ['Creator should reference the brief in My Campaigns before starting'] },
  draft_submitted:  { desc: 'Creator submits the draft via their portal. A revision round record is created automatically.', fields: ['Draft status → Draft Submitted', 'Revision round notes (optional)'], tips: ['Creator submits from My Campaigns → campaign detail → Submit Draft'] },
  revisions:        { desc: 'Admin requests changes. Draft status set to Revisions Requested. Creator is notified via their overview.', fields: ['Draft status → Revisions Requested', 'Revision notes (visible to creator)'], tips: ['Each revision round is timestamped — useful for dispute resolution', 'Creator overview shows "Needs Attention" for deliverables in revision'] },
  approved:         { desc: 'Admin approves the draft. Creator is now clear to post the content to their channel.', fields: ['Draft status → Approved'], tips: ['Verify all brief requirements are fully met before approving'] },
  posted:           { desc: 'Creator posts the content and links the live URL in the hub via the video picker.', fields: ['Post URL (linked by creator)', 'Actual post date (auto-set)', 'Draft status → Posted'], tips: ['TikTok analytics for the post appear in Analytics once synced via Coupler.io'] },
  all_posted:       { desc: 'Once all deliverables are Posted, the Mark Complete button appears.', fields: ['All campaign_deliverables.draft_status = Posted', 'Campaign status → Completed'], tips: ['Admin can also mark complete from the campaign detail panel'] },
  invoice_sent:     { desc: 'Admin records the invoice sent to the agency. Hub tracks invoice status from here.', fields: ['Invoice number', 'Invoice date', 'Invoice amount', 'Payment status → Invoiced', 'Payment method'], tips: ['Access from Payments → click campaign row → Invoice tab', 'Invoice amount defaults to contracted rate but can differ'] },
  agency_pays:      { desc: 'Agency transfers payment. Admin records receipt details and marks money as cleared.', fields: ['Payment status → Paid', 'Paid date', 'Amount received', 'Money cleared ✓', 'Date cleared', 'Receipt upload (PDF/JPG)'], tips: ['Checking "Money cleared" unlocks the Payout tab for this campaign'] },
  overdue:          { desc: 'If payment hasn\'t arrived by the expected date, mark Overdue and chase the agency externally.', fields: ['Payment status → Overdue'], tips: ['Use Admin Notes on the campaign to log chase activity', 'Overdue campaigns appear in the admin overview under Agency Payments Pending'] },
  fee_noted:        { desc: 'Any payment processing fee is recorded against the invoice. This affects "You Received" net.', fields: ['Processing fee (e.g. $14.95)', 'You received = amount received − processing fee'], tips: ['The fee is tracked for tax purposes and appears in the Fees column on the overview financial table'] },
  payout_created:   { desc: 'Admin creates the payout record and configures destination splits by percentage.', fields: ['Payout amount', 'Payout status → Pending', 'Destination (bank / UTMA / other)', 'Percentage per destination', 'Payout notes'], tips: ['Set up Payment Destinations first in Setup → Payment Destinations', 'Percentages must total 100%', '"Other" destination type shows notes field in place of account type'] },
  transfers_sent:   { desc: 'Admin initiates the bank transfers and records sent dates and transaction IDs per split.', fields: ['Split status → Sent', 'Sent date', 'Reference / transaction ID'], tips: ['Record the bank reference number for each split — useful if a transfer is disputed or delayed'] },
  cleared:          { desc: 'Admin confirms each transfer cleared. Payout status set to Paid. Campaign fully settled.', fields: ['Split status → Cleared', 'Cleared date', 'Payout status → Paid'], tips: ['Creator sees split status in My Payments — Cleared lets them confirm receipt', 'Once Paid, the campaign appears in the creator\'s "Paid to Me" total on their overview'] },
};

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ id, who }) {
  const d = DETAIL[id];
  const c = C[who];
  if (!d) return null;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 'calc(100% + 12px)',
      width: 272, zIndex: 500,
      background: '#141414',
      border: `1px solid ${c.border}55`,
      borderLeft: `3px solid ${c.color}`,
      borderRadius: 8, padding: '13px 15px',
      boxShadow: '0 12px 36px rgba(0,0,0,0.8)',
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: c.color, marginBottom: 6 }}>
        {{ admin: 'Admin action', creator: 'Creator action', milestone: 'Milestone', decision: 'Decision' }[who]}
      </div>
      <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.65, marginBottom: d.fields.length ? 10 : 0 }}>{d.desc}</div>
      {d.fields.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#444', marginBottom: 5 }}>Fields to fill</div>
          <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
            {d.fields.map((f, i) => <li key={i} style={{ fontSize: 11, color: '#bbb', lineHeight: 1.7 }}>{f}</li>)}
          </ul>
        </>
      )}
      {d.tips.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #222' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#444', marginBottom: 5 }}>Tips</div>
          {d.tips.map((t, i) => <div key={i} style={{ fontSize: 11, color: '#666', lineHeight: 1.65, marginBottom: 3 }}>◦ {t}</div>)}
        </div>
      )}
    </div>
  );
}

// ── Node box ──────────────────────────────────────────────────────────────────
function Node({ node, active, onEnter, onLeave }) {
  const c = C[node.who];
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: 'relative',
        background: active ? c.bg : '#131313',
        border: `1.5px solid ${active ? c.color : '#2a2a2a'}`,
        borderRadius: 8,
        padding: '11px 16px',
        width: 220,
        cursor: 'default',
        transition: 'all 0.12s',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: active ? '#fff' : '#d0d0d0', lineHeight: 1.3, marginBottom: node.sub ? 3 : 0 }}>
        {node.label}
      </div>
      {node.sub && (
        <div style={{ fontSize: 10, color: active ? c.color : '#555', lineHeight: 1.4, transition: 'color 0.12s' }}>
          {node.sub}
        </div>
      )}
      {active && <Tooltip id={node.id} who={node.who} />}
    </div>
  );
}

// ── Connector: vertical arrow stub ────────────────────────────────────────────
const VArrow = ({ color = '#3a3a3a' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, height: 28, justifyContent: 'flex-end' }}>
    <div style={{ width: 1.5, flex: 1, background: color }} />
    <svg width="9" height="7" viewBox="0 0 9 7" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M4.5 7L0 0L9 0Z" fill={color} />
    </svg>
  </div>
);

// ── Horizontal connector: A→B ─────────────────────────────────────────────────
const HConnector = ({ color = '#3a3a3a' }) => (
  <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 8px', flexShrink: 0 }}>
    <div style={{ width: 24, height: 1.5, background: color }} />
    <svg width="7" height="9" viewBox="0 0 7 9" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M7 4.5L0 0L0 9Z" fill={color} />
    </svg>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CampaignFlowView() {
  const [active, setActive] = useState(null);

  // Build a flat list of renderable items
  // We track whether col A or col B of the previous row had the "outgoing" connector
  const CONN_COLOR = '#404040';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">CAMPAIGN FLOW</div>
          <div className="page-subtitle">Hover any step to see which fields to fill in the hub</div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {Object.entries({ admin: 'Admin', creator: 'Creator', milestone: 'Milestone', decision: 'Decision' }).map(([k, lbl]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: C[k].color }} />
              <span style={{ fontSize: 11, color: '#888' }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 40 }}>
        {/* Main flow */}
        <div style={{ flex: 1, maxWidth: 560 }}>
          {ROWS.map((row, ri) => {
            // Phase divider
            if (row.divider) {
              return (
                <div key={`phase-${ri}`} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 14px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#ff5c00', whiteSpace: 'nowrap' }}>{row.phase}</div>
                  <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
                </div>
              );
            }

            const { a, b, ab } = row;
            const aActive = active === a?.id;
            const bActive = active === b?.id;
            const aColor = a ? C[a.who].color : CONN_COLOR;
            const bColor = b ? C[b.who].color : CONN_COLOR;

            // Determine if we need a down-arrow stub above col A (coming from previous row)
            const prevRow = ROWS[ri - 1];
            const prevNodeRow = ROWS.slice(0, ri).reverse().find(r => !r.divider);
            const showAArrow = prevNodeRow && (prevNodeRow.aNext || prevNodeRow.bNext);
            const arrowColor = prevNodeRow ? (prevNodeRow.bNext ? (prevNodeRow.b ? C[prevNodeRow.b.who].color : CONN_COLOR) : (prevNodeRow.a ? C[prevNodeRow.a.who].color : CONN_COLOR)) : CONN_COLOR;

            return (
              <div key={`row-${ri}`}>
                {/* Arrow coming down into this row */}
                {showAArrow && (
                  <div style={{ marginLeft: prevNodeRow.bNext && !prevNodeRow.aNext ? 245 : 20 }}>
                    <VArrow color={arrowColor} />
                  </div>
                )}

                {/* The row of nodes */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {/* Col A */}
                  {a && (
                    <Node
                      node={a}
                      active={aActive}
                      onEnter={() => setActive(a.id)}
                      onLeave={() => setActive(null)}
                    />
                  )}

                  {/* A→B horizontal connector */}
                  {b && ab === 'right' && (
                    <HConnector color={aColor} />
                  )}

                  {/* Col B */}
                  {b && (
                    <Node
                      node={b}
                      active={bActive}
                      onEnter={() => setActive(b.id)}
                      onLeave={() => setActive(null)}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Final closed node */}
          <div style={{ marginLeft: 20, marginTop: 0 }}>
            <VArrow color={C.milestone.color} />
            <div style={{
              width: 220,
              background: '#0f0f0f',
              border: '1px solid #222',
              borderRadius: 8,
              padding: '10px 16px',
            }}>
              <div style={{ fontSize: 12, color: '#444', fontWeight: 500 }}>Campaign record closed</div>
              <div style={{ fontSize: 10, color: '#333' }}>Fully settled — archived</div>
            </div>
          </div>
        </div>

        {/* Quick reference legend */}
        <div style={{ width: 200, flexShrink: 0, paddingTop: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#444', marginBottom: 12 }}>Quick reference</div>
          {[
            { label: 'Status values', items: ['Not Started', 'Draft Submitted', 'Revisions Requested', 'Approved', 'Posted'] },
            { label: 'Invoice statuses', items: ['Not Invoiced', 'Invoiced', 'Pending', 'Paid', 'Overdue'] },
            { label: 'Payout statuses', items: ['Pending', 'Sent', 'Cleared', 'Paid'] },
          ].map(group => (
            <div key={group.label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>{group.label}</div>
              {group.items.map(item => (
                <div key={item} style={{ fontSize: 11, color: '#777', lineHeight: 1.8, paddingLeft: 8, borderLeft: '2px solid #222' }}>{item}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
