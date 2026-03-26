import { useState } from '@wordpress/element';
import { getT } from '../lib/i18n';
import { fmtC } from '../lib/calculator';

const GATED_IDS = new Set(['proposal']);

export default function PaymentCards({ results, lang, unlocked, onUnlock }) {
  const t = getT(lang);

  const [unlockEmail, setUnlockEmail] = useState('');
  const [unlockName,  setUnlockName]  = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking,   setUnlocking]   = useState(false);
  const [trap,        setTrap]        = useState('');

  async function handleUnlock() {
    if (!unlockEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(unlockEmail)) {
      setUnlockError(t('pay-unlock-email-error'));
      return;
    }
    setUnlockError('');
    setUnlocking(true);
    const restUrl   = window.dsCalcData?.restUrl   ?? '';
    const restNonce = window.dsCalcData?.restNonce ?? '';
    const proposal  = results.options.find(o => o.id === 'proposal');
    try {
      await fetch(`${restUrl}lead`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': restNonce },
        body: JSON.stringify({
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
        }),
      });
    } catch (_) {}
    setUnlocking(false);
    onUnlock();
  }

  const DISPLAY_ORDER = ['proposal', 'dmp', 'consolidation', 'nothing'];
  const cards = DISPLAY_ORDER
    .map(id => results.options.find(o => o.id === id))
    .filter(Boolean)
    .sort((a, b) => a.payment - b.payment);

  const withinBudget  = cards.filter(c => c.payment <= results.surplus);
  const proposal      = cards.find(c => c.id === 'proposal');
  const proposalSpare = results.surplus > 0
    ? Math.max(0, results.surplus - (proposal?.payment ?? 0))
    : 0;

  const CARD_COLORS = {
    proposal:      '#1061ED',
    dmp:           '#d97706',
    consolidation: '#0891b2',
    nothing:       '#dc2626',
  };

  const CARD_NAMES = {
    proposal:      lang === 'fr' ? 'Proposition'   : 'Proposal',
    dmp:           lang === 'fr' ? 'Gestion'        : 'Debt Mgmt',
    consolidation: lang === 'fr' ? 'Consolidation'  : 'Consolidation',
    nothing:       lang === 'fr' ? 'Rien faire'     : 'Do Nothing',
  };

  return (
    <div className="dsc-pay-outer">
      <div className="dsc-pay-section-title">{t('pay-title')}</div>
      <div className="dsc-pay-section-sub">
        {t('pay-sub-prefix')}{' '}
        <span className="dsc-pay-surplus-val">{fmtC(results.surplus)}/mo</span>.
      </div>

      {results.surplus > 0 && (
        <div className="dsc-pay-budget-banner">
          <div className="dsc-pay-budget-dot" />
          <div>
            {t('pay-banner-a')}{' '}
            <strong>{fmtC(results.surplus)}/mo</strong>{' '}
            {t('pay-banner-b')}
          </div>
        </div>
      )}

      <div className="dsc-pay-grid">
        {cards.map(opt => {
          const color     = CARD_COLORS[opt.id] ?? '#374151';
          const name      = CARD_NAMES[opt.id]  ?? opt.id;
          const isRec     = opt.id === 'proposal';
          const isNothing = opt.id === 'nothing';
          const inBudget  = results.surplus > 0 && opt.payment <= results.surplus;
          const pctIncome = results.income > 0
            ? Math.round((opt.payment / results.income) * 100)
            : 0;
          const durYrs = Math.round(opt.months / 12);
          const isGated = !unlocked && GATED_IDS.has(opt.id);

          return (
            <div
              key={opt.id}
              className={`dsc-pay-card-outer${isRec ? ' dsc-pay-card-outer--recommended' : ''}`}
            >
              {isRec && !isGated && (
                <div className="dsc-pay-best-wrap">
                  <span className="dsc-pay-best-badge">{t('pay-best')}</span>
                </div>
              )}
              <div
                className={[
                  'dsc-pay-card',
                  isRec     ? 'dsc-pay-card--recommended' : '',
                  isNothing ? 'dsc-pay-card--nothing'     : '',
                  isGated   ? 'dsc-pay-card--gated'       : '',
                ].join(' ').trim()}
              >
                <div className="dsc-pay-card-name" style={{ color }}>
                  {name}
                </div>
                <div className={`dsc-pay-card-amount${isGated ? ' dsc-blurred' : ''}`} style={{ color }}>
                  {fmtC(opt.payment)}
                </div>
                <div className={`dsc-pay-card-per${isGated ? ' dsc-blurred' : ''}`} style={{ color }}>
                  {t('pay-per-month')}
                </div>
                <div className={`dsc-pay-card-detail${isGated ? ' dsc-blurred' : ''}`}>
                  {t('pay-done-in')} <strong>{durYrs === 1 ? `1 ${t('pay-year')}` : `${durYrs} ${t('pay-years')}`}</strong><br />
                  {t('pay-total-paid')} <strong>{fmtC(opt.total)}</strong><br />
                  <strong>{pctIncome}%</strong> {t('pay-of-income')}
                </div>
                {inBudget && !isGated && (
                  <span className="dsc-pay-within-badge">✓ {t('pay-within')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!unlocked && (
        <div className="dsc-pay-gate-cta">
          <p className="dsc-pay-gate-title">{t('pay-unlock-title')}</p>
          <p className="dsc-pay-gate-sub">{t('pay-unlock-sub')}</p>

          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: '1px', overflow: 'hidden' }}>
            <input type="text" name="website" value={trap} onChange={e => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" />
          </div>

          <div className="dsc-pay-gate-fields">
            <input
              className="dsc-pay-gate-input"
              type="text"
              value={unlockName}
              onChange={e => setUnlockName(e.target.value)}
              placeholder={t('pay-unlock-name')}
            />
            <input
              className={`dsc-pay-gate-input${unlockError ? ' dsc-pay-gate-input--error' : ''}`}
              type="email"
              inputMode="email"
              value={unlockEmail}
              onChange={e => { setUnlockEmail(e.target.value); setUnlockError(''); }}
              placeholder={t('pay-unlock-email')}
              aria-invalid={!!unlockError}
            />
          </div>

          {unlockError && <p className="dsc-pay-gate-error">{unlockError}</p>}

          <button
            className="dsc-pay-gate-btn"
            type="button"
            onClick={handleUnlock}
            disabled={unlocking}
          >
            {unlocking ? '...' : t('pay-unlock-cta')}
          </button>

          <p className="dsc-pay-gate-trust">{t('pay-unlock-trust')}</p>
        </div>
      )}

      <div className="dsc-pay-footer">
        <span className="dsc-pay-footer-star">★</span>
        <span>
          <strong>{withinBudget.length} {t('pay-footer-of')} {cards.length}</strong>{' '}
          {t('pay-footer-fit')}{' '}
          <strong>{fmtC(results.surplus)}/mo</strong>{' '}
          {t('pay-footer-surplus')}.
          {proposal && proposalSpare > 0 && (
            <> {t('pay-footer-proposal')}{' '}
            <strong>{fmtC(proposal.payment)}/mo</strong>{' '}
            {t('pay-footer-leaves')}{' '}
            <strong>{fmtC(proposalSpare)}/mo {t('pay-footer-spare')}</strong>.</>
          )}
        </span>
      </div>
    </div>
  );
}
