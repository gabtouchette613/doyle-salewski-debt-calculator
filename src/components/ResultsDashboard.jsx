import { useState, useEffect } from '@wordpress/element';
import { getT } from '../lib/i18n';
import ReportNav from './ReportNav';
import DebtAssessmentReport from './DebtAssessmentReport';
import TimelineChart        from './TimelineChart';
import PaymentCards         from './PaymentCards';
import OptionsDetail        from './OptionsDetail';
import CTASection           from './CTASection';

const SECTION_IDS = [
  'dsc-section-report',
  'dsc-section-timeline',
  'dsc-section-payments',
  'dsc-section-options',
  'dsc-section-cta',
];

export default function ResultsDashboard( { results, lang, onReset } ) {
  const t = getT( lang );
  const [ activeSection, setActiveSection ] = useState( 0 );
  const [ unlocked,      setUnlocked      ] = useState( false );

  function handleUnlock() {
    setUnlocked( true );
  }

  useEffect( () => {
    function onScroll() {
      const OFFSET = 140;
      const distances = SECTION_IDS.map( id => {
        const el = document.getElementById( id );
        if ( ! el ) return Infinity;
        return Math.abs( el.getBoundingClientRect().top - OFFSET );
      } );
      const closest = distances.indexOf( Math.min( ...distances ) );
      if ( closest !== -1 ) setActiveSection( closest );
    }
    window.addEventListener( 'scroll', onScroll, { passive: true } );
    onScroll();
    return () => window.removeEventListener( 'scroll', onScroll );
  }, [] );

  function scrollToSection( index ) {
    const el = document.getElementById( SECTION_IDS[ index ] );
    if ( ! el ) return;
    el.scrollIntoView( { behavior: 'smooth', block: 'start' } );
  }

  function handlePDF() {
    window.print();
  }

  return (
    <div className="dsc-results-outer">

      <div className="dsc-results-body">

        <aside className="dsc-results-sidebar">
          <div className="dsc-sidebar-nav-card">
            <ReportNav
              layout="vertical"
              activeSection={ activeSection }
              onTabClick={ scrollToSection }
              lang={ lang }
            />
          </div>
          <div className="dsc-sidebar-cta">
            <div className="dsc-sidebar-cta-title">{ t( 'sidebar-cta-title' ) }</div>
            <div className="dsc-sidebar-cta-sub">{ t( 'sidebar-cta-sub' ) }</div>
            <a
              href={ `tel:${ ( window.dsCalcData?.firmPhone ?? '(613) 237-5555' ).replace( /\D/g, '' ) }` }
              className="dsc-sidebar-cta-phone"
            >
              { window.dsCalcData?.firmPhone ?? '(613) 237-5555' }
            </a>
            <button
              className="dsc-sidebar-cta-btn"
              onClick={ () => {
                const el = document.getElementById( 'dsc-section-cta' );
                if ( el ) el.scrollIntoView( { behavior: 'smooth', block: 'start' } );
              } }
            >
              { t( 'sidebar-cta-btn' ) }
            </button>
          </div>
        </aside>

        <main className="dsc-results-content">

          <div className="dsc-nav-mobile">
            <ReportNav
              layout="horizontal"
              activeSection={ activeSection }
              onTabClick={ scrollToSection }
              lang={ lang }
            />
          </div>

          <section id="dsc-section-report" className="dsc-section">
            <DebtAssessmentReport results={ results } lang={ lang } onReset={ onReset } onSavePDF={ handlePDF } />
          </section>

          <section id="dsc-section-timeline" className="dsc-section">
            <TimelineChart results={ results } lang={ lang } />
          </section>

          <section id="dsc-section-payments" className="dsc-section">
            <PaymentCards results={ results } lang={ lang } unlocked={ unlocked } onUnlock={ handleUnlock } />
          </section>

          <section id="dsc-section-options" className="dsc-section">
            <OptionsDetail results={ results } lang={ lang } unlocked={ unlocked } onUnlock={ handleUnlock } />
          </section>

          <section id="dsc-section-cta" className="dsc-section">
            <CTASection results={ results } lang={ lang } />
          </section>

        </main>
      </div>
    </div>
  );
}
