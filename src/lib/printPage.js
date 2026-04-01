/**
 * printPage.js — Generates a self-contained HTML string for PDF export.
 * Pure JS. No React. No external dependencies. All styles are inline.
 * Reads from the results object produced by calcResults().
 */

export function generatePrintHTML( results, lang ) {

  // ── Helpers ──────────────────────────────────────────────────────

  const fmt = n => new Intl.NumberFormat( 'en-CA', {
    style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
  } ).format( Math.round( n ) );

  const fmtPct  = n => Math.round( n ) + '%';
  const fmtYrs  = n => Math.round( n ) + ( lang === 'fr' ? ' ans' : ' yrs' );
  const esc     = s => String( s )
    .replace( /&/g, '&amp;' )
    .replace( /</g, '&lt;' )
    .replace( />/g, '&gt;' )
    .replace( /"/g, '&quot;' );

  const firmName  = window.dsCalcData?.firmName  ?? 'Doyle Salewski';
  const firmPhone = window.dsCalcData?.firmPhone ?? '(613) 237-5555';
  const logoUrl   = window.dsCalcData?.logoUrl   ?? '';

  const proposal      = results.options.find( o => o.id === 'proposal' );
  const dmp           = results.options.find( o => o.id === 'dmp' );
  const consolidation = results.options.find( o => o.id === 'consolidation' );
  const nothing       = results.options.find( o => o.id === 'nothing' );

  const nothingYears  = Math.round( nothing.months / 12 );
  const proposalYears = Math.round( proposal.months / 12 );
  const maxMonths     = nothing.months;
  const NOW           = new Date().getFullYear();

  const dateStr = new Date().toLocaleDateString(
    lang === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const afterInterest = results.income - results.expenses - results.monthlyInterest;
  const rateStr = ( results.annualRate * 100 ).toFixed( 2 );

  // ── Timeline bar widths ───────────────────────────────────────────

  const barPct = opt => Math.min( ( opt.months / maxMonths ) * 100, 100 ).toFixed( 1 );

  const OPTION_COLORS = {
    proposal: '#1061ED', dmp: '#d97706',
    consolidation: '#0891b2', nothing: '#dc2626',
  };

  const OPTION_NAMES_EN = {
    proposal: 'Consumer Proposal', dmp: 'Debt Mgmt Plan',
    consolidation: 'Consolidation Loan', nothing: 'Do Nothing',
  };

  const OPTION_NAMES_FR = {
    proposal: 'Proposition de consommateur', dmp: 'Plan de gestion de dettes',
    consolidation: 'Prêt de consolidation', nothing: 'Ne rien faire',
  };

  const optName = id => lang === 'fr'
    ? ( OPTION_NAMES_FR[ id ] ?? id )
    : ( OPTION_NAMES_EN[ id ] ?? id );

  // ── DTI ───────────────────────────────────────────────────────────

  const dtiPct   = Math.min( results.dti, 100 );
  const dtiLevel = results.dti > 80 ? 'critical'
    : results.dti > 43 ? 'high'
    : results.dti > 36 ? 'elevated'
    : 'ok';
  const dtiFlagClass = dtiLevel === 'ok' ? 'flag-success'
    : dtiLevel === 'elevated' ? 'flag-warning'
    : 'flag-danger';
  const dtiFlagLabel = dtiLevel === 'ok' ? 'Healthy'
    : dtiLevel === 'elevated' ? 'Elevated'
    : dtiLevel === 'high' ? 'High risk'
    : 'Critical';

  // ── Axis years ────────────────────────────────────────────────────

  const axisYears = [ 0, 0.25, 0.5, 0.75, 1 ].map( s => {
    const mo = Math.round( s * maxMonths );
    return s === 0 ? NOW : NOW + Math.floor( mo / 12 );
  } );

  // ── Options config ────────────────────────────────────────────────

  const OPTIONS_CONFIG = buildOptionsConfig( results, nothing, nothingYears, proposal, dmp, consolidation, fmt, fmtYrs );

  // ── Build sections ────────────────────────────────────────────────

  const timelineRows = buildTimeline( OPTIONS_CONFIG, optName, fmt, barPct, fmtYrs, esc );
  const payCards     = buildPayCards( OPTIONS_CONFIG, results, optName, fmt, fmtYrs, esc );
  const optCards     = buildOptCards( OPTIONS_CONFIG, optName, fmt, fmtYrs, esc );

  // ── CSS ───────────────────────────────────────────────────────────

  const css = getCSS();

  // ── Assemble ──────────────────────────────────────────────────────

  return buildDocument( {
    css, lang, firmName, firmPhone, logoUrl, results, dateStr,
    fmt, fmtPct, fmtYrs, esc, rateStr, afterInterest,
    dtiPct, dtiFlagClass, dtiFlagLabel,
    nothing, nothingYears, proposal, proposalYears,
    axisYears, timelineRows, payCards, optCards,
  } );
}

// ════════════════════════════════════════════════════════════════════
// BUILDER FUNCTIONS (split out to keep generatePrintHTML readable)
// ════════════════════════════════════════════════════════════════════

function buildOptionsConfig( results, nothing, nothingYears, proposal, dmp, consolidation, fmt, fmtYrs ) {
  return [
    {
      id: 'proposal', opt: proposal, color: '#1061ED', recommended: true,
      pros: [ 'Lowest total cost — by far', 'Zero interest from day one',
              'Immediate legal protection', 'Keep your home and car',
              'Fixed payments — nothing changes' ],
      cons: [ 'R7 credit rating for ~6 years' ],
      considerations: [ 'Must be filed by a Licensed Insolvency Trustee',
                        'Creditors must accept — though most do' ],
      admin: 'Administered by: A Licensed Insolvency Trustee, licensed and regulated by the federal government.',
      detailRows: [
        [ 'You repay', '~30% of original debt' ],
        [ 'Legal protection', 'Immediate upon filing' ],
        [ 'Collection calls', 'Stop immediately' ],
        [ 'Home & car', 'Protected' ],
        [ 'Credit rating', 'R7 — 3 yrs post-completion (~6 yrs from filing)' ],
        [ 'CRA & student debt', 'Included' ],
      ],
    },
    {
      id: 'dmp', opt: dmp, color: '#d97706', recommended: false,
      pros: [ 'No formal insolvency filing', 'Zero interest if creditors agree',
              'Builds structured repayment habits' ],
      cons: [ 'Full principal repayment — 3.5× a proposal',
              'No legal protection from lawsuits', 'CRA and student debt excluded' ],
      considerations: [ 'Not all creditors must participate' ],
      admin: 'Administered by: A non-profit credit counselling agency. Fees are included in your monthly payment.',
      detailRows: [
        [ 'You repay', '100% of original debt' ],
        [ 'Legal protection', 'None' ],
        [ 'Collection calls', 'May continue' ],
        [ 'Home & car', 'Protected' ],
        [ 'Credit rating', 'R7 — 2 yrs post-completion' ],
        [ 'CRA & student debt', 'Not included' ],
      ],
    },
    {
      id: 'consolidation', opt: consolidation, color: '#0891b2', recommended: false,
      pros: [ 'No formal insolvency process', 'Single manageable payment',
              'Can improve credit over time' ],
      cons: [ 'Still pays interest over term', '4× more expensive than a proposal' ],
      considerations: [ 'Must qualify — 650+ credit score',
                        'No legal protection from creditors' ],
      admin: 'Administered by: A bank, credit union, or online lender. Rate and qualification depend on your credit profile.',
      detailRows: [
        [ 'You repay', '100% + interest' ],
        [ 'Legal protection', 'None' ],
        [ 'Interest rate', '~' + ( ( consolidation?.assumption ?? '' ).match( /[\d.]+/ )?.[0] ?? '16.99' ) + '% APR (estimated)' ],
        [ 'Credit score required', '650+ minimum' ],
        [ 'Credit rating', 'Improves with on-time payments' ],
      ],
    },
    {
      id: 'nothing', opt: nothing, color: '#dc2626', recommended: false,
      pros: [ 'No formal process required' ],
      cons: [ 'Pay far more than any other option', 'Decades of financial strain',
              'Damaged credit for the entire duration', 'No protection if creditors sue' ],
      considerations: [],
      admin: 'This scenario is presented as a reference point only. It represents the financial cost of making no change to your current situation.',
      detailRows: [
        [ 'You repay', ( nothingYears > 0 ? ( Math.round( nothing.total / results.debt * 10 ) / 10 ) : '—' ) + '× original debt' ],
        [ 'Time to debt-free', fmtYrs( nothingYears ) ],
        [ 'Monthly lost to interest', fmt( results.monthlyInterest ) + ' (never reduces principal)' ],
        [ 'Legal protection', 'None — creditors can sue' ],
        [ 'Credit rating', 'R9 — remains damaged throughout' ],
      ],
    },
  ];
}

function buildTimeline( OPTIONS_CONFIG, optName, fmt, barPct, fmtYrs, esc ) {
  return OPTIONS_CONFIG.map( cfg => `
    <div class="tl-row">
      <div class="tl-label">
        <div class="tl-label-name" style="color:${ esc( cfg.color ) }">${ esc( optName( cfg.id ) ) }</div>
        <div class="tl-label-amt">${ fmt( cfg.opt.total ) } total · ${ fmt( cfg.opt.payment ) }/mo</div>
      </div>
      <div class="tl-track">
        <div class="tl-fill" style="width:${ barPct( cfg.opt ) }%;background:${ esc( cfg.color ) }${ cfg.id !== 'nothing' ? 'cc' : '' }">
          <div class="tl-dot" style="background:${ esc( cfg.color ) };box-shadow:0 0 0 1.5pt ${ esc( cfg.color ) }"></div>
          <div class="tl-year">${ cfg.opt.year }</div>
        </div>
      </div>
      <div class="tl-dur">${ fmtYrs( Math.round( cfg.opt.months / 12 ) ) }</div>
    </div>
  ` ).join( '' );
}

function buildPayCards( OPTIONS_CONFIG, results, optName, fmt, fmtYrs, esc ) {
  return OPTIONS_CONFIG.map( cfg => {
    const pctIncome = results.income > 0
      ? Math.round( ( cfg.opt.payment / results.income ) * 100 )
      : 0;
    const inBudget = results.surplus > 0 && cfg.opt.payment <= results.surplus;
    const isRec    = cfg.id === 'proposal';
    const cardClass = isRec ? 'pay-card pay-card-rec'
      : cfg.id === 'nothing' ? 'pay-card pay-card-nothing'
      : 'pay-card';
    return `
      <div class="${ cardClass }">
        <div class="pay-card-name" style="color:${ esc( cfg.color ) }">${ isRec ? '★ ' : '' }${ esc( optName( cfg.id ) ) }</div>
        <div class="pay-card-amt" style="color:${ esc( cfg.color ) }">${ fmt( cfg.opt.payment ) }</div>
        <div class="pay-card-per" style="color:${ esc( cfg.color ) }">per month</div>
        <div class="pay-card-detail">
          Done in <strong>${ fmtYrs( Math.round( cfg.opt.months / 12 ) ) }</strong><br>
          Total <strong>${ fmt( cfg.opt.total ) }</strong><br>
          <strong>${ pctIncome }%</strong> of income
        </div>
        ${ inBudget ? '<div class="pay-within">✓ Within budget</div>' : '' }
      </div>
    `;
  } ).join( '' );
}

function buildOptCards( OPTIONS_CONFIG, optName, fmt, fmtYrs, esc ) {
  return OPTIONS_CONFIG.map( cfg => `
    <div class="opt-card" style="border-left-color:${ esc( cfg.color ) }">
      <div class="opt-hdr">
        <div>
          <span class="opt-name" style="color:${ esc( cfg.color ) }">${ esc( optName( cfg.id ) ) }</span>
          ${ cfg.recommended ? '<span class="opt-badge">Recommended</span>' : '' }
          ${ cfg.id === 'nothing' ? '<span class="opt-badge" style="background:#dc2626">Warning</span>' : '' }
        </div>
        <div class="opt-total">
          ${ fmt( cfg.opt.total ) }
          <span class="opt-total-lbl">total cost</span>
        </div>
      </div>
      <div class="opt-stats">
        <div class="opt-stat">
          <div class="opt-stat-val" style="color:${ esc( cfg.color ) }">${ fmt( cfg.opt.payment ) }</div>
          <div class="opt-stat-lbl">Monthly payment</div>
        </div>
        <div class="opt-stat">
          <div class="opt-stat-val" style="color:${ esc( cfg.color ) }">${ fmtYrs( Math.round( cfg.opt.months / 12 ) ) }</div>
          <div class="opt-stat-lbl">Duration</div>
        </div>
        <div class="opt-stat">
          <div class="opt-stat-val" style="color:${ esc( cfg.color ) }">${ fmt( cfg.opt.interestPaid ) }</div>
          <div class="opt-stat-lbl">Interest paid</div>
          ${ cfg.opt.interestPaid === 0 ? '<div class="opt-stat-sub">From day one</div>' : '<div class="opt-stat-sub">Over term</div>' }
        </div>
      </div>
      <table class="opt-detail">
        ${ cfg.detailRows.map( ( [ l, v ] ) => `<tr><td>${ esc( l ) }</td><td>${ esc( v ) }</td></tr>` ).join( '' ) }
      </table>
      <div class="opt-proscons">
        <div>
          <div class="opt-pc-lbl opt-pc-lbl-pro">${ cfg.id === 'nothing' ? 'The only upside' : 'Advantages' }</div>
          ${ cfg.pros.map( p => `<div class="opt-pc-item">✓ ${ esc( p ) }</div>` ).join( '' ) }
        </div>
        <div>
          <div class="opt-pc-lbl opt-pc-lbl-con">${ cfg.id === 'nothing' ? 'The reality' : 'Drawbacks' }</div>
          ${ cfg.cons.map( c => `<div class="opt-pc-item">✗ ${ esc( c ) }</div>` ).join( '' ) }
        </div>
        <div>
          ${ cfg.considerations.length > 0 ? `
            <div class="opt-pc-lbl opt-pc-lbl-consider">Considerations</div>
            ${ cfg.considerations.map( c => `<div class="opt-pc-item">→ ${ esc( c ) }</div>` ).join( '' ) }
          ` : '' }
        </div>
      </div>
      <div class="opt-admin">${ esc( cfg.admin ) }</div>
    </div>
  ` ).join( '' );
}

function getCSS() {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10pt; color: #111827; background: #fff;
      padding: 0; margin: 0;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .page { max-width: 760px; margin: 0 auto; padding: 24pt 28pt; }
    .hdr { display: flex; align-items: center; justify-content: space-between;
           padding-bottom: 14pt; border-bottom: 1pt solid #e5e7eb; margin-bottom: 16pt; }
    .hdr-left { display: flex; align-items: center; gap: 10pt; }
    .logo { width: 38pt; height: 38pt; object-fit: contain; }
    .logo-fb { width: 34pt; height: 34pt; background: #1061ED; border-radius: 7pt;
               display: flex; align-items: center; justify-content: center; }
    .hdr-title { font-size: 13pt; font-weight: 700; color: #111827; line-height: 1.2; }
    .hdr-sub { font-size: 8pt; color: #9ca3af; margin-top: 2pt; }
    .hdr-right { text-align: right; }
    .hdr-firm { font-size: 9pt; font-weight: 600; color: #374151; }
    .hdr-date { font-size: 8pt; color: #9ca3af; margin-top: 2pt; }
    .sec-title { font-size: 10pt; font-weight: 700; color: #111827;
                 margin: 14pt 0 8pt; padding-bottom: 4pt;
                 border-bottom: 0.5pt solid #e5e7eb; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr);
               gap: 8pt; margin-bottom: 14pt; }
    .metric { background: #fff; border: 0.5pt solid #e5e7eb; border-radius: 6pt;
              padding: 8pt 10pt; }
    .metric-lbl { font-size: 7pt; font-weight: 700; text-transform: uppercase;
                  letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 4pt; }
    .metric-flag { display: inline-block; font-size: 7pt; font-weight: 700;
                   padding: 1pt 5pt; border-radius: 99pt; margin-left: 4pt;
                   vertical-align: middle; }
    .flag-danger  { background: #fef2f2; color: #dc2626; border: 0.5pt solid #fecaca; }
    .flag-warning { background: #fffbeb; color: #d97706; border: 0.5pt solid #fed7aa; }
    .flag-success { background: #f0fdf4; color: #16a34a; border: 0.5pt solid #bbf7d0; }
    .metric-val { font-size: 16pt; font-weight: 800; letter-spacing: -0.5pt;
                  line-height: 1; margin-bottom: 3pt; }
    .metric-sub { font-size: 7pt; color: #9ca3af; }
    .val-red    { color: #dc2626; }
    .val-green  { color: #16a34a; }
    .val-orange { color: #d97706; }
    .val-dark   { color: #111827; }
    .tbl { width: 100%; border-collapse: collapse; margin-bottom: 14pt; font-size: 9pt; }
    .tbl thead tr { background: #f9fafb; }
    .tbl th { font-size: 7pt; font-weight: 700; text-transform: uppercase;
              letter-spacing: 0.06em; color: #9ca3af; padding: 6pt 10pt; text-align: left; }
    .tbl th:last-child { text-align: right; }
    .tbl td { padding: 7pt 10pt; border-bottom: 0.5pt solid #f3f4f6;
              color: #6b7280; vertical-align: middle; }
    .tbl td:last-child { text-align: right; font-weight: 700; color: #111827; white-space: nowrap; }
    .tbl tr.total td { background: #f9fafb; font-weight: 700; color: #111827;
                       border-top: 0.5pt solid #e5e7eb; }
    .tbl tr.total td:last-child { font-size: 11pt; }
    .tbl-note { font-size: 7.5pt; color: #9ca3af; font-style: italic; margin-left: 4pt; font-weight: 400; }
    .dti-wrap { margin-bottom: 14pt; }
    .dti-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6pt; }
    .dti-lbl { font-size: 9pt; font-weight: 700; color: #374151; }
    .dti-val { font-size: 14pt; font-weight: 800; color: #dc2626; }
    .dti-track { height: 8pt; border-radius: 99pt; overflow: hidden;
                 background: #f3f4f6; margin-bottom: 5pt; position: relative; }
    .dti-zone-ok   { position: absolute; left: 0;   width: 36%; height: 100%; background: #dcfce7; }
    .dti-zone-warn { position: absolute; left: 36%; width: 7%;  height: 100%; background: #fef9c3; }
    .dti-zone-high { position: absolute; left: 43%; width: 57%; height: 100%; background: #fee2e2; }
    .dti-dot { position: absolute; top: 50%; width: 12pt; height: 12pt;
               background: #dc2626; border-radius: 50%; border: 2pt solid #fff;
               box-shadow: 0 0 0 1.5pt #dc2626; transform: translate(-50%, -50%); }
    .dti-ticks { display: flex; justify-content: space-between;
                 font-size: 7pt; color: #9ca3af; }
    .dti-note { font-size: 7.5pt; color: #6b7280; margin-top: 6pt;
                padding: 6pt 10pt; background: #f9fafb;
                border-left: 2pt solid #d97706; border-radius: 0 4pt 4pt 0; }
    .tl-row { display: flex; align-items: center; gap: 0; margin-bottom: 14pt; }
    .tl-label { width: 150pt; flex-shrink: 0; text-align: right; padding-right: 12pt; }
    .tl-label-name { font-size: 9pt; font-weight: 600; }
    .tl-label-amt  { font-size: 7.5pt; color: #6b7280; margin-top: 1pt; }
    .tl-track { flex: 1; height: 10pt; background: #f3f4f6; border-radius: 99pt;
                position: relative; overflow: visible; }
    .tl-fill { height: 100%; border-radius: 99pt; position: relative; }
    .tl-dot { position: absolute; right: -4pt; top: 50%;
              width: 10pt; height: 10pt; border-radius: 50%;
              border: 2pt solid #fff; transform: translateY(-50%); }
    .tl-year { position: absolute; right: 0; top: -14pt;
               transform: translateX(50%); font-size: 8pt;
               font-weight: 700; color: #374151; white-space: nowrap; }
    .tl-dur { padding-left: 10pt; width: 36pt; flex-shrink: 0;
              font-size: 8pt; color: #6b7280; }
    .tl-axis { margin-left: 150pt; display: flex; justify-content: space-between;
               font-size: 7.5pt; color: #9ca3af; margin-top: 6pt; }
    .tl-callout { background: #fffbeb; border-top: 0.5pt solid #fde68a;
                  padding: 8pt 12pt; font-size: 8.5pt; color: #78350f;
                  line-height: 1.6; margin-top: 8pt; border-radius: 0 0 6pt 6pt; }
    .pay-grid { display: grid; grid-template-columns: repeat(4, 1fr);
                gap: 8pt; margin-bottom: 10pt; }
    .pay-card { border: 0.5pt solid #e5e7eb; border-radius: 8pt;
                padding: 10pt 8pt; text-align: center; }
    .pay-card-rec { border: 1.5pt solid #1061ED; border-top-width: 3pt;
                    background: #f0f7ff; }
    .pay-card-nothing { opacity: 0.8; }
    .pay-card-name { font-size: 7pt; font-weight: 800; text-transform: uppercase;
                     letter-spacing: 0.08em; margin-bottom: 6pt; }
    .pay-card-amt { font-size: 20pt; font-weight: 800; letter-spacing: -1pt;
                    line-height: 1; margin-bottom: 2pt; }
    .pay-card-per { font-size: 7pt; font-weight: 700; margin-bottom: 8pt; }
    .pay-card-detail { font-size: 8pt; color: #6b7280; line-height: 1.7; }
    .pay-card-detail strong { color: #111827; font-weight: 700; }
    .pay-within { display: inline-block; margin-top: 6pt; font-size: 7pt;
                  font-weight: 700; color: #16a34a; background: #f0fdf4;
                  border: 0.5pt solid #bbf7d0; padding: 2pt 8pt;
                  border-radius: 99pt; }
    .opt-card { border: 0.5pt solid #e5e7eb; border-radius: 8pt;
                border-left: 3pt solid #e5e7eb; margin-bottom: 12pt;
                page-break-inside: avoid; break-inside: avoid; }
    .opt-hdr { display: flex; justify-content: space-between; align-items: flex-start;
               padding: 10pt 12pt 8pt; border-bottom: 0.5pt solid #f3f4f6; }
    .opt-name { font-size: 11pt; font-weight: 700; }
    .opt-badge { display: inline-block; font-size: 7pt; font-weight: 800;
                 text-transform: uppercase; padding: 2pt 7pt; border-radius: 3pt;
                 background: #1061ED; color: #fff; margin-left: 6pt;
                 vertical-align: middle; }
    .opt-total { font-size: 13pt; font-weight: 800; text-align: right; }
    .opt-total-lbl { font-size: 7pt; color: #9ca3af; display: block; }
    .opt-stats { display: grid; grid-template-columns: repeat(3, 1fr);
                 gap: 6pt; padding: 10pt 12pt; background: #f9fafb; }
    .opt-stat { background: #fff; border: 0.5pt solid #e5e7eb;
                border-radius: 5pt; padding: 7pt 8pt; }
    .opt-stat-val { font-size: 12pt; font-weight: 800; letter-spacing: -0.3pt;
                    line-height: 1; color: #111827; }
    .opt-stat-lbl { font-size: 7pt; color: #6b7280; margin-top: 2pt; }
    .opt-stat-sub { font-size: 7pt; color: #9ca3af; font-style: italic; }
    .opt-detail { width: 100%; border-collapse: collapse; }
    .opt-detail td { padding: 5pt 12pt; border-bottom: 0.5pt solid #f3f4f6;
                     font-size: 8.5pt; }
    .opt-detail td:first-child { color: #6b7280; }
    .opt-detail td:last-child { text-align: right; font-weight: 700; color: #111827; }
    .opt-proscons { display: grid; grid-template-columns: 1fr 1fr 1fr;
                   gap: 12pt; padding: 10pt 12pt; }
    .opt-pc-lbl { font-size: 7pt; font-weight: 800; text-transform: uppercase;
                  letter-spacing: 0.08em; margin-bottom: 6pt; }
    .opt-pc-lbl-pro { color: #16a34a; }
    .opt-pc-lbl-con { color: #dc2626; }
    .opt-pc-lbl-consider { color: #6b7280; }
    .opt-pc-item { font-size: 8pt; color: #374151; line-height: 1.6;
                   margin-bottom: 3pt; }
    .opt-admin { font-size: 7.5pt; color: #6b7280; padding: 7pt 12pt;
                 background: #f9fafb; border-top: 0.5pt solid #e5e7eb;
                 border-radius: 0 0 6pt 6pt; }
    .footer { border-top: 0.5pt solid #e5e7eb; padding-top: 12pt;
              margin-top: 20pt; display: flex; justify-content: space-between;
              align-items: center; }
    .footer-firm { font-size: 8.5pt; font-weight: 700; color: #374151; }
    .footer-contact { font-size: 8pt; color: #6b7280; margin-top: 2pt; }
    .footer-legal { font-size: 7pt; color: #9ca3af; text-align: right;
                    max-width: 280pt; line-height: 1.5; }
    .page-break { page-break-before: always; break-before: always;
                  border-top: 0.5pt solid #e5e7eb; padding-top: 20pt; margin-top: 0; }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page { margin: 16mm 14mm; size: A4; }
      body { padding: 0; }
      .page { padding: 0; }
    }
  `;
}

function buildDocument( d ) {
  const {
    css, lang, firmName, firmPhone, logoUrl, results, dateStr,
    fmt, fmtPct, fmtYrs, esc, rateStr, afterInterest,
    dtiPct, dtiFlagClass, dtiFlagLabel,
    nothing, nothingYears, proposal, proposalYears,
    axisYears, timelineRows, payCards, optCards,
  } = d;

  return `<!DOCTYPE html>
<html lang="${ lang === 'fr' ? 'fr' : 'en' }">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Debt Assessment Report — ${ esc( firmName ) }</title>
<style>${ css }</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-left">
      ${ logoUrl
        ? `<img src="${ esc( logoUrl ) }" alt="${ esc( firmName ) }" class="logo">`
        : `<div class="logo-fb"><svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6h6M5 9h4"/></svg></div>` }
      <div>
        <div class="hdr-title">Debt Assessment Report</div>
        <div class="hdr-sub">${ esc( results.province ) } · Unsecured debt analysis · ${ esc( dateStr ) }</div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="hdr-firm">${ esc( firmName ) }</div>
      <div class="hdr-contact">${ esc( firmPhone ) }</div>
    </div>
  </div>

  <!-- Metric tiles -->
  <div class="metrics">
    <div class="metric">
      <div class="metric-lbl">Total Debt <span class="metric-flag flag-${ results.debt > 50000 ? 'danger' : 'warning' }">High</span></div>
      <div class="metric-val val-red">${ fmt( results.debt ) }</div>
      <div class="metric-sub">Unsecured only</div>
    </div>
    <div class="metric">
      <div class="metric-lbl">Monthly Interest <span class="metric-flag flag-danger">Critical</span></div>
      <div class="metric-val val-red">${ fmt( results.monthlyInterest ) }</div>
      <div class="metric-sub">Never reduces balance</div>
    </div>
    <div class="metric">
      <div class="metric-lbl">Debt-to-Income <span class="metric-flag ${ dtiFlagClass }">${ esc( dtiFlagLabel ) }</span></div>
      <div class="metric-val ${ results.dti > 36 ? 'val-red' : 'val-green' }">${ fmtPct( results.dti ) }</div>
      <div class="metric-sub">Target: under 36%</div>
    </div>
    <div class="metric">
      <div class="metric-lbl">Monthly Surplus <span class="metric-flag ${ results.surplus > 0 ? 'flag-success' : 'flag-danger' }">${ results.surplus > 0 ? 'Available' : 'Deficit' }</span></div>
      <div class="metric-val ${ results.surplus > 0 ? 'val-green' : 'val-red' }">${ fmt( results.surplus ) }</div>
      <div class="metric-sub">After essentials</div>
    </div>
  </div>

  <!-- Financial table -->
  <table class="tbl">
    <thead><tr><th>Item</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>Monthly take-home income</td><td>${ fmt( results.income ) }</td></tr>
      <tr><td>Monthly essential expenses</td><td style="color:#dc2626">− ${ fmt( results.expenses ) }</td></tr>
      <tr><td>Monthly interest <span class="tbl-note">est. ${ esc( rateStr ) }% APR</span></td><td style="color:#dc2626">− ${ fmt( results.monthlyInterest ) }</td></tr>
      <tr class="total">
        <td>Left after interest &amp; expenses</td>
        <td style="color:${ afterInterest >= 0 ? '#16a34a' : '#dc2626' }">${ afterInterest >= 0 ? fmt( afterInterest ) : `− ${ fmt( Math.abs( afterInterest ) ) }` } / mo</td>
      </tr>
      <tr><td>Annual interest cost</td><td style="color:#dc2626">${ fmt( results.annualInterest ) }</td></tr>
      <tr><td>Debt as share of annual income</td><td style="color:#dc2626">${ fmtPct( results.dti ) }</td></tr>
      <tr><td>Cost of doing nothing</td><td style="color:#dc2626">${ fmt( nothing.total ) } · ${ nothingYears } yrs · minimum payments</td></tr>
    </tbody>
  </table>

  <!-- DTI bar -->
  <div class="dti-wrap">
    <div class="dti-hdr">
      <span class="dti-lbl">Debt-to-income ratio</span>
      <span class="dti-val">${ fmtPct( results.dti ) } <span class="metric-flag ${ dtiFlagClass }" style="font-size:8pt">${ esc( dtiFlagLabel ) }</span></span>
    </div>
    <div class="dti-track">
      <div class="dti-zone-ok"></div>
      <div class="dti-zone-warn"></div>
      <div class="dti-zone-high"></div>
      <div class="dti-dot" style="left:${ Math.min( dtiPct, 98 ) }%"></div>
    </div>
    <div class="dti-ticks">
      <span>0%</span><span>Healthy &lt;36%</span><span>High risk 43%+</span><span>100%</span>
    </div>
    <div class="dti-note">Interest estimated at ${ esc( rateStr ) }% APR — the Canadian average for unsecured consumer debt. Your actual rate may differ.</div>
  </div>

  <!-- Timeline -->
  <div class="sec-title">Your debt-free timeline</div>
  <div style="padding-top:16pt">
    ${ timelineRows }
    <div class="tl-axis">
      ${ axisYears.map( yr => `<span>${ yr }</span>` ).join( '' ) }
    </div>
    <div class="tl-callout">
      → A Consumer Proposal is done in <strong>${ proposalYears } years</strong> for <strong>${ fmt( proposal.total ) }</strong>.
      Minimum payments take <strong>${ nothingYears } years</strong> and cost <strong>${ fmt( nothing.total ) }</strong> —
      that's <strong>${ fmt( nothing.total - proposal.total ) } more</strong> for the privilege of waiting longer.
    </div>
  </div>

  <!-- Payment cards -->
  <div class="sec-title" style="margin-top:16pt">What comes out of your pocket each month</div>
  <div class="pay-grid" style="margin-top:10pt">${ payCards }</div>
  ${ results.surplus > 0 ? `<div style="font-size:8pt;color:#374151;margin-bottom:12pt">★ The Consumer Proposal at ${ fmt( proposal.payment ) }/mo leaves you ${ fmt( results.surplus - proposal.payment ) }/mo to spare — the most breathing room of any option.</div>` : '' }

  <!-- Page 2 — Options detail -->
  <div class="page-break">
    <div class="sec-title" style="margin-top:0">Your options — full breakdown</div>
    <div style="font-size:8.5pt;color:#6b7280;margin-bottom:12pt">Side-by-side comparison of every path out of ${ fmt( results.debt ) } in debt.</div>
    ${ optCards }
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>
      <div class="footer-firm">${ esc( firmName ) } · Licensed Insolvency Trustees</div>
      <div class="footer-contact">${ esc( firmPhone ) } · doylesalewski.ca</div>
    </div>
    <div class="footer-legal">
      This report is an estimate based on typical debt relief outcomes.
      Actual results depend on your specific creditors, income, and the
      terms of any proposal filed. The initial consultation is free,
      confidential, and carries no obligation.
    </div>
  </div>

</div>
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
}
