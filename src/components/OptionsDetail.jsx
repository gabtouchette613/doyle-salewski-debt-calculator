import { useState } from '@wordpress/element';
import { getT } from '../lib/i18n';
import { fmtC } from '../lib/calculator';

const OPTION_CONFIG = [
  {
    id: 'proposal', accentColor: '#1061ED', variant: 'recommended',
    pros:           [ 'opt-proposal-pro-1', 'opt-proposal-pro-2', 'opt-proposal-pro-3', 'opt-proposal-pro-4', 'opt-proposal-pro-5' ],
    cons:           [ 'opt-proposal-con-1' ],
    considerations: [ 'opt-proposal-con-2', 'opt-proposal-con-3' ],
    administered:   'opt-proposal-admin',
  },
  {
    id: 'dmp', accentColor: '#d97706', variant: 'neutral',
    pros:           [ 'opt-dmp-pro-1', 'opt-dmp-pro-2', 'opt-dmp-pro-3' ],
    cons:           [ 'opt-dmp-con-1', 'opt-dmp-con-2', 'opt-dmp-con-4' ],
    considerations: [ 'opt-dmp-con-3' ],
    administered:   'opt-dmp-admin',
  },
  {
    id: 'consolidation', accentColor: '#0891b2', variant: 'neutral',
    pros:           [ 'opt-cons-pro-1', 'opt-cons-pro-2', 'opt-cons-pro-3' ],
    cons:           [ 'opt-cons-con-2', 'opt-cons-con-3' ],
    considerations: [ 'opt-cons-con-1', 'opt-cons-con-4' ],
    administered:   'opt-cons-admin',
  },
  {
    id: 'nothing', accentColor: '#dc2626', variant: 'warning',
    pros:           [ 'opt-nothing-pro-1' ],
    cons:           [ 'opt-nothing-con-1', 'opt-nothing-con-2', 'opt-nothing-con-3', 'opt-nothing-con-4' ],
    considerations: [],
    administered:   'opt-nothing-note',
  },
];

function getDetailRows( id, opt, results, t ) {
  const years    = Math.round( opt.months / 12 );
  const yearsStr = years === 1
    ? `1 ${ t( 'tl-year' ) }`
    : `${ years } ${ t( 'tl-years' ) }`;
  const proposalOpt = results.options.find( o => o.id === 'proposal' );
  const vsProposal  = proposalOpt ? fmtC( opt.total - proposalOpt.total ) + ' more' : '';

  switch ( id ) {
    case 'proposal':
      return [
        { label: t( 'opt-detail-repay' ),       value: t( 'opt-detail-proposal-repay' ) },
        { label: t( 'opt-detail-legal' ),        value: t( 'opt-detail-immediate' ) },
        { label: t( 'opt-detail-collections' ),  value: t( 'opt-detail-stop' ) },
        { label: t( 'opt-detail-assets' ),       value: t( 'opt-detail-protected' ) },
        { label: t( 'opt-detail-credit' ),       value: t( 'opt-detail-r7-proposal' ) },
        { label: t( 'opt-detail-court' ),        value: t( 'opt-detail-no-court' ) },
        { label: t( 'opt-detail-cra' ),          value: t( 'opt-detail-included' ) },
      ];
    case 'dmp':
      return [
        { label: t( 'opt-detail-repay' ),        value: t( 'opt-detail-dmp-repay' ) },
        { label: t( 'opt-detail-legal' ),         value: t( 'opt-detail-none' ) },
        { label: t( 'opt-detail-collections' ),   value: t( 'opt-detail-may-continue' ) },
        { label: t( 'opt-detail-assets' ),        value: t( 'opt-detail-protected' ) },
        { label: t( 'opt-detail-credit' ),        value: t( 'opt-detail-r7-dmp' ) },
        { label: t( 'opt-detail-creditors' ),     value: t( 'opt-detail-voluntary' ) },
        { label: t( 'opt-detail-cra' ),           value: t( 'opt-detail-not-included' ) },
      ];
    case 'consolidation':
      return [
        { label: t( 'opt-detail-repay' ),         value: t( 'opt-detail-cons-repay' ) },
        { label: t( 'opt-detail-legal' ),          value: t( 'opt-detail-none' ) },
        { label: t( 'opt-detail-rate' ),           value: t( 'opt-detail-cons-rate' ) },
        { label: t( 'opt-detail-credit-req' ),     value: t( 'opt-detail-cons-credit' ) },
        { label: t( 'opt-detail-credit' ),         value: t( 'opt-detail-cons-credit-rating' ) },
        { label: t( 'opt-detail-vs-proposal' ),    value: vsProposal },
      ];
    case 'nothing':
      return [
        { label: t( 'opt-detail-repay' ),              value: t( 'opt-detail-nothing-repay' ) },
        { label: t( 'opt-detail-time' ),               value: yearsStr },
        { label: t( 'opt-detail-monthly-interest' ),   value: `${ fmtC( results.monthlyInterest ) } (${ t( 'opt-detail-nothing-interest' ) })` },
        { label: t( 'opt-detail-legal' ),              value: t( 'opt-detail-nothing-legal' ) },
        { label: t( 'opt-detail-collections' ),        value: t( 'opt-detail-nothing-collections' ) },
        { label: t( 'opt-detail-credit' ),             value: t( 'opt-detail-r9' ) },
      ];
    default:
      return [];
  }
}

