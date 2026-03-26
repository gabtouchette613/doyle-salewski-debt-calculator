import { useState, useEffect, useRef } from '@wordpress/element';
import { t } from './Calculator';

const MESSAGE_INTERVAL_MS = 550;

export default function CalculatingScreen() {
  const msgs                  = t( 'calc-msgs' ) || [];
  const [ msgIndex, setMsgIndex ] = useState( 0 );
  const intervalRef           = useRef( null );

  useEffect( () => {
    intervalRef.current = setInterval( () => {
      setMsgIndex( prev => ( prev + 1 ) % msgs.length );
    }, MESSAGE_INTERVAL_MS );

    return () => {
      clearInterval( intervalRef.current );
    };
  }, [ msgs.length ] );

  return (
    <div className="dsc-wrapper">
      <div className="dsc-card dsc-calculating">
        <div className="dsc-spinner" role="status" aria-label="Loading" />

        <h2 className="dsc-calc-title">{ t( 'calc-title' ) }</h2>

        <p className="dsc-calc-message" aria-live="polite">
          { msgs[ msgIndex ] || '' }
        </p>

        <div className="dsc-calc-progress-track">
          <div className="dsc-calc-progress-fill" />
        </div>
      </div>
    </div>
  );
}
