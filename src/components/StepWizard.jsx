import { useState } from '@wordpress/element';
import { t } from './Calculator';
import { fmtC } from '../lib/calculator';

const DEBT_TYPES = [
  'credit-card',
  'loc',
  'cra',
  'student',
  'payday',
  'personal',
  'other',
];

function ProgressBar( { step } ) {
  const pct   = step === 1 ? 50 : 100;
  const label = step === 1 ? t( 'w1-step' ) : t( 'w2-step' );
  const name  = step === 1 ? t( 'w1-step-name' ) : t( 'w2-step-name' );

  return (
    <div className="dsc-progress-bar-wrap">
      <div className="dsc-progress-meta">
        <span className="dsc-progress-step">{ label }</span>
        <span className="dsc-progress-step-name">{ name }</span>
      </div>
      <div className="dsc-progress-track">
        <div className="dsc-progress-fill" style={ { width: `${ pct }%` } } />
      </div>
    </div>
  );
}

function CurrencyInput( { id, value, onChange, placeholder, large, hasError, className } ) {
  return (
    <div className="dsc-input-wrap">
      <span className="dsc-input-prefix">$</span>
      <input
        id={ id }
        className={ [
          'dsc-input',
          large ? 'dsc-input--lg' : '',
          hasError ? 'dsc-input--error' : '',
          className || '',
        ].filter( Boolean ).join( ' ' ) }
        type="number"
        inputMode="numeric"
        value={ value }
        onChange={ e => onChange( e.target.value ) }
        placeholder={ placeholder || '0' }
      />
    </div>
  );
}

// ── Step 1 ─────────────────────────────────────────────────────────────────

