import { Component } from '@wordpress/element';

export default class ErrorBoundary extends Component {
  constructor( props ) {
    super( props );
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch( error, info ) {
    console.error( '[ds-debt-calc] Uncaught error:', error, info );
  }

  render() {
    if ( this.state.hasError ) {
      const phone = window.dsCalcData?.firmPhone ?? '(613) 237-5555';
      const tel   = phone.replace( /\D/g, '' );
      return (
        <div className="dsc-root">
          <div className="dsc-wrapper">
            <div className="dsc-card" style={ { textAlign: 'center', padding: '40px 24px' } }>
              <p style={ { fontSize: '32px', marginBottom: '12px' } }>⚠️</p>
              <h2 style={ { marginBottom: '8px' } }>Something went wrong</h2>
              <p style={ { marginBottom: '20px', color: '#6b7280' } }>
                We encountered an unexpected error. Please call us directly for your free assessment.
              </p>
              <a href={ `tel:${ tel }` } style={ { fontSize: '20px', fontWeight: '700', color: '#1061ED' } }>
                { phone }
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
