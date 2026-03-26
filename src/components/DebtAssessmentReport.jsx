import { fmtC } from '../lib/calculator';
import { getT } from '../lib/i18n';

export default function DebtAssessmentReport( { results, lang, onReset, onSavePDF } ) {
  const t = getT( lang );

  const dtiLevel = results.dti > 80 ? 'critical'
    : results.dti > 43 ? 'high'
    : results.dti > 36 ? 'elevated'
    : 'ok';

  const dtiColor = results.dti > 43 ? 'var(--dsc-danger)'
    : results.dti > 36 ? 'var(--dsc-warning)'
    : 'var(--dsc-success)';

  const dtiFlagKey = ( dtiLevel === 'critical' || dtiLevel === 'high' )
    ? 'rep-flag-critical'
    : dtiLevel === 'elevated'
      ? 'rep-flag-elevated'
      : 'rep-flag-ok';

  const dtiFlagVariant = ( dtiLevel === 'critical' || dtiLevel === 'high' )
    ? 'danger'
    : dtiLevel === 'elevated'
      ? 'warning'
      : 'success';

  const nothing      = results.options.find( o => o.id === 'nothing' );
  const nothingYears = Math.round( nothing.months / 12 );
  const afterInterest = results.surplus - results.monthlyInterest;

  const rateStr = ( results.annualRate * 100 ).toFixed( 2 );
  const rateNote = results.isAdvancedRate
    ? t( 'rep-table-rate-blended' ).replace( '{rate}', rateStr )
    : t( 'rep-table-rate-est' ).replace( '{rate}', rateStr );

  const logoUrl = window.dsCalcData?.logoUrl ?? '';
  const dateStr = new Date().toLocaleDateString(
    lang === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <div className="dsc-report-card">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="dsc-report-header">

        {/* Left: logo + title + subtitle + date */}
        <div className="dsc-report-header-left">
          <div className="dsc-report-icon-wrap">
            { logoUrl
              ? <img src={ logoUrl } alt="Doyle Salewski" className="dsc-report-logo" />
              : (
                <div className="dsc-report-icon">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none"
                    stroke="#fff" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="2" y="2" width="12" height="12" rx="2"/>
                    <path d="M5 6h6M5 9h4"/>
                  </svg>
                </div>
              )
            }
          </div>
          <div>
            <div className="dsc-report-title">{ t( 'rep-title' ) }</div>
            <div className="dsc-report-subtitle">
              { results.province } · { t( 'rep-subtitle' ) } · { dateStr }
            </div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="dsc-report-header-actions">
          { onReset && (
            <button className="dsc-report-action-btn" type="button" onClick={ onReset }>
              { t( 'r-start-over' ) }
            </button>
          ) }
          { onSavePDF && (
            <button className="dsc-report-action-btn dsc-report-action-btn--primary" type="button" onClick={ onSavePDF }>
              { t( 'r-save-pdf' ) }
            </button>
          ) }
        </div>

      </div>

      {/* ── Metric tiles ────────────────────────────────────────── */}
      <div className="dsc-report-metrics">

        <div className="dsc-report-metric">
          <div className="dsc-report-metric-top">
            <span className="dsc-report-metric-lbl">{ t( 'rep-metric-debt' ) }</span>
            <span className="dsc-report-flag dsc-report-flag--danger">{ t( 'rep-flag-high' ) }</span>
          </div>
          <div className="dsc-report-metric-val dsc-val-danger">{ fmtC( results.debt ) }</div>
          <div className="dsc-report-metric-sub">{ t( 'rep-metric-debt-sub' ) }</div>
        </div>

        <div className="dsc-report-metric">
          <div className="dsc-report-metric-top">
            <span className="dsc-report-metric-lbl">{ t( 'rep-metric-interest' ) }</span>
            <span className="dsc-report-flag dsc-report-flag--danger">{ t( 'rep-flag-critical' ) }</span>
          </div>
          <div className="dsc-report-metric-val dsc-val-danger">{ fmtC( results.monthlyInterest ) }</div>
          <div className="dsc-report-metric-sub">{ t( 'rep-metric-interest-sub' ) }</div>
        </div>

        <div className="dsc-report-metric">
          <div className="dsc-report-metric-top">
            <span className="dsc-report-metric-lbl">{ t( 'rep-metric-dti' ) }</span>
            <span className={ `dsc-report-flag dsc-report-flag--${ dtiFlagVariant }` }>
              { t( dtiFlagKey ) }
            </span>
          </div>
          <div className="dsc-report-metric-val" style={ { color: dtiColor } }>
            { results.dti }%
          </div>
          <div className="dsc-report-metric-sub">{ t( 'rep-metric-dti-sub' ) }</div>
        </div>

        <div className="dsc-report-metric">
          <div className="dsc-report-metric-top">
            <span className="dsc-report-metric-lbl">{ t( 'rep-metric-surplus' ) }</span>
            <span className="dsc-report-flag dsc-report-flag--success">{ t( 'rep-flag-available' ) }</span>
          </div>
          <div className="dsc-report-metric-val dsc-val-success">{ fmtC( results.surplus ) }</div>
          <div className="dsc-report-metric-sub">{ t( 'rep-metric-surplus-sub' ) }</div>
        </div>

      </div>

      {/* ── Detail rows ──────────────────────────────────────────── */}
      <div className="dsc-report-rows">
        <div className="dsc-report-rows-head">
          <span>{ t( 'rep-table-item' ) }</span>
          <span>{ t( 'rep-table-amount' ) }</span>
        </div>
        <div className="dsc-report-row">
          <span className="dsc-report-row-lbl">{ t( 'rep-table-income' ) }</span>
          <span className="dsc-report-row-val">{ fmtC( results.income ) }</span>
        </div>
        <div className="dsc-report-row">
          <span className="dsc-report-row-lbl">{ t( 'rep-table-expenses' ) }</span>
          <span className="dsc-report-row-val dsc-val-danger">{ `\u2212\u00a0${ fmtC( results.expenses ) }` }</span>
        </div>
        <div className="dsc-report-row">
          <span className="dsc-report-row-lbl">
            { t( 'rep-table-interest' ) }
            <span className="dsc-report-row-note">{ rateNote }</span>
          </span>
          <span className="dsc-report-row-val dsc-val-danger">{ `\u2212\u00a0${ fmtC( results.monthlyInterest ) }` }</span>
        </div>
        <div className="dsc-report-row dsc-report-row--total">
          <span className="dsc-report-row-lbl">{ t( 'rep-table-remaining' ) }</span>
          <span className={ `dsc-report-row-val ${ afterInterest >= 0 ? 'dsc-val-success' : 'dsc-val-danger' }` }>
            { afterInterest >= 0
              ? `${ fmtC( afterInterest ) }\u00a0/\u00a0mo`
              : `\u2212\u00a0${ fmtC( Math.abs( afterInterest ) ) }\u00a0/\u00a0mo`
            }
          </span>
        </div>
        <div className="dsc-report-row">
          <span className="dsc-report-row-lbl">{ t( 'rep-table-annual' ) }</span>
          <span className="dsc-report-row-val dsc-val-danger">{ fmtC( results.annualInterest ) }</span>
        </div>
        <div className="dsc-report-row">
          <span className="dsc-report-row-lbl">{ t( 'rep-table-dti-share' ) }</span>
          <span className="dsc-report-row-val dsc-val-danger">{ `${ results.dti }%` }</span>
        </div>
        <div className="dsc-report-row">
          <span className="dsc-report-row-lbl">{ t( 'rep-table-nothing' ) }</span>
          <span className="dsc-report-row-val dsc-val-danger">
            { `${ fmtC( nothing.total ) }\u00a0\u00b7\u00a0${ nothingYears }\u00a0${ t( 'rep-nothing-years' ) }` }
          </span>
        </div>
      </div>

      {/* ── DTI bar ──────────────────────────────────────────────── */}
      <div className="dsc-dti-wrap">
        <div className="dsc-dti-header">
          <span className="dsc-dti-label">{ t( 'rep-dti-label' ) }</span>
          <div className="dsc-dti-readout">
            <span className="dsc-dti-pct" style={ { color: dtiColor } }>{ results.dti }%</span>
            <span className={ `dsc-dti-verdict dsc-dti-verdict--${ dtiLevel }` }>
              { t( `rep-dti-${ dtiLevel }` ) }
            </span>
          </div>
        </div>
        <div className="dsc-dti-track">
          <div className="dsc-dti-zones">
            <div className="dsc-dti-zone dsc-dti-zone--ok" />
            <div className="dsc-dti-zone dsc-dti-zone--warn" />
            <div className="dsc-dti-zone dsc-dti-zone--high" />
            <div className="dsc-dti-zone dsc-dti-zone--crit" />
          </div>
          <div
            className="dsc-dti-dot"
            style={ { left: `${ Math.min( results.dti, 100 ) }%` } }
          />
        </div>
        <div className="dsc-dti-ticks">
          <span>0%</span>
          <span>{ t( 'rep-dti-tick-healthy' ) }</span>
          <span>{ t( 'rep-dti-tick-high' ) }</span>
          <span>100%</span>
        </div>
      </div>

      {/* ── Assumption bar ───────────────────────────────────────── */}
      <div className="dsc-report-assumption">
        <span className="dsc-report-assumption-dot" />
        <span className="dsc-report-assumption-text">
          { results.isAdvancedRate
            ? t( 'rep-assumption-blended' ).replace( '{rate}', rateStr )
            : t( 'rep-assumption-est' ).replace( '{rate}', rateStr )
          }
        </span>
        <button
          className="dsc-report-assumption-link"
          type="button"
          onClick={ () => {} }
        >
          { t( 'rep-assumption-refine' ) }
        </button>
      </div>

    </div>
  );
}