function Step1( { state, dispatch, onNext } ) {
  const [ errors, setErrors ] = useState( {} );

  function validate() {
    const errs = {};
    if ( state.debtMode === 'basic' ) {
      if ( ! state.totalDebt || parseFloat( state.totalDebt ) <= 0 ) {
        errs.totalDebt = t( 'w1-debt-error' );
      }
    } else {
      const hasAmount = state.debtItems.some( d => parseFloat( d.amount ) > 0 );
      if ( ! hasAmount ) {
        errs.debtItems = t( 'w1-adv-error' );
      }
    }
    setErrors( errs );
    return Object.keys( errs ).length === 0;
  }

  function handleNext() {
    if ( validate() ) onNext();
  }

  const advTotal = state.debtItems.reduce(
    ( s, d ) => s + ( parseFloat( d.amount ) || 0 ), 0
  );

  const provinces = t( 'provinces' );

  return (
    <div className="dsc-wrapper">
      <ProgressBar step={ 1 } />
      <div className="dsc-card">
        <h1 className="dsc-card-title">{ t( 'w1-title' ) }</h1>
        <p className="dsc-card-subtitle">{ t( 'w1-sub' ) }</p>

        {/* Mode toggle */}
        <div className="dsc-mode-toggle" role="group" aria-label="Input mode">
          <button
            className={ `dsc-mode-btn${ state.debtMode === 'basic' ? ' dsc-mode-btn--active' : '' }` }
            onClick={ () => dispatch( { type: 'SET_FIELD', field: 'debtMode', value: 'basic' } ) }
            type="button"
          >
            { t( 'w1-mode-basic' ) }
          </button>
          <button
            className={ `dsc-mode-btn${ state.debtMode === 'advanced' ? ' dsc-mode-btn--active' : '' }` }
            onClick={ () => dispatch( { type: 'SET_FIELD', field: 'debtMode', value: 'advanced' } ) }
            type="button"
          >
            { t( 'w1-mode-advanced' ) }
          </button>
        </div>

        {/* Basic mode */}
        { state.debtMode === 'basic' && (
          <div className="dsc-field">
            <label className="dsc-label" htmlFor="dsc-total-debt">
              { t( 'w1-debt-label' ) }
            </label>
            <p className="dsc-hint">{ t( 'w1-debt-hint' ) }</p>
            <CurrencyInput
              id="dsc-total-debt"
              value={ state.totalDebt }
              onChange={ v => dispatch( { type: 'SET_FIELD', field: 'totalDebt', value: v } ) }
              placeholder={ t( 'w1-debt-placeholder' ) }
              large
              hasError={ !! errors.totalDebt }
            />
            { errors.totalDebt && (
              <p className="dsc-field-error">{ errors.totalDebt }</p>
            ) }
          </div>
        ) }

        {/* Advanced mode */}
        { state.debtMode === 'advanced' && (
          <div>
            <p className="dsc-adv-section-label">{ t( 'w1-adv-section' ) }</p>
            <p className="dsc-adv-hint">{ t( 'w1-adv-hint' ) }</p>

            { state.debtItems.map( ( item, i ) => (
              <div key={ i } className="dsc-debt-row">
                <select
                  className="dsc-select"
                  value={ item.type }
                  onChange={ e => dispatch( {
                    type:  'UPDATE_DEBT_ITEM',
                    index: i,
                    field: 'type',
                    value: e.target.value,
                  } ) }
                  aria-label={ `Debt type ${ i + 1 }` }
                >
                  { DEBT_TYPES.map( dt => (
                    <option key={ dt } value={ dt }>{ t( `dtype-${ dt }` ) }</option>
                  ) ) }
                </select>

                <CurrencyInput
                  id={ `dsc-debt-amount-${ i }` }
                  value={ item.amount }
                  onChange={ v => dispatch( {
                    type:  'UPDATE_DEBT_ITEM',
                    index: i,
                    field: 'amount',
                    value: v,
                  } ) }
                  placeholder="0"
                />

                <button
                  className="dsc-debt-row-remove"
                  type="button"
                  onClick={ () => dispatch( { type: 'REMOVE_DEBT_ITEM', index: i } ) }
                  aria-label={ `Remove debt ${ i + 1 }` }
                >
                  ×
                </button>
              </div>
            ) ) }

            { errors.debtItems && (
              <p className="dsc-field-error">{ errors.debtItems }</p>
            ) }

            { state.debtItems.length < 10 && (
              <button
                className="dsc-adv-add-btn"
                type="button"
                onClick={ () => dispatch( { type: 'ADD_DEBT_ITEM' } ) }
              >
                { t( 'w1-adv-add' ) }
              </button>
            ) }

            { advTotal > 0 && (
              <p className="dsc-adv-total">
                { t( 'w1-adv-total' ) }:{' '}
                <span className="dsc-adv-total-amount">{ fmtC( advTotal ) }</span>
              </p>
            ) }
          </div>
        ) }

        {/* Province */}
        <div className="dsc-field">
          <label className="dsc-label" htmlFor="dsc-province">
            { t( 'w1-province' ) }
          </label>
          <p className="dsc-hint">{ t( 'w1-province-hint' ) }</p>
          <select
            id="dsc-province"
            className="dsc-select"
            value={ state.province }
            onChange={ e => dispatch( { type: 'SET_FIELD', field: 'province', value: e.target.value } ) }
          >
            { ( provinces || [] ).map( p => (
              <option key={ p.value } value={ p.value }>{ p.label }</option>
            ) ) }
          </select>
        </div>

        {/* CTA */}
        <button className="dsc-btn dsc-btn--primary" type="button" onClick={ handleNext }>
          { t( 'w1-btn-next' ) }
        </button>

        <p className="dsc-privacy-note">
          <span>🔒</span>
          <span>{ t( 'w1-privacy' ) }</span>
        </p>
      </div>
    </div>
  );
}

// ── Step 2 ─────────────────────────────────────────────────────────────────

const EXPENSE_FIELDS = [
  { field: 'housing',       labelKey: 'w2-housing',   hintKey: 'w2-housing-hint' },
  { field: 'groceries',     labelKey: 'w2-groceries',  hintKey: 'w2-groceries-hint' },
  { field: 'transport',     labelKey: 'w2-transport',  hintKey: 'w2-transport-hint' },
  { field: 'utilities',     labelKey: 'w2-utilities',  hintKey: 'w2-utilities-hint' },
  { field: 'insurance',     labelKey: 'w2-insurance',  hintKey: null },
  { field: 'childcare',     labelKey: 'w2-childcare',  hintKey: null },
];

