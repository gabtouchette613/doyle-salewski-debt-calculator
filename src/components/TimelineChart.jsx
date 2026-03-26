import { useState, useEffect } from '@wordpress/element';
import { getT } from '../lib/i18n';
import { fmtC } from '../lib/calculator';

const ROWS = [
  { id: 'proposal',      color: '#1061ED' },
  { id: 'dmp',           color: '#d97706' },
  { id: 'consolidation', color: '#0891b2' },
  { id: 'nothing',       color: '#dc2626' },
];
// NO BANKRUPTCY — this list is final

const OPTION_NAMES = {
  proposal:      { en: 'Consumer Proposal',  fr: 'Proposition de consommateur' },
  dmp:           { en: 'Debt Mgmt Plan',     fr: 'Plan de gestion de dettes'   },
  consolidation: { en: 'Consolidation Loan', fr: 'Prêt de consolidation'       },
  nothing:       { en: 'Do Nothing',         fr: 'Ne rien faire'               },
};

export default function TimelineChart({ results, lang }) {
  const t = getT(lang);
  const NOW = new Date().getFullYear();
  const [animated, setAnimated] = useState(ROWS.map(() => false));

  const nothing  = results.options.find(o => o.id === 'nothing');
  const proposal = results.options.find(o => o.id === 'proposal');
  const maxMonths = nothing.months;

  useEffect(() => {
    const timers = [];
    ROWS.forEach((_, i) => {
      const timer = setTimeout(() => {
        setAnimated(prev => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, 200 + i * 180);
      timers.push(timer);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const axisPoints = [0, 0.25, 0.5, 0.75, 1].map(s => {
    const mo = Math.round(s * maxMonths);
    return s === 0 ? NOW : NOW + Math.floor(mo / 12);
  });

  const savedAmt = nothing.total - proposal.total;
  const propYrs  = Math.round(proposal.months / 12);
  const nothYrs  = Math.round(nothing.months / 12);

  return (
    <div className="dsc-tl-card">
      <div className="dsc-tl-header">
        <div className="dsc-tl-title">{t('tl-title')}</div>
        <div className="dsc-tl-sub">{t('tl-chart-sub')}</div>
      </div>

      <div className="dsc-tl-body">
        {ROWS.map((cfg, index) => {
          const opt = results.options.find(o => o.id === cfg.id);
          if (!opt) return null;

          const barPct  = Math.min((opt.months / maxMonths) * 100, 100).toFixed(1);
          const isNothing = cfg.id === 'nothing';
          const fillBg  = isNothing ? cfg.color : cfg.color + 'cc';
          const optName = OPTION_NAMES[cfg.id]?.[lang] ?? OPTION_NAMES[cfg.id]?.en;
          const durMo   = opt.months;
          const durLabel = durMo < 12
            ? `${durMo} mo`
            : durMo % 12 === 0
              ? `${Math.floor(durMo / 12)} yr`
              : `${Math.floor(durMo / 12)}yr ${durMo % 12}mo`;

          return (
            <div key={cfg.id} className="dsc-tl-row">
              <div className="dsc-tl-label">
                <div className="dsc-tl-label-name" style={{ color: cfg.color }}>
                  {optName}
                </div>
                <div className="dsc-tl-label-amt">
                  {fmtC(opt.total)} {t('tl-total')} · {fmtC(opt.payment)}/mo
                </div>
              </div>

              <div className="dsc-tl-track">
                {/* TODAY marker — first row only */}
                {index === 0 && (
                  <div className="dsc-tl-today">
                    <div className="dsc-tl-today-lbl">Today</div>
                  </div>
                )}
                <div
                  className="dsc-tl-fill"
                  style={{
                    width:      animated[index] ? `${barPct}%` : '0%',
                    background: fillBg,
                  }}
                >
                  <div
                    className="dsc-tl-end-dot"
                    style={{
                      background: cfg.color,
                      boxShadow:  `0 0 0 1.5px ${cfg.color}`,
                    }}
                  />
                  <div className="dsc-tl-end-label">
                    {opt.year}
                  </div>
                </div>
              </div>

              <div
                className="dsc-tl-dur"
                style={{ opacity: animated[index] ? 1 : 0 }}
              >
                {durLabel}
              </div>
            </div>
          );
        })}

        <div className="dsc-tl-axis">
          {axisPoints.map((yr, i) => (
            <span key={i}>{yr}</span>
          ))}
        </div>
      </div>

      <div className="dsc-tl-summary">
        <span className="dsc-tl-summary-arrow">→</span>
        <span dangerouslySetInnerHTML={{
          __html:
            `${t('tl-sum-a')} <strong>${propYrs} ${t('opt-years')}</strong> `
          + `${t('tl-sum-b')} <strong>${fmtC(proposal.total)}</strong>. `
          + `${t('tl-sum-c')} <strong>${nothYrs} ${t('opt-years')}</strong> `
          + `${t('tl-sum-d')} <strong>${fmtC(nothing.total)}</strong> — `
          + `${t('tl-sum-e')} <strong>${fmtC(savedAmt)} ${t('tl-sum-f')}</strong>.`
        }} />
      </div>
    </div>
  );
}
