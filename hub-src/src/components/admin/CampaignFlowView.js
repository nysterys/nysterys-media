import React, { useState } from 'react';

const PHASES = [
  {
    label: 'Negotiation',
    steps: [
      { id: 'inquiry', label: 'Inbound inquiry', sub: 'Brand or agency contact', who: 'admin', right: false,
        detail: { desc: 'Brand, agency, or label reaches out. Initial contact happens outside the hub via email or DM.', fields: [], tips: ['Log the inquiry source so you can track which channels drive deals', 'Clarify creator, deliverable count, and rough budget before negotiating'] } },
      { id: 'negotiation', label: 'Rate negotiation', sub: 'Contracted rate agreed', who: 'admin', right: true,
        detail: { desc: 'Negotiate rate, deliverable scope, and timeline with the brand. No hub entry yet.', fields: ['Contracted rate', 'Number of deliverables', 'Post dates', 'Rush premium (if applicable)'], tips: ['Lock the contracted rate before creating the campaign — it drives all downstream financial calculations'] } },
      { id: 'deal_signed', label: 'Deal signed', sub: 'Status → Confirmed', who: 'milestone', right: false,
        detail: { desc: 'Both parties agree. Deal signed date recorded in the hub.', fields: ['Deal signed date', 'Campaign status → Confirmed'], tips: ['Set status to Confirmed once locked — campaign becomes visible on the calendar'] } },
    ],
  },
  {
    label: 'Setup',
    steps: [
      { id: 'campaign_created', label: 'Campaign created', sub: 'Hub entry + agency linked', who: 'admin', right: false,
        detail: { desc: 'Admin creates the campaign record. Name auto-generates from date, creator, and agency.', fields: ['Campaign name (auto: yyyymmdd-NN-Creator-Agency)', 'Creator', 'Agency / Label', 'Brand name', 'Contracted rate', 'Is rush + rush premium', 'Campaign start / end dates', 'Deal signed date', 'Campaign brief (Markdown)'], tips: ['Select Creator and Agency first — the name auto-generates', 'Paste the full brief into the brief field; it supports Markdown'] } },
      { id: 'deliverables', label: 'Deliverables defined', sub: 'Platform, type, post date', who: 'admin', right: false,
        detail: { desc: 'Each deliverable is added. Use Quantity > 1 then Expand to create individual trackable rows.', fields: ['Platform (TikTok, Instagram, etc.)', 'Deliverable type (Post, Story, Reel, etc.)', 'Contracted post date', 'Quantity'], tips: ['Use Expand to split a quantity-3 deliverable into 3 individual rows', 'Post dates drive the calendar and deadline alerts'] } },
      { id: 'status_active', label: 'Status → Active', sub: 'Creator can see campaign', who: 'milestone', right: false,
        detail: { desc: 'Campaign set to Active. Creator sees it in My Campaigns and can submit drafts.', fields: ['Campaign status → Active'], tips: ['Active campaigns show as "Needs Attention" on the creator overview when deliverables are Not Started'] } },
    ],
  },
  {
    label: 'Delivery',
    steps: [
      { id: 'draft_submitted', label: 'Draft submitted', sub: 'Creator submits for review', who: 'creator', right: false,
        detail: { desc: 'Creator submits the draft via their portal. A revision round record is created.', fields: ['Draft status → Draft Submitted', 'Revision round notes'], tips: ['Creator submits from My Campaigns → campaign detail → Submit Draft'] } },
      { id: 'revisions', label: 'Revisions (if needed)', sub: 'Loop back until approved', who: 'decision', right: true,
        detail: { desc: 'Admin requests changes. Creator is notified. Each revision round is timestamped.', fields: ['Draft status → Revisions Requested', 'Revision notes (visible to creator)'], tips: ['Revision rounds are tracked — useful for dispute resolution', 'Creator overview shows "Needs Attention" for deliverables in revision'] } },
      { id: 'approved', label: 'Draft approved', sub: 'Status → Approved', who: 'milestone', right: false,
        detail: { desc: 'Admin approves the draft. Creator is clear to post.', fields: ['Draft status → Approved'], tips: ['Verify brief requirements are fully met before approving'] } },
      { id: 'posted', label: 'Content posted', sub: 'Creator links live video', who: 'creator', right: false,
        detail: { desc: 'Creator posts and links the live URL. Video matches to TikTok analytics via video picker.', fields: ['Post URL (linked by creator)', 'Actual post date (auto-set)', 'Draft status → Posted'], tips: ['TikTok analytics appear in the Analytics view once synced via Coupler.io'] } },
      { id: 'all_posted', label: 'All deliverables posted', sub: 'Campaign marked complete', who: 'milestone', right: false,
        detail: { desc: 'Once all deliverables are Posted, creator can mark the campaign complete.', fields: ['All draft_status = Posted', 'Campaign status → Completed'], tips: ['The Mark Complete button only appears when every deliverable is Posted'] } },
    ],
  },
  {
    label: 'Invoicing',
    steps: [
      { id: 'invoice_sent', label: 'Invoice sent to agency', sub: 'Invoice amount recorded', who: 'admin', right: false,
        detail: { desc: 'Admin records the invoice sent to the agency. Hub tracks invoice status.', fields: ['Invoice number', 'Invoice date', 'Invoice amount', 'Payment status → Invoiced', 'Payment method'], tips: ['Access from Payments → click campaign → Invoice tab'] } },
    ],
  },
  {
    label: 'Settlement',
    steps: [
      { id: 'agency_pays', label: 'Agency pays Patrick', sub: 'Payment received + cleared', who: 'admin', right: false,
        detail: { desc: 'Agency transfers payment. Admin records receipt and marks money as cleared.', fields: ['Payment status → Paid', 'Paid date', 'Amount received', 'Processing fee', 'Money cleared ✓', 'Date cleared', 'Receipt upload (PDF/JPG)'], tips: ['Record the exact amount received — any shortfall is the processing fee', 'Checking "Money cleared" unlocks the Payout tab'] } },
      { id: 'overdue', label: 'Overdue?', sub: 'Chase if payment late', who: 'decision', right: true,
        detail: { desc: 'If payment has not arrived, set status to Overdue and chase the agency externally.', fields: ['Payment status → Overdue'], tips: ['Use Admin Notes on the campaign to log chase activity', 'Overdue campaigns appear on the admin overview under Agency Payments Pending'] } },
    ],
  },
  {
    label: 'Creator Payout',
    steps: [
      { id: 'payout_created', label: 'Payout created', sub: 'Amount + destination splits', who: 'admin', right: false,
        detail: { desc: 'Admin creates the payout and configures destination splits by percentage.', fields: ['Payout amount', 'Payout status → Pending', 'Destination (bank / UTMA / other)', 'Percentage per destination', 'Payout notes'], tips: ['Set up Payment Destinations first in Setup → Payment Destinations', 'Percentages must total 100%', '"Other" destination type shows notes field in place of account type'] } },
      { id: 'transfers_sent', label: 'Transfers sent', sub: 'Reference IDs recorded', who: 'admin', right: false,
        detail: { desc: 'Admin initiates bank transfers and records sent dates and transaction IDs per split.', fields: ['Split status → Sent', 'Sent date', 'Reference / transaction ID'], tips: ['Record the bank reference number for each split — useful if a transfer is disputed'] } },
      { id: 'cleared', label: 'Settlement complete', sub: 'Splits cleared → Payout Paid', who: 'milestone', right: false,
        detail: { desc: 'Admin confirms each transfer cleared. Payout status set to Paid. Campaign fully settled.', fields: ['Split status → Cleared', 'Cleared date', 'Payout status → Paid'], tips: ['Creator sees split status in My Payments — Cleared lets them confirm receipt', 'Once Paid, the campaign appears in the creator\'s total paid on their overview'] } },
    ],
  },
];

