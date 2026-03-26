import { useState } from '@wordpress/element';
import { getT }     from '../lib/i18n';
import { fmtC }     from '../lib/calculator';

export default function CTASection({ results, lang }) {
  const t = getT(lang);

  const [modalOpen,  setModalOpen]  = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name,       setName]       = useState('');
  const [email,      setEmail]      = useState('');
  const [phone,      setPhone]      = useState('');
  const [callTime,   setCallTime]   = useState('morning');
  const [errors,     setErrors]     = useState({});

  const proposal  = results.options.find(o => o.id === 'proposal');
  const firmName  = window.dsCalcData?.firmName  ?? 'Doyle Salewski';
  const firmPhone = window.dsCalcData?.firmPhone ?? '(613) 237-5555';
  const restUrl   = window.dsCalcData?.restUrl   ?? '';
  const restNonce = window.dsCalcData?.restNonce ?? '';

  function handleSavePDF() {
    window.print();
  }

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
    };

    try {
      const response = await fetch(`${restUrl}lead`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce':   restNonce,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        setSubmitted(true);
        console.warn('Lead submission failed silently', await response.text());
      }
    } catch (err) {
      setSubmitted(true);
      console.warn('Lead submission network error', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dsc-cta-wrap">

      <div className="dsc-cta-banner">
        <div className="dsc-cta-circle dsc-cta-circle--1" />
        <div className="dsc-cta-circle dsc-cta-circle--2" />

        <div className="dsc-cta-eyebrow">{t('cta-eyebrow')}</div>
        <h2 className="dsc-cta-title">{t('cta-title')}</h2>
        <p className="dsc-cta-sub">{t('cta-sub')}</p>

        <div className="dsc-cta-btns">
          <button
            className="dsc-cta-btn-primary"
            type="button"
            onClick={() => setModalOpen(true)}
          >
            {t('cta-btn-book')}
          </button>
          <button
            className="dsc-cta-btn-secondary"
            type="button"
            onClick={handleSavePDF}
          >
            {t('cta-btn-pdf')}
          </button>
        </div>

        <div className="dsc-cta-trust">
          <span className="dsc-cta-trust-item">✓ {t('cta-trust-1')}</span>
          <span className="dsc-cta-trust-sep" />
          <span className="dsc-cta-trust-item">✓ {t('cta-trust-2')}</span>
          <span className="dsc-cta-trust-sep" />
          <span className="dsc-cta-trust-item">✓ {t('cta-trust-3')}</span>
        </div>
      </div>

      <div className="dsc-cta-phone-strip">
        <div className="dsc-cta-phone-text">
          <strong>{t('cta-phone-label')}</strong> {t('cta-phone-hours')}
        </div>
        <a
          href={`tel:${firmPhone.replace(/\D/g, '')}`}
          className="dsc-cta-phone-link"
        >
          {firmPhone}
        </a>
      </div>

      {/* Modal overlay */}
      <div
        className={`dsc-modal-overlay${modalOpen ? ' dsc-modal-overlay--open' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
      >
        <div className="dsc-modal">

          <button
            className="dsc-modal-close"
            type="button"
            onClick={() => setModalOpen(false)}
            aria-label="Close"
          >
            ✕
          </button>

          {!submitted ? (
            <div className="dsc-modal-form">
              <span className="dsc-modal-badge">{t('cta-modal-badge')}</span>
              <h3 className="dsc-modal-title">{t('cta-modal-title')}</h3>
              <p className="dsc-modal-sub">{t('cta-modal-sub')}</p>

              <div className="dsc-modal-summary">
                <div className="dsc-modal-summary-dot" />
                <span>
                  {t('cta-modal-summary-a')}{' '}
                  <strong>{fmtC(results.debt)}</strong>{' '}
                  {t('cta-modal-summary-b')}{' '}
                  <strong>{t('cta-modal-summary-proposal')} {fmtC(proposal?.payment ?? 0)}/mo</strong>
                </span>
              </div>

              <div className="dsc-modal-field">
                <label className="dsc-modal-label">{t('cta-field-name')}</label>
                <input
                  className={`dsc-modal-input${errors.name ? ' dsc-modal-input--error' : ''}`}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('cta-field-name-placeholder')}
                />
                {errors.name && (
                  <span className="dsc-modal-error">{errors.name}</span>
                )}
              </div>

              <div className="dsc-modal-field">
                <label className="dsc-modal-label">{t('cta-field-email')}</label>
                <input
                  className={`dsc-modal-input${errors.email ? ' dsc-modal-input--error' : ''}`}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('cta-field-email-placeholder')}
                />
                {errors.email && (
                  <span className="dsc-modal-error">{errors.email}</span>
                )}
              </div>

              <div className="dsc-modal-field">
                <label className="dsc-modal-label">
                  {t('cta-field-phone')}{' '}
                  <span className="dsc-modal-label-opt">{t('cta-field-optional')}</span>
                </label>
                <input
                  className="dsc-modal-input"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t('cta-field-phone-placeholder')}
                />
              </div>

              <div className="dsc-modal-field">
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
                className="dsc-modal-submit"
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? t('cta-submitting') : t('cta-submit')}
              </button>

              <p className="dsc-modal-privacy">
                🔒 {t('cta-privacy')}
              </p>
            </div>

          ) : (

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
              <a
                href={`tel:${firmPhone.replace(/\D/g, '')}`}
                className="dsc-modal-success-phone"
              >
                {firmPhone}
              </a>
              <button
                className="dsc-modal-success-close"
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setTimeout(() => setSubmitted(false), 300);
                }}
              >
                {t('cta-close')}
              </button>
            </div>

          )}
        </div>
      </div>

    </div>
  );
}
