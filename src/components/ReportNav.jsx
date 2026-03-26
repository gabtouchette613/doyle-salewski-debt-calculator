import { getT } from '../lib/i18n';

const TABS = [
  {
    key:      'report',
    labelKey: 'r-nav-report',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6h6M5 9h4"/>
      </svg>
    ),
  },
  {
    key:      'timeline',
    labelKey: 'r-nav-timeline',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 13h12M2 13V4M5 10l2.5-3 2.5 2 3-4"/>
      </svg>
    ),
  },
  {
    key:      'payments',
    labelKey: 'r-nav-payments',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="9" width="3" height="5" rx="1"/><rect x="6.5" y="6" width="3" height="8" rx="1"/><rect x="11" y="3" width="3" height="11" rx="1"/>
      </svg>
    ),
  },
  {
    key:      'options',
    labelKey: 'r-nav-options',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h10M3 5h10M3 11h6"/>
      </svg>
    ),
  },
  {
    key:      'cta',
    labelKey: 'r-nav-cta',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2a6 6 0 100 12A6 6 0 008 2z"/><path d="M6 8l1.5 1.5L10 6"/>
      </svg>
    ),
  },
];

export default function ReportNav( { activeSection, onTabClick, lang, layout = 'horizontal' } ) {
  const t = getT( lang );

  function handleTabClick( index, btnEl ) {
    onTabClick( index );
    if ( btnEl ) {
      btnEl.scrollIntoView( { behavior: 'smooth', inline: 'center' } );
    }
  }

  if ( layout === 'vertical' ) {
    return (
      <nav className="dsc-nav-sidebar">
        <span className="dsc-nav-sidebar-label">Contents</span>
        { TABS.map( ( tab, index ) => {
          const isActive    = activeSection === index;
          const isGreen     = index === 4;
          const activeClass = isActive
            ? ( isGreen ? 'dsc-nav-sidebar-tab--active-green' : 'dsc-nav-sidebar-tab--active' )
            : '';

          return (
            <button
              key={ tab.key }
              className={ `dsc-nav-sidebar-tab ${ activeClass }`.trim() }
              type="button"
              aria-current={ isActive ? 'true' : undefined }
              onClick={ () => onTabClick( index ) }
            >
              <span className="dsc-nav-sidebar-icon">{ tab.icon }</span>
              <span className="dsc-nav-sidebar-label-text">{ t( tab.labelKey ) }</span>
            </button>
          );
        } ) }
      </nav>
    );
  }

  return (
    <div className="dsc-nav">
      <div className="dsc-nav-rail" role="tablist">
        { TABS.map( ( tab, index ) => {
          const isActive     = activeSection === index;
          const isGreen      = index === 4;
          const activeClass  = isActive
            ? ( isGreen ? 'dsc-nav-tab--active-green' : 'dsc-nav-tab--active' )
            : '';

          return (
            <button
              key={ tab.key }
              className={ `dsc-nav-tab ${ activeClass }`.trim() }
              role="tab"
              aria-selected={ isActive }
              type="button"
              onClick={ e => handleTabClick( index, e.currentTarget ) }
            >
              <span className="dsc-nav-icon">
                { tab.icon }
              </span>
              <span className="dsc-nav-label">{ t( tab.labelKey ) }</span>
            </button>
          );
        } ) }
      </div>

      <div className="dsc-nav-dots" aria-hidden="true">
        { TABS.map( ( tab, index ) => {
          const isActive    = activeSection === index;
          const isGreen     = index === 4;
          const dotClass    = isActive
            ? ( isGreen ? 'dsc-nav-dot--active-green' : 'dsc-nav-dot--active' )
            : '';

          return (
            <button
              key={ tab.key }
              className={ `dsc-nav-dot ${ dotClass }`.trim() }
              type="button"
              onClick={ () => onTabClick( index ) }
              tabIndex={ -1 }
            />
          );
        } ) }
      </div>
    </div>
  );
}
