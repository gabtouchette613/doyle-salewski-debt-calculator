import { getT } from '../lib/i18n';
import { fmtC } from '../lib/calculator';

export default function PaymentCards({ results, lang }) {
  const t = getT(lang);

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

          return (
            <div
              key={opt.id}
              className={`dsc-pay-card-outer${isRec ? ' dsc-pay-card-outer--recommended' : ''}`}
            >
              {isRec && (
                <div className="dsc-pay-best-wrap">
                  <span className="dsc-pay-best-badge">{t('pay-best')}</span>
                </div>
              )}
              <div
                className={[
                  'dsc-pay-card',
                  isRec     ? 'dsc-pay-card--recommended' : '',
                  isNothing ? 'dsc-pay-card--nothing'     : '',
                ].join(' ').trim()}
              >
                <div className="dsc-pay-card-name" style={{ color }}>
                  {name}
                </div>
                <div className="dsc-pay-card-amount" style={{ color }}>
                  {fmtC(opt.payment)}
                </div>
                <div className="dsc-pay-card-per" style={{ color }}>
                  {t('pay-per-month')}
                </div>
                <div className="dsc-pay-card-detail">
                  {t('pay-done-in')} <strong>{durYrs === 1 ? `1 ${t('pay-year')}` : `${durYrs} ${t('pay-years')}`}</strong><br />
                  {t('pay-total-paid')} <strong>{fmtC(opt.total)}</strong><br />
                  <strong>{pctIncome}%</strong> {t('pay-of-income')}
                </div>
                {inBudget && (
                  <span className="dsc-pay-within-badge">✓ {t('pay-within')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
