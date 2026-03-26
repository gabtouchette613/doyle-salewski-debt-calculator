<?php
/**
 * Plugin Name:       Doyle Salewski Debt Relief Calculator
 * Plugin URI:        https://doylesalewski.ca
 * Description:       Interactive Canadian debt relief calculator with bilingual support and lead capture.
 * Version:           1.0.16
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

define( 'DS_CALC_VERSION', '1.0.16' );
define( 'DS_CALC_DIR', plugin_dir_path( __FILE__ ) );
define( 'DS_CALC_URL', plugin_dir_url( __FILE__ ) );

// ── Shortcode & Late-Loading Assets ───────────────────────────────────────

function ds_calc_shortcode() {
	static $loaded = false;
	if ( ! $loaded ) {
		$asset_file = DS_CALC_DIR . 'build/index.asset.php';
		if ( file_exists( $asset_file ) ) {
			$asset = include $asset_file;

			wp_enqueue_script(
				'ds-debt-calc',
				DS_CALC_URL . 'build/index.js',
				$asset['dependencies'],
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
			'name'                 => [ 'sanitize_callback' => 'sanitize_text_field' ],
			'phone'                => [ 'sanitize_callback' => 'sanitize_text_field' ],
			'email'                => [ 'sanitize_callback' => 'sanitize_email'      ],
			'debt'                 => [ 'sanitize_callback' => 'absint'              ],
			'province'             => [ 'sanitize_callback' => 'sanitize_text_field' ],
			'income'               => [ 'sanitize_callback' => 'absint'              ],
			'expenses'             => [ 'sanitize_callback' => 'absint'              ],
			'surplus'              => [ 'sanitize_callback' => 'absint'              ],
			'dti'                  => [ 'sanitize_callback' => 'absint'              ],
			'call_time'            => [ 'sanitize_callback' => 'sanitize_text_field' ],
			'recommended_payment'  => [ 'sanitize_callback' => 'absint'              ],
			'recommended_total'    => [ 'sanitize_callback' => 'absint'              ],
			'lang'                 => [ 'sanitize_callback' => 'sanitize_text_field' ],
			'annual_rate'          => [ 'type' => 'number'                           ],
			'is_advanced'          => [ 'type' => 'boolean'                          ],
			'website'              => [ 'sanitize_callback' => 'sanitize_text_field' ],
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

	$name                 = sanitize_text_field( $request->get_param( 'name' )                 ?? '' );
	$phone                = sanitize_text_field( $request->get_param( 'phone' )                ?? '' );
	$email                = sanitize_email(      $request->get_param( 'email' )                ?? '' );
	$debt                 = absint(              $request->get_param( 'debt' )                 ?? 0  );
	$province             = sanitize_text_field( $request->get_param( 'province' )             ?? '' );
	$income               = absint(              $request->get_param( 'income' )               ?? 0  );
	$expenses             = absint(              $request->get_param( 'expenses' )             ?? 0  );
	$surplus              = absint(              $request->get_param( 'surplus' )              ?? 0  );
	$dti                  = absint(              $request->get_param( 'dti' )                  ?? 0  );
	$call_time            = sanitize_text_field( $request->get_param( 'call_time' )            ?? '' );
	$recommended_payment  = absint(              $request->get_param( 'recommended_payment' )  ?? 0  );
	$recommended_total    = absint(              $request->get_param( 'recommended_total' )    ?? 0  );
	$lang                 = sanitize_text_field( $request->get_param( 'lang' )                 ?? 'en' );
	$annual_rate          = (float)              $request->get_param( 'annual_rate' );
	$is_advanced          = (bool)               $request->get_param( 'is_advanced' );

	$post_id = wp_insert_post( [
		'post_type'   => 'ds_calc_lead',
		'post_title'  => sanitize_text_field( $name ?: $email ?: 'Calculator Lead' ),
		'post_status' => 'publish',
		'meta_input'  => [
			'_ds_lead_name'                => $name,
			'_ds_lead_phone'               => $phone,
			'_ds_lead_email'               => $email,
			'_ds_lead_debt'                => $debt,
			'_ds_lead_province'            => $province,
			'_ds_lead_income'              => $income,
			'_ds_lead_expenses'            => $expenses,
			'_ds_lead_surplus'             => $surplus,
			'_ds_lead_dti'                 => $dti,
			'_ds_lead_call_time'           => $call_time,
			'_ds_lead_recommended_payment' => $recommended_payment,
			'_ds_lead_recommended_total'   => $recommended_total,
			'_ds_lead_lang'                => $lang,
			'_ds_lead_annual_rate'         => $annual_rate,
			'_ds_lead_is_advanced'         => $is_advanced ? '1' : '0',
			'_ds_lead_date'                => current_time( 'mysql' ),
		],
	] );

	if ( is_wp_error( $post_id ) ) {
		return new WP_Error( 'insert_failed', __( 'Failed to save lead.', 'ds-debt-calc' ), [ 'status' => 500 ] );
	}

	// Notification email
	$email_to = get_option( 'ds_calc_email_to', get_option( 'admin_email' ) );
	if ( $email_to ) {
		$subject = sprintf( __( 'New Calculator Lead: %s', 'ds-debt-calc' ), $name ?: $email );
		$body    = sprintf(
			"Name: %s\nPhone: %s\nEmail: %s\nDebt: $%s\nIncome: $%s/mo\nExpenses: $%s/mo\nSurplus: $%s/mo\nDTI: %s%%\nProvince: %s\nRecommended: $%s/mo (total $%s)\nCall time: %s\nLanguage: %s",
			$name,
			$phone,
			$email,
			number_format( $debt ),
			number_format( $income ),
			number_format( $expenses ),
			number_format( $surplus ),
			$dti,
			$province,
			number_format( $recommended_payment ),
			number_format( $recommended_total ),
			$call_time,
			$lang
		);
		wp_mail( $email_to, $subject, $body );
	}

	// CRM webhook
	$webhook = get_option( 'ds_calc_crm_webhook', '' );
	if ( $webhook ) {
		wp_remote_post( $webhook, [
			'body'    => wp_json_encode( [
				'name'                => $name,
				'phone'               => $phone,
				'email'               => $email,
				'debt'                => $debt,
				'province'            => $province,
				'income'              => $income,
				'expenses'            => $expenses,
				'surplus'             => $surplus,
				'dti'                 => $dti,
				'call_time'            => $call_time,
				'recommended_payment'  => $recommended_payment,
				'recommended_total'    => $recommended_total,
				'lang'                 => $lang,
				'annual_rate'          => $annual_rate,
				'is_advanced'          => $is_advanced,
			] ),
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
		echo '<div class="updated"><p>' . esc_html__( 'Settings saved.', 'ds-debt-calc' ) . '</p></div>';
	}

	$firm_name     = esc_attr( get_option( 'ds_calc_firm_name',    'Doyle Salewski' ) );
	$phone         = esc_attr( get_option( 'ds_calc_phone',        '(613) 237-5555' ) );
	$email_to      = esc_attr( get_option( 'ds_calc_email_to',     get_option( 'admin_email' ) ) );
	$crm_webhook   = esc_attr( get_option( 'ds_calc_crm_webhook',  '' ) );
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