const WHO_STYLE = {
  admin:     { color: '#7c6de8', bg: 'rgba(124,109,232,0.1)', border: 'rgba(124,109,232,0.45)', label: 'Admin action' },
  creator:   { color: '#e0603a', bg: 'rgba(224,96,58,0.1)',   border: 'rgba(224,96,58,0.45)',   label: 'Creator action' },
  milestone: { color: '#1db954', bg: 'rgba(29,185,84,0.1)',   border: 'rgba(29,185,84,0.45)',   label: 'Milestone' },
  decision:  { color: '#c9921a', bg: 'rgba(201,146,26,0.1)',  border: 'rgba(201,146,26,0.45)',  label: 'Decision' },
};

function Tooltip({ step }) {
  const w = WHO_STYLE[step.who];
  return (
    <div style={{
      position: 'absolute', top: 0, left: 'calc(100% + 12px)',
      width: 270, zIndex: 500,
      background: '#161616',
      border: `1px solid ${w.border}`,
      borderLeft: `3px solid ${w.color}`,
      borderRadius: 8, padding: '13px 15px',
      boxShadow: '0 8px 28px rgba(0,0,0,0.7)',
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: w.color, marginBottom: 5 }}>{w.label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#e0e0e0', marginBottom: 7, lineHeight: 1.35 }}>{step.label}</div>
      <div style={{ fontSize: 11, color: '#666', lineHeight: 1.65, marginBottom: step.detail.fields.length ? 9 : 0 }}>{step.detail.desc}</div>
      {step.detail.fields.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#3a3a3a', marginBottom: 4 }}>Fields to fill</div>
          <ul style={{ margin: 0, padding: '0 0 0 13px' }}>
            {step.detail.fields.map((f, i) => <li key={i} style={{ fontSize: 11, color: '#999', lineHeight: 1.7 }}>{f}</li>)}
          </ul>
        </>
      )}
      {step.detail.tips.length > 0 && (
        <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid #222' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#3a3a3a', marginBottom: 4 }}>Tips</div>
          {step.detail.tips.map((t, i) => <div key={i} style={{ fontSize: 11, color: '#555', lineHeight: 1.65, marginBottom: 3 }}>◦ {t}</div>)}
        </div>
      )}
    </div>
  );
}

