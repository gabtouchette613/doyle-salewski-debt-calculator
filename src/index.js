import { render } from '@wordpress/element';
import Calculator from './components/Calculator';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/calculator.scss';

const root = document.getElementById( 'dsc-app' );
if ( root ) {
	render(
		<ErrorBoundary>
			<Calculator />
		</ErrorBoundary>,
		root
	);
}
