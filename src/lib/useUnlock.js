import { useState } from '@wordpress/element';
import { getT } from './i18n';

/**
 * Shared hook for the email-gated unlock flow used by PaymentCards and OptionsDetail.
 * Handles form state, validation, honeypot, API submission, and unlock callback.
 */
export default function useUnlock( results, lang, onUnlock ) {
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

  return {
    unlockName,  setUnlockName,
    unlockEmail, setUnlockEmail,
    unlockError, setUnlockError,
    unlocking,
    trap,        setTrap,
    handleUnlock,
  };
}