const DownArrow = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, padding: '2px 0' }}>
    <div style={{ width: 1, height: 18, background: '#2e2e2e' }} />
    <svg width="8" height="6" viewBox="0 0 8 6"><path d="M4 6L0 0L8 0Z" fill="#2e2e2e" /></svg>
  </div>
);

export default function CampaignFlowView() {
  const [activeStep, setActiveStep] = useState(null);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">CAMPAIGN FLOW</div>
          <div className="page-subtitle">End-to-end process — hover any step for field details</div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {Object.entries(WHO_STYLE).map(([key, w]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: w.color }} />
              <span style={{ fontSize: 11, color: '#555' }}>{w.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, maxWidth: 720 }}>
        {/* Flow column */}
        <div style={{ flex: 1 }}>
          {PHASES.map((phase, pi) => (
            <div key={phase.label} style={{ display: 'flex', gap: 0 }}>
              {/* Phase label strip */}
              <div style={{
                writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                fontSize: 8, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase',
                color: '#2e2e2e', minWidth: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRight: '1px solid #1e1e1e', marginRight: 16,
              }}>
                {phase.label}
              </div>

              {/* Steps */}
              <div style={{ flex: 1, paddingTop: pi > 0 ? 0 : 0 }}>
                {phase.steps.map((step, si) => {
                  const w = WHO_STYLE[step.who];
                  const isActive = activeStep === step.id;
                  return (
                    <div key={step.id}>
                      {si > 0 && (
                        <div style={{ marginLeft: step.right ? 'auto' : 20, marginRight: step.right ? 20 : 'auto', width: 'fit-content' }}>
                          <DownArrow />
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: step.right ? 'flex-end' : 'flex-start' }}>
                        <div
                          style={{ position: 'relative' }}
                          onMouseEnter={() => setActiveStep(step.id)}
                          onMouseLeave={() => setActiveStep(null)}
                        >
                          <div style={{
                            background: isActive ? w.bg : 'rgba(255,255,255,0.025)',
                            border: `1px solid ${isActive ? w.color : '#252525'}`,
                            borderRadius: 9,
                            padding: '12px 17px',
                            minWidth: 190, maxWidth: 240,
                            cursor: 'default',
                            transition: 'border-color 0.12s, background 0.12s',
                            userSelect: 'none',
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? '#fff' : '#ccc', lineHeight: 1.3, marginBottom: step.sub ? 3 : 0, transition: 'color 0.12s' }}>
                              {step.label}
                            </div>
                            {step.sub && <div style={{ fontSize: 10, color: '#4a4a4a', lineHeight: 1.4 }}>{step.sub}</div>}
                          </div>
                          {isActive && <Tooltip step={step} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Arrow between phases */}
                {pi < PHASES.length - 1 && (
                  <div style={{ marginLeft: 20 }}><DownArrow /></div>
                )}
              </div>
            </div>
          ))}

          {/* Final node */}
          <div style={{ display: 'flex', gap: 0 }}>
            <div style={{ minWidth: 28, marginRight: 16, borderRight: '1px solid #1e1e1e' }} />
            <div>
              <div style={{ marginLeft: 20 }}><DownArrow /></div>
              <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', borderRadius: 9, padding: '10px 17px' }}>
                <div style={{ fontSize: 11, color: '#333', letterSpacing: 0.5 }}>Campaign record closed — fully settled</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