function Step2( { state, dispatch, onBack, onSubmit } ) {
  const [ errors, setErrors ] = useState( {} );

  function validate() {
    const errs = {};
    if ( ! state.income || parseFloat( state.income ) <= 0 ) {
      errs.income = t( 'w2-income-error' );
    }
    setErrors( errs );
    return Object.keys( errs ).length === 0;
  }

  function handleSubmit() {
    if ( validate() ) onSubmit();
  }

  const income       = parseFloat( state.income )        || 0;
  const totalExp     =
    ( parseFloat( state.housing )       || 0 ) +
    ( parseFloat( state.groceries )     || 0 ) +
    ( parseFloat( state.transport )     || 0 ) +
    ( parseFloat( state.utilities )     || 0 ) +
    ( parseFloat( state.insurance )     || 0 ) +
    ( parseFloat( state.childcare )     || 0 ) +
    ( parseFloat( state.otherExpenses ) || 0 );
  const remaining    = income - totalExp;
  const isPositive   = remaining > 0;

  return (
    <div className="dsc-wrapper">
      <ProgressBar step={ 2 } />
      <div className="dsc-card">
        <h2 className="dsc-card-title">{ t( 'w2-title' ) }</h2>
        <p className="dsc-card-subtitle">{ t( 'w2-sub' ) }</p>

        {/* Income */}
        <div className="dsc-field">
          <label className="dsc-label" htmlFor="dsc-income">
            { t( 'w2-income-label' ) }
          </label>
          <p className="dsc-hint">{ t( 'w2-income-hint' ) }</p>
          <CurrencyInput
            id="dsc-income"
            value={ state.income }
            onChange={ v => dispatch( { type: 'SET_FIELD', field: 'income', value: v } ) }
            placeholder={ t( 'w2-income-placeholder' ) }
            large
            hasError={ !! errors.income }
          />
          { errors.income && (
            <p className="dsc-field-error">{ errors.income }</p>
          ) }
        </div>

        <hr className="dsc-divider" />
        <p className="dsc-section-label">{ t( 'w2-exp-section' ) }</p>

        {/* Expense grid */}
        <div className="dsc-expense-grid">
          { EXPENSE_FIELDS.map( ( { field, labelKey, hintKey } ) => (
            <div key={ field } className="dsc-field">
              <label className="dsc-label" htmlFor={ `dsc-${ field }` }>
                { t( labelKey ) }
              </label>
              { hintKey && <p className="dsc-hint">{ t( hintKey ) }</p> }
              <CurrencyInput
                id={ `dsc-${ field }` }
                value={ state[ field ] }
                onChange={ v => dispatch( { type: 'SET_FIELD', field, value: v } ) }
                placeholder="0"
              />
            </div>
          ) ) }
        </div>

        {/* Other expenses (full width) */}
        <div className="dsc-field">
          <label className="dsc-label" htmlFor="dsc-other-expenses">
            { t( 'w2-other' ) }
          </label>
          <p className="dsc-hint">{ t( 'w2-other-hint' ) }</p>
          <CurrencyInput
            id="dsc-other-expenses"
            value={ state.otherExpenses }
            onChange={ v => dispatch( { type: 'SET_FIELD', field: 'otherExpenses', value: v } ) }
            placeholder="0"
          />
        </div>

        {/* Live summary */}
        <div className="dsc-summary-box" aria-live="polite">
          <div className="dsc-summary-row">
            <span className="dsc-summary-label">{ t( 'w2-total-exp' ) }</span>
            <span className="dsc-summary-value">{ fmtC( totalExp ) }/mo</span>
          </div>
          <div className="dsc-summary-row">
            <span className="dsc-summary-label">{ t( 'w2-remaining' ) }</span>
            <span className={ `dsc-summary-value ${ isPositive ? 'dsc-summary-value--positive' : 'dsc-summary-value--negative' }` }>
              { fmtC( Math.abs( remaining ) ) }/mo
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="dsc-btn-row">
          <button className="dsc-btn dsc-btn--ghost" type="button" onClick={ onBack }>
            { t( 'w2-btn-back' ) }
          </button>
          <button className="dsc-btn dsc-btn--primary" type="button" onClick={ handleSubmit }>
            { t( 'w2-btn-submit' ) }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── StepWizard ─────────────────────────────────────────────────────────────

export default function StepWizard( { state, dispatch, onNext, onBack, onSubmit } ) {
  if ( state.currentStep === 1 ) {
    return (
      <Step1
        state={ state }
        dispatch={ dispatch }
        onNext={ onNext }
      />
    );
  }

  return (
    <Step2
      state={ state }
      dispatch={ dispatch }
      onBack={ onBack }
      onSubmit={ onSubmit }
    />
  );
}
