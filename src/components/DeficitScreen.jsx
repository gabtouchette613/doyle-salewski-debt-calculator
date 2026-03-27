import { useState } from '@wordpress/element';
import { getT }     from '../lib/i18n';
import { fmtC }     from '../lib/calculator';

export default function DeficitScreen({ results, lang, onReset }) {
  const t = getT(lang);

  const [name,       setName]       = useState('');
  const [email,      setEmail]      = useState('');
  const [phone,      setPhone]      = useState('');
  const [callTime,   setCallTime]   = useState('morning');
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [trap,       setTrap]       = useState('');

  const firmPhone = window.dsCalcData?.firmPhone ?? '(613) 237-5555';
  const restUrl   = window.dsCalcData?.restUrl   ?? '';
  const restNonce = window.dsCalcData?.restNonce ?? '';
  const logoUrl   = window.dsCalcData?.logoUrl   ?? '';

  const deficit     = Math.abs(results.afterInterest);
  const dateStr     = new Date().toLocaleDateString(
    lang === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  function validate() {
    const errs = {};
    if (!name.trim())  errs.name  = t('cta-error-name');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = t('cta-error-email');
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);

    const payload = {
      name,
      email,
      phone,
      call_time:           callTime,
      website:             trap,
      debt:                results.debt,
      income:              results.income,
      expenses:            results.expenses,
      province:            results.province,
      surplus:             results.surplus,
      dti:                 results.dti,
      annual_rate:         results.annualRate,
      is_advanced:         results.isAdvancedRate,
      recommended_payment: 0,
      recommended_total:   0,
      lang,
    };

    try {
      await fetch(`${restUrl}lead`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce':   restNonce,
        },
        body: JSON.stringify(payload),
      });
    } catch (_) {}

    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <div className="dsc-deficit-wrap">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="dsc-deficit-header-bar">
        <div className="dsc-deficit-header-left">
          <div className="dsc-report-icon-wrap">
            {logoUrl
              ? <img src={logoUrl} alt="Doyle Salewski" className="dsc-report-logo" />
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
            <div className="dsc-report-title">{t('rep-title')}</div>
            <div className="dsc-report-subtitle">
              {results.province} · {t('rep-subtitle')} · {dateStr}
            </div>
          </div>
        </div>
        <button className="dsc-report-action-btn" onClick={onReset}>
          {t('r-start-over')}
        </button>
      </div>

      {/* ── Hero deficit card ─────────────────────────────────────── */}
      <div className="dsc-deficit-hero">

        <div className="dsc-deficit-hero-top">

          {/* Left: hero number */}
          <div className="dsc-deficit-hero-left">
            <div className="dsc-deficit-eyebrow">
              <span className="dsc-deficit-eyebrow-dot" />
              <span className="dsc-deficit-eyebrow-text">
                {t('deficit-eyebrow')}
              </span>
            </div>
            <div className="dsc-deficit-lbl">{t('deficit-hero-lbl')}</div>
            <div className="dsc-deficit-number">
              -{fmtC(deficit)}
            </div>
            <div className="dsc-deficit-number-sub">
              {t('deficit-hero-sub-a')}{' '}
              <strong>-{fmtC(deficit)} {t('deficit-hero-sub-b')}</strong>{' '}
              {t('deficit-hero-sub-c')}
            </div>
          </div>

          {/* Right: the math */}
          <div className="dsc-deficit-math">
            <div className="dsc-deficit-math-row">
              <span>{t('deficit-math-income')}</span>
              <span className="dsc-deficit-math-val">{fmtC(results.income)}</span>
            </div>
            <div className="dsc-deficit-math-row">
              <span>{t('deficit-math-expenses')}</span>
              <span className="dsc-deficit-math-val dsc-val-danger">-{fmtC(results.expenses)}</span>
            </div>
            <div className="dsc-deficit-math-row">
              <span>{t('deficit-math-interest')}</span>
              <span className="dsc-deficit-math-val dsc-val-danger">-{fmtC(results.monthlyInterest)}</span>
            </div>
            <div className="dsc-deficit-math-total">
              <span>{t('deficit-math-total')}</span>
              <span>-{fmtC(deficit)} / mo</span>
            </div>
          </div>

        </div>

        {/* Three key stats */}
        <div className="dsc-deficit-stats">
          <div className="dsc-deficit-stat">
            <div className="dsc-deficit-stat-lbl">{t('rep-metric-debt')}</div>
            <div className="dsc-deficit-stat-val dsc-val-danger">{fmtC(results.debt)}</div>
            <div className="dsc-deficit-stat-sub">{t('rep-metric-debt-sub')}</div>
          </div>
          <div className="dsc-deficit-stat">
            <div className="dsc-deficit-stat-lbl">{t('deficit-stat-annual')}</div>
            <div className="dsc-deficit-stat-val dsc-val-danger">{fmtC(results.annualInterest)}</div>
            <div className="dsc-deficit-stat-sub">{t('deficit-stat-annual-sub')}</div>
          </div>
          <div className="dsc-deficit-stat">
            <div className="dsc-deficit-stat-lbl">{t('rep-metric-dti')}</div>
            <div className="dsc-deficit-stat-val" style={{ color: 'var(--dsc-warning)' }}>
              {results.dti}%
            </div>
            <div className="dsc-deficit-stat-sub">{t('rep-metric-dti-target')}</div>
          </div>
        </div>

      </div>

      {/* ── What this means ───────────────────────────────────────── */}
      <div className="dsc-deficit-means">
        <div className="dsc-deficit-means-title">{t('deficit-means-title')}</div>

        <div className="dsc-deficit-means-item">
          <div className="dsc-deficit-means-icon dsc-deficit-means-icon--warn">⚠️</div>
          <div>
            <strong>{t('deficit-means-1-title')}</strong>{' '}
            {t('deficit-means-1-body').replace('{interest}', fmtC(results.monthlyInterest))}
          </div>
        </div>

        <div className="dsc-deficit-means-item">
          <div className="dsc-deficit-means-icon dsc-deficit-means-icon--info">ℹ️</div>
          <div>
            <strong>{t('deficit-means-2-title')}</strong>{' '}
            {t('deficit-means-2-body')}
          </div>
        </div>

        <div className="dsc-deficit-means-item">
          <div className="dsc-deficit-means-icon dsc-deficit-means-icon--ok">✅</div>
          <div>
            <strong>{t('deficit-means-3-title')}</strong>{' '}
            {t('deficit-means-3-body')}
          </div>
        </div>
      </div>

      {/* ── Inline consultation form ──────────────────────────────── */}
      <div className="dsc-deficit-consult">

        <div className="dsc-deficit-consult-hdr">
          <span className="dsc-deficit-consult-badge">{t('cta-modal-badge')}</span>
          <div className="dsc-deficit-consult-title">{t('deficit-form-title')}</div>
          <div className="dsc-deficit-consult-sub">{t('deficit-form-sub')}</div>
        </div>

        <div className="dsc-deficit-consult-body">

          {/* Summary strip */}
          <div className="dsc-deficit-consult-summary">
            <div className="dsc-deficit-consult-summary-dot" />
            <span>
              {t('cta-modal-summary-a')}{' '}
              <strong>{fmtC(results.debt)}</strong>{' '}
              {t('deficit-form-summary-b')}{' '}
              <strong>-{fmtC(deficit)}/mo</strong>
            </span>
          </div>

          {!submitted ? (
            <>
              {/* Honeypot */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: '1px', overflow: 'hidden' }}>
                <input type="text" name="website" value={trap} onChange={e => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" />
              </div>

              {/* Name + Phone */}
              <div className="dsc-deficit-field-row">
                <div className="dsc-deficit-field">
                  <label className="dsc-modal-label">{t('cta-field-name')}</label>
                  <input
                    className={`dsc-modal-input${errors.name ? ' dsc-modal-input--error' : ''}`}
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('cta-field-name-placeholder')}
                  />
                  {errors.name && <span className="dsc-modal-error">{errors.name}</span>}
                </div>
                <div className="dsc-deficit-field">
                  <label className="dsc-modal-label">
                    {t('cta-field-phone')}{' '}
                    <span style={{ color: 'var(--dsc-gray-400)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      {t('cta-field-optional')}
                    </span>
                  </label>
                  <input
                    className="dsc-modal-input"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={t('cta-field-phone-placeholder')}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="dsc-deficit-field">
                <label className="dsc-modal-label">{t('cta-field-email')}</label>
                <input
                  className={`dsc-modal-input${errors.email ? ' dsc-modal-input--error' : ''}`}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('cta-field-email-placeholder')}
                />
                {errors.email && <span className="dsc-modal-error">{errors.email}</span>}
              </div>

              {/* Call time */}
              <div className="dsc-deficit-field">
                <label className="dsc-modal-label">{t('cta-field-call-time')}</label>
                <select
                  className="dsc-modal-select"
                  value={callTime}
                  onChange={e => setCallTime(e.target.value)}
                >
                  <option value="morning">{t('cta-time-morning')}</option>
                  <option value="afternoon">{t('cta-time-afternoon')}</option>
                  <option value="evening">{t('cta-time-evening')}</option>
                </select>
              </div>

              <button
                className="dsc-deficit-submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? t('cta-submitting') : t('cta-submit')}
              </button>

              <p className="dsc-modal-privacy">🔒 {t('cta-privacy')}</p>
            </>
          ) : (
            /* Success state */
            <div className="dsc-modal-success">
              <div className="dsc-modal-success-ring">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="#16a34a" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h3 className="dsc-modal-success-title">{t('cta-success-title')}</h3>
              <p className="dsc-modal-success-sub">{t('cta-success-sub')}</p>
              <a href={`tel:${firmPhone.replace(/\D/g, '')}`} className="dsc-modal-success-phone">
                {firmPhone}
              </a>
            </div>
          )}

        </div>
      </div>

      {/* ── Trust strip ───────────────────────────────────────────── */}
      <div className="dsc-deficit-trust">
        <span className="dsc-cta-trust-item">✓ {t('cta-trust-1')}</span>
        <span className="dsc-cta-trust-sep" />
        <span className="dsc-cta-trust-item">✓ {t('cta-trust-2')}</span>
        <span className="dsc-cta-trust-sep" />
        <span className="dsc-cta-trust-item">✓ {t('cta-trust-3')}</span>
      </div>

      {/* ── Phone strip ───────────────────────────────────────────── */}
      <div className="dsc-cta-phone-strip">
        <div className="dsc-cta-phone-text">
          <strong>{t('cta-phone-label')}</strong>
          {t('cta-phone-hours')}
        </div>
        <a
          href={`tel:${firmPhone.replace(/\D/g, '')}`}
          className="dsc-cta-phone-link"
        >
          {firmPhone}
        </a>
      </div>

    </div>
  );
}