export default function OptionsDetail( { results, lang, unlocked, onUnlock } ) {
  const t = getT( lang );

  const [ unlockEmail, setUnlockEmail ] = useState( '' );
  const [ unlockName,  setUnlockName  ] = useState( '' );
  const [ unlockError, setUnlockError ] = useState( '' );
  const [ unlocking,   setUnlocking   ] = useState( false );
  const [ trap,        setTrap        ] = useState( '' );

  async function handleUnlock() {
    if ( ! unlockEmail.trim() || ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( unlockEmail ) ) {
      setUnlockError( t( 'pay-unlock-email-error' ) );
      return;
    }
    setUnlockError( '' );
    setUnlocking( true );
    const restUrl   = window.dsCalcData?.restUrl   ?? '';
    const restNonce = window.dsCalcData?.restNonce ?? '';
    const proposal  = results.options.find( o => o.id === 'proposal' );
    try {
      await fetch( `${ restUrl }lead`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': restNonce },
        body: JSON.stringify( {
          name:                unlockName,
          email:               unlockEmail,
          phone:               '',
          call_time:           'morning',
          website:             trap,
          debt:                results.debt,
          income:              results.income,
          expenses:            results.expenses,
          province:            results.province,
          surplus:             results.surplus,
          dti:                 results.dti,
          annual_rate:         results.annualRate,
          is_advanced:         results.isAdvancedRate,
          recommended_payment: proposal?.payment ?? 0,
          recommended_total:   proposal?.total   ?? 0,
          lang,
        } ),
      } );
    } catch ( _ ) {}
    setUnlocking( false );
    onUnlock();
  }

  return (
    <div className="dsc-opt-section">

      <div className="dsc-opt-section-hdr">
        <div>
          <div className="dsc-opt-section-title">
            { t( 'opt-section-title' ) }
          </div>
          <div className="dsc-opt-section-sub">
            { t( 'opt-section-sub' ).replace( '{debt}', fmtC( results.debt ) ) }
          </div>
        </div>
        <span className="dsc-opt-rec-pill">★ { t( 'opt-best' ) }</span>
      </div>

      { OPTION_CONFIG.map( config => {
        const opt = results.options.find( o => o.id === config.id );
        if ( ! opt ) return null;

        const isNothing  = config.id === 'nothing';
        const isRec      = config.variant === 'recommended';
        const isGated    = isRec && ! unlocked;
        const years      = Math.round( opt.months / 12 );
        const yearsStr   = years === 1
          ? `1 ${ t( 'tl-year' ) }`
          : `${ years } ${ t( 'tl-years' ) }`;
        const detailRows = getDetailRows( config.id, opt, results, t );
        const pros       = config.pros || [];
        const cons       = config.cons || [];
        const adminKey   = config.administered;

        return (
          <div
            key={ config.id }
            className={ `dsc-opt-card dsc-opt-card--${ config.variant }${ isGated ? ' dsc-opt-card--gated' : '' }` }
            style={ { borderLeftColor: config.accentColor } }
          >
            <div className={ `dsc-opt-card-inner${ isGated ? ' dsc-blurred' : '' }` }>

              <div className="dsc-opt-card-hdr">
                <div className="dsc-opt-card-hdr-left">
                  <span
                    className="dsc-opt-dot"
                    style={ { background: config.accentColor } }
                  />
                  <div>
                    <div className="dsc-opt-name" style={ { color: config.accentColor } }>
                      { t( `opt-${ config.id }-name` ) }
                    </div>
                    <div className="dsc-opt-badges">
                      { isRec && (
                        <span className="dsc-opt-badge dsc-opt-badge--rec">
                          { t( 'opt-badge-rec' ) }
                        </span>
                      ) }
                      { isNothing && (
                        <span className="dsc-opt-badge dsc-opt-badge--warning">
                          { t( 'opt-badge-warning' ) }
                        </span>
                      ) }
                    </div>
                  </div>
                </div>
                <div className="dsc-opt-total">
                  <div className="dsc-opt-total-amt" style={ { color: config.accentColor } }>
                    { fmtC( opt.total ) }
                  </div>
                  <div className="dsc-opt-total-lbl">total cost</div>
                </div>
              </div>

              <div className="dsc-opt-desc">
                { t( `opt-${ config.id }-desc` ) }
              </div>

              <div className="dsc-opt-stats">
                <div className="dsc-opt-stat">
                  <div className="dsc-opt-stat-val" style={ { color: config.accentColor } }>
                    { fmtC( opt.payment ) }
                  </div>
                  <div className="dsc-opt-stat-lbl">{ t( 'opt-stat-monthly' ) }</div>
                </div>
                <div className="dsc-opt-stat">
                  <div className="dsc-opt-stat-val" style={ { color: config.accentColor } }>
                    { yearsStr }
                  </div>
                  <div className="dsc-opt-stat-lbl">{ t( 'opt-stat-duration' ) }</div>
                </div>
                <div className="dsc-opt-stat">
                  <div className="dsc-opt-stat-val" style={ { color: config.accentColor } }>
                    { fmtC( opt.interestPaid ) }
                  </div>
                  <div className="dsc-opt-stat-lbl">{ t( 'opt-stat-interest' ) }</div>
                  <div className="dsc-opt-stat-sub">
                    { opt.interestPaid === 0
                      ? t( 'opt-stat-interest-zero' )
                      : t( 'opt-stat-interest-paid' ) }
                  </div>
                </div>
              </div>

              { detailRows.length > 0 && (
                <div className="dsc-opt-details">
                  { detailRows.map( ( row, i ) => (
                    <div key={ i } className="dsc-opt-detail-row">
                      <span className="dsc-opt-detail-lbl">{ row.label }</span>
                      <span className="dsc-opt-detail-val">{ row.value }</span>
                    </div>
                  ) ) }
                </div>
              ) }

              <div className={ `dsc-opt-proscons${ config.considerations.length > 0 ? ' dsc-opt-proscons--3col' : '' }` }>
                <div className="dsc-opt-pc-col">
                  <div className="dsc-opt-pc-lbl dsc-opt-pc-lbl--pro">
                    { isNothing ? t( 'opt-only-upside' ) : t( 'opt-what-works' ) }
                  </div>
                  { pros.map( key => (
                    <div key={ key } className="dsc-opt-pc-item dsc-opt-pc-item--pro">
                      <span className="dsc-opt-pc-icon">✓</span>{ t( key ) }
                    </div>
                  ) ) }
                </div>
                <div className="dsc-opt-pc-col">
                  <div className="dsc-opt-pc-lbl dsc-opt-pc-lbl--con">
                    { isNothing ? t( 'opt-reality' ) : t( 'opt-aware' ) }
                  </div>
                  { cons.map( key => (
                    <div key={ key } className="dsc-opt-pc-item dsc-opt-pc-item--con">
                      <span className="dsc-opt-pc-icon">✗</span>{ t( key ) }
                    </div>
                  ) ) }
                </div>
                { config.considerations.length > 0 && (
                  <div className="dsc-opt-pc-col">
                    <div className="dsc-opt-pc-lbl dsc-opt-pc-lbl--consider">
                      { t( 'opt-considerations' ) }
                    </div>
                    { config.considerations.map( key => (
                      <div key={ key } className="dsc-opt-pc-item dsc-opt-pc-item--consider">
                        <span className="dsc-opt-pc-icon dsc-opt-pc-icon--consider">→</span>
                        { t( key ) }
                      </div>
                    ) ) }
                  </div>
                ) }
              </div>

              <div className={ `dsc-opt-admin${ isNothing ? ' dsc-opt-admin--warning' : '' }` }>
                { t( adminKey ) }
              </div>

            </div>

            { isGated && (
              <div className="dsc-opt-gate-overlay">
                <div className="dsc-pay-gate-cta">
                  <p className="dsc-pay-gate-title">{ t( 'pay-unlock-title' ) }</p>
                  <p className="dsc-pay-gate-sub">{ t( 'pay-unlock-sub' ) }</p>

                  <div aria-hidden="true" style={ { position: 'absolute', left: '-9999px', height: '1px', overflow: 'hidden' } }>
                    <input type="text" name="website" value={ trap } onChange={ e => setTrap( e.target.value ) } tabIndex={ -1 } autoComplete="off" />
                  </div>

                  <div className="dsc-pay-gate-fields">
                    <input
                      className="dsc-pay-gate-input"
                      type="text"
                      value={ unlockName }
                      onChange={ e => setUnlockName( e.target.value ) }
                      placeholder={ t( 'pay-unlock-name' ) }
                    />
                    <input
                      className={ `dsc-pay-gate-input${ unlockError ? ' dsc-pay-gate-input--error' : '' }` }
                      type="email"
                      inputMode="email"
                      value={ unlockEmail }
                      onChange={ e => { setUnlockEmail( e.target.value ); setUnlockError( '' ); } }
                      placeholder={ t( 'pay-unlock-email' ) }
                      aria-invalid={ !! unlockError }
                    />
                  </div>

                  { unlockError && <p className="dsc-pay-gate-error">{ unlockError }</p> }

                  <button
                    className="dsc-pay-gate-btn"
                    type="button"
                    onClick={ handleUnlock }
                    disabled={ unlocking }
                  >
                    { unlocking ? '...' : t( 'pay-unlock-cta' ) }
                  </button>

                  <p className="dsc-pay-gate-trust">{ t( 'pay-unlock-trust' ) }</p>
                </div>
              </div>
            ) }

          </div>
        );
      } ) }
    </div>
  );
}
