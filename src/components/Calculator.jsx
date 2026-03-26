import { useReducer } from '@wordpress/element';
import { getT } from '../lib/i18n';
import { calcResults } from '../lib/calculator';
import StepWizard from './StepWizard';
import CalculatingScreen from './CalculatingScreen';
import ResultsDashboard from './ResultsDashboard';

const lang = ( window.dsCalcData?.locale === 'fr' ) ? 'fr' : 'en';
export const t = getT( lang );

const initialState = {
  // Step 1
  debtMode:      'basic',
  totalDebt:     '',
  province:      'ON',
  debtItems:     [],

  // Step 2
  income:        '',
  housing:       '',
  groceries:     '',
  transport:     '',
  utilities:     '',
  insurance:     '',
  childcare:     '',
  otherExpenses: '',

  // Meta
  currentStep:   1,
  results:       null,
};

function reducer( state, action ) {
  switch ( action.type ) {
    case 'SET_FIELD':
      return { ...state, [ action.field ]: action.value };

    case 'SET_STEP':
      return { ...state, currentStep: action.step };

    case 'SET_RESULTS':
      return { ...state, results: action.results, currentStep: 'results' };

    case 'ADD_DEBT_ITEM':
      if ( state.debtItems.length >= 10 ) return state;
      return {
        ...state,
        debtItems: [ ...state.debtItems, { type: 'credit-card', amount: '' } ],
      };

    case 'UPDATE_DEBT_ITEM': {
      const updated = state.debtItems.map( ( item, i ) =>
        i === action.index ? { ...item, [ action.field ]: action.value } : item
      );
      return { ...state, debtItems: updated };
    }

    case 'REMOVE_DEBT_ITEM': {
      const filtered = state.debtItems.filter( ( _, i ) => i !== action.index );
      return { ...state, debtItems: filtered };
    }

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export default function Calculator() {
  const [ state, dispatch ] = useReducer( reducer, initialState );

  function handleNext() {
    dispatch( { type: 'SET_STEP', step: 2 } );
  }

  function handleBack() {
    dispatch( { type: 'SET_STEP', step: 1 } );
  }

  function handleSubmit() {
    dispatch( { type: 'SET_STEP', step: 'calculating' } );

    // Compute the debt total for the calculation engine
    let debt = parseFloat( state.totalDebt ) || 0;
    const advancedItems = state.debtItems.map( item => ( {
      type:   item.type,
      amount: parseFloat( item.amount ) || 0,
    } ) );

    // Advanced total wins if populated
    if ( state.debtMode === 'advanced' ) {
      const advTotal = advancedItems.reduce( ( s, d ) => s + d.amount, 0 );
      if ( advTotal > 0 ) debt = advTotal;
    }

    const totalExpenses =
      ( parseFloat( state.housing )       || 0 ) +
      ( parseFloat( state.groceries )     || 0 ) +
      ( parseFloat( state.transport )     || 0 ) +
      ( parseFloat( state.utilities )     || 0 ) +
      ( parseFloat( state.insurance )     || 0 ) +
      ( parseFloat( state.childcare )     || 0 ) +
      ( parseFloat( state.otherExpenses ) || 0 );

    const inp = {
      debt,
      income:    parseFloat( state.income ) || 0,
      expenses:  totalExpenses,
      province:  state.province,
      debtItems: state.debtMode === 'advanced' ? advancedItems : [],
    };

    // Defer calculation until after calculating screen mounts
    setTimeout( () => {
      const results = calcResults( inp );
      dispatch( { type: 'SET_RESULTS', results } );
    }, 2900 );
  }

  if ( state.currentStep === 'calculating' ) {
    return <CalculatingScreen />;
  }

  if ( state.currentStep === 'results' ) {
    return (
      <ResultsDashboard
        results={ state.results }
        lang={ lang }
        onReset={ () => dispatch( { type: 'RESET' } ) }
      />
    );
  }

  return (
    <StepWizard
      state={ state }
      dispatch={ dispatch }
      onNext={ handleNext }
      onBack={ handleBack }
      onSubmit={ handleSubmit }
    />
  );
}
