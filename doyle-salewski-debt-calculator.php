<?php
/**
 * Plugin Name:       Doyle Salewski Debt Relief Calculator
 * Plugin URI:        https://doylesalewski.ca
 * Description:       Interactive Canadian debt relief calculator with bilingual support and lead capture.
 * Version:           1.0.13
 * Author:            Doyle Salewski LIT
 * Author URI:        https://doylesalewski.ca
 * License:           GPL v2 or later
 * Text Domain:       ds-debt-calc
 * Domain Path:       /languages
 * Requires at least: 6.0
 * Requires PHP:      8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DS_CALC_VERSION', '1.0.14' );
define( 'DS_CALC_DIR', plugin_dir_path( __FILE__ ) );
define( 'DS_CALC_URL', plugin_dir_url( __FILE__ ) );

// ── Shortcode & Late-Loading Assets ───────────────────────────────────────

function ds_calc_shortcode() {
	static $loaded = false;
	if ( ! $loaded ) {
		$asset_file = DS_CALC_DIR . 'build/index.asset.php';
		if ( file_exists( $asset_file ) ) {
			$asset = include $asset_file;

			wp_enqueue_script( 'ds-calc-chartjs',     DS_CALC_URL . 'assets/vendor/chart.umd.min.js',     [], '4.4.1', true );
			wp_enqueue_script( 'ds-calc-html2canvas', DS_CALC_URL . 'assets/vendor/html2canvas.min.js',  [], '1.4.1', true );
			wp_enqueue_script( 'ds-calc-jspdf',       DS_CALC_URL . 'assets/vendor/jspdf.umd.min.js',    [], '2.5.1', true );

			wp_enqueue_script(
				'ds-debt-calc',
				DS_CALC_URL . 'build/index.js',
				array_merge( $asset['dependencies'], [ 'ds-calc-chartjs', 'ds-calc-html2canvas', 'ds-calc-jspdf' ] ),
				$asset['version'],
				true
			);

			wp_localize_script( 'ds-debt-calc', 'dsCalcData', [
				'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
				'nonce'        => wp_create_nonce( 'ds_calc_lead' ),
				'restUrl'      => rest_url( 'ds-calc/v1/' ),
				'restNonce'    => wp_create_nonce( 'wp_rest' ),
				'locale'       => substr( get_locale(), 0, 2 ),
				'firmName'     => get_option( 'ds_calc_firm_name', 'Doyle Salewski' ),
				'firmPhone'    => get_option( 'ds_calc_phone', '(613) 237-5555' ),
				'emailTo'      => get_option( 'ds_calc_email_to', get_option( 'admin_email' ) ),
				'crmWebhook'   => get_option( 'ds_calc_crm_webhook', '' ),
				'logoUrl'      => DS_CALC_URL . 'assets/images/ds-logo.png',
				'proposalRate' => (float) get_option( 'ds_calc_proposal_rate', 0.30 ),
				'dmpAdminFee'  => (float) get_option( 'ds_calc_dmp_fee',       0.055 ),
				'consRate'     => (float) get_option( 'ds_calc_cons_rate',     0.1699 ),
				'version'      => DS_CALC_VERSION,
			] );

			wp_enqueue_style( 'ds-debt-calc', DS_CALC_URL . 'build/index.css', [], $asset['version'] );
		}
		$loaded = true;
	}
	return '<div id="dsc-app" class="dsc-root"></div>';
}
add_shortcode( 'ds_debt_calculator', 'ds_calc_shortcode' );

// ── Custom Post Type: Lead ─────────────────────────────────────────────────

function ds_calc_register_cpt() {
	register_post_type( 'ds_calc_lead', [
		'labels' => [
			'name'               => __( 'Calculator Leads', 'ds-debt-calc' ),
			'singular_name'      => __( 'Calculator Lead', 'ds-debt-calc' ),
			'add_new'            => __( 'Add New', 'ds-debt-calc' ),
			'add_new_item'       => __( 'Add New Lead', 'ds-debt-calc' ),
			'edit_item'          => __( 'Edit Lead', 'ds-debt-calc' ),
			'view_item'          => __( 'View Lead', 'ds-debt-calc' ),
			'all_items'          => __( 'All Leads', 'ds-debt-calc' ),
			'search_items'       => __( 'Search Leads', 'ds-debt-calc' ),
			'not_found'          => __( 'No leads found.', 'ds-debt-calc' ),
			'not_found_in_trash' => __( 'No leads found in Trash.', 'ds-debt-calc' ),
		],
		'public'       => false,
		'show_ui'      => true,
		'show_in_menu' => true,
		'supports'     => [ 'title', 'custom-fields' ],
		'menu_icon'    => 'dashicons-analytics',
	] );
}
add_action( 'init', 'ds_calc_register_cpt' );

// ── REST API: Lead submission ──────────────────────────────────────────────

function ds_calc_register_rest_routes() {
	register_rest_route( 'ds-calc/v1', '/lead', [
		'methods'             => 'POST',
		'callback'            => 'ds_calc_handle_lead',
		'permission_callback' => '__return_true',
		'args'                => [
			'name'     => [ 'sanitize_callback' => 'sanitize_text_field' ],
			'phone'    => [ 'sanitize_callback' => 'sanitize_text_field' ],
			'email'    => [ 'sanitize_callback' => 'sanitize_email' ],
			'debt'     => [ 'sanitize_callback' => 'absint' ],
			'province' => [ 'sanitize_callback' => 'sanitize_text_field' ],
		],
	] );
}
add_action( 'rest_api_init', 'ds_calc_register_rest_routes' );

function ds_calc_handle_lead( WP_REST_Request $request ) {
	if ( ! wp_verify_nonce( $request->get_header( 'X-WP-Nonce' ), 'wp_rest' ) ) {
		return new WP_Error( 'forbidden', __( 'Invalid nonce.', 'ds-debt-calc' ), [ 'status' => 403 ] );
	}

	if ( ! empty( $request->get_param( 'website' ) ) ) {
		return new WP_Error( 'spam', __( 'Blocked.', 'ds-debt-calc' ), [ 'status' => 403 ] );
	}

	$name     = $request->get_param( 'name' )     ?? '';
	$phone    = $request->get_param( 'phone' )    ?? '';
	$email    = $request->get_param( 'email' )    ?? '';
	$debt     = $request->get_param( 'debt' )     ?? 0;
	$province = $request->get_param( 'province' ) ?? '';

	$post_id = wp_insert_post( [
		'post_type'   => 'ds_calc_lead',
		'post_title'  => sanitize_text_field( $name ?: $email ?: 'Calculator Lead' ),
		'post_status' => 'publish',
		'meta_input'  => [
			'_ds_lead_name'     => $name,
			'_ds_lead_phone'    => $phone,
			'_ds_lead_email'    => $email,
			'_ds_lead_debt'     => $debt,
			'_ds_lead_province' => $province,
			'_ds_lead_date'     => current_time( 'mysql' ),
		],
	] );

	if ( is_wp_error( $post_id ) ) {
		return new WP_Error( 'insert_failed', __( 'Failed to save lead.', 'ds-debt-calc' ), [ 'status' => 500 ] );
	}

	// Send notification email
	$email_to = get_option( 'ds_calc_email_to', get_option( 'admin_email' ) );
	if ( $email_to ) {
		wp_mail(
			$email_to,
			sprintf( __( 'New Calculator Lead: %s', 'ds-debt-calc' ), $name ?: $email ),
			sprintf(
				"Name: %s\nPhone: %s\nEmail: %s\nDebt: $%s\nProvince: %s",
				$name, $phone, $email, number_format( $debt ), $province
			)
		);
	}

	// Forward to CRM webhook if configured
	$webhook = get_option( 'ds_calc_crm_webhook', '' );
	if ( $webhook ) {
		wp_remote_post( $webhook, [
			'body'    => wp_json_encode( compact( 'name', 'phone', 'email', 'debt', 'province' ) ),
			'headers' => [ 'Content-Type' => 'application/json' ],
			'timeout' => 5,
		] );
	}

	return rest_ensure_response( [ 'success' => true, 'id' => $post_id ] );
}

// ── Admin settings page ────────────────────────────────────────────────────

function ds_calc_admin_menu() {
	add_options_page(
		__( 'Debt Calculator Settings', 'ds-debt-calc' ),
		__( 'Debt Calculator', 'ds-debt-calc' ),
		'manage_options',
		'ds-debt-calculator',
		'ds_calc_settings_page'
	);
}
add_action( 'admin_menu', 'ds_calc_admin_menu' );

function ds_calc_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	if ( isset( $_POST['ds_calc_save'] ) && check_admin_referer( 'ds_calc_settings' ) ) {
		update_option( 'ds_calc_firm_name',    sanitize_text_field( $_POST['ds_calc_firm_name']    ?? '' ) );
		update_option( 'ds_calc_phone',        sanitize_text_field( $_POST['ds_calc_phone']        ?? '' ) );
		update_option( 'ds_calc_email_to',     sanitize_email(      $_POST['ds_calc_email_to']     ?? '' ) );
		update_option( 'ds_calc_crm_webhook',  esc_url_raw(         $_POST['ds_calc_crm_webhook']  ?? '' ) );
		update_option( 'ds_calc_proposal_rate', (float) ( $_POST['ds_calc_proposal_rate'] ?? 0.30 ) );
		update_option( 'ds_calc_dmp_fee',       (float) ( $_POST['ds_calc_dmp_fee']       ?? 0.055 ) );
		update_option( 'ds_calc_cons_rate',     (float) ( $_POST['ds_calc_cons_rate']     ?? 0.1699 ) );
		echo '<div class="updated"><p>' . esc_html__( 'Settings saved.', 'ds-debt-calc' ) . '</p></div>';
	}

	$firm_name     = esc_attr( get_option( 'ds_calc_firm_name',    'Doyle Salewski' ) );
	$phone         = esc_attr( get_option( 'ds_calc_phone',        '(613) 237-5555' ) );
	$email_to      = esc_attr( get_option( 'ds_calc_email_to',     get_option( 'admin_email' ) ) );
	$crm_webhook   = esc_attr( get_option( 'ds_calc_crm_webhook',  '' ) );
	$proposal_rate = esc_attr( get_option( 'ds_calc_proposal_rate', '0.30' ) );
	$dmp_fee       = esc_attr( get_option( 'ds_calc_dmp_fee',       '0.055' ) );
	$cons_rate     = esc_attr( get_option( 'ds_calc_cons_rate',     '0.1699' ) );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Debt Calculator Settings', 'ds-debt-calc' ); ?></h1>
		<form method="post">
			<?php wp_nonce_field( 'ds_calc_settings' ); ?>
			<table class="form-table">
				<tr>
					<th><label for="ds_calc_firm_name"><?php esc_html_e( 'Firm Name', 'ds-debt-calc' ); ?></label></th>
					<td><input type="text" id="ds_calc_firm_name" name="ds_calc_firm_name" value="<?php echo $firm_name; ?>" class="regular-text" /></td>
				</tr>
				<tr>
					<th><label for="ds_calc_phone"><?php esc_html_e( 'Phone Number', 'ds-debt-calc' ); ?></label></th>
					<td><input type="text" id="ds_calc_phone" name="ds_calc_phone" value="<?php echo $phone; ?>" class="regular-text" /></td>
				</tr>
				<tr>
					<th><label for="ds_calc_email_to"><?php esc_html_e( 'Lead Email To', 'ds-debt-calc' ); ?></label></th>
					<td><input type="email" id="ds_calc_email_to" name="ds_calc_email_to" value="<?php echo $email_to; ?>" class="regular-text" /></td>
				</tr>
				<tr>
					<th><label for="ds_calc_crm_webhook"><?php esc_html_e( 'CRM Webhook URL', 'ds-debt-calc' ); ?></label></th>
					<td><input type="url" id="ds_calc_crm_webhook" name="ds_calc_crm_webhook" value="<?php echo $crm_webhook; ?>" class="regular-text" /></td>
				</tr>
				<tr>
					<th><label for="ds_calc_proposal_rate"><?php esc_html_e( 'Consumer Proposal Rate', 'ds-debt-calc' ); ?></label></th>
					<td><input type="number" step="0.01" min="0" max="1" id="ds_calc_proposal_rate" name="ds_calc_proposal_rate" value="<?php echo $proposal_rate; ?>" class="small-text" /><p class="description"><?php esc_html_e( 'Default: 0.30 (30% of debt settled). Range: 0.20–0.60.', 'ds-debt-calc' ); ?></p></td>
				</tr>
				<tr>
					<th><label for="ds_calc_dmp_fee"><?php esc_html_e( 'DMP Admin Fee', 'ds-debt-calc' ); ?></label></th>
					<td><input type="number" step="0.001" min="0" max="0.5" id="ds_calc_dmp_fee" name="ds_calc_dmp_fee" value="<?php echo $dmp_fee; ?>" class="small-text" /><p class="description"><?php esc_html_e( 'Default: 0.055 (5.5%).', 'ds-debt-calc' ); ?></p></td>
				</tr>
				<tr>
					<th><label for="ds_calc_cons_rate"><?php esc_html_e( 'Consolidation Loan APR', 'ds-debt-calc' ); ?></label></th>
					<td><input type="number" step="0.0001" min="0" max="1" id="ds_calc_cons_rate" name="ds_calc_cons_rate" value="<?php echo $cons_rate; ?>" class="small-text" /><p class="description"><?php esc_html_e( 'Default: 0.1699 (16.99%).', 'ds-debt-calc' ); ?></p></td>
				</tr>
			</table>
			<p class="submit">
				<input type="submit" name="ds_calc_save" class="button-primary" value="<?php esc_attr_e( 'Save Settings', 'ds-debt-calc' ); ?>" />
			</p>
		</form>
		<hr />
		<h2><?php esc_html_e( 'Shortcode', 'ds-debt-calc' ); ?></h2>
		<p><?php esc_html_e( 'Place this shortcode on any page to display the calculator:', 'ds-debt-calc' ); ?></p>
		<code>[ds_debt_calculator]</code>
	</div>
	<?php
}

// ── Activation / Deactivation ──────────────────────────────────────────────

function ds_calc_activate() {
	ds_calc_register_cpt();
	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'ds_calc_activate' );

function ds_calc_deactivate() {
	flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'ds_calc_deactivate' );

// ── Load text domain ───────────────────────────────────────────────────────

function ds_calc_load_textdomain() {
	load_plugin_textdomain( 'ds-debt-calc', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
add_action( 'plugins_loaded', 'ds_calc_load_textdomain' );
