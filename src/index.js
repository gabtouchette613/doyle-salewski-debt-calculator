import { render } from '@wordpress/element';
import Calculator from './components/Calculator';
import './styles/calculator.scss';

const root = document.getElementById( 'dsc-app' );
if ( root ) {
	render( <Calculator />, root );
}
