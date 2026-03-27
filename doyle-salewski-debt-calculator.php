<?php
/**
 * Plugin Name:       Doyle Salewski Debt Relief Calculator
 * Plugin URI:        https://doylesalewski.ca
 * Description:       Interactive Canadian debt relief calculator with bilingual support and lead capture.
 * Version:           1.0.31
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

define( 'DS_CALC_VERSION', '1.0.31' );
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
				'proposalRate'   => (float) get_option( 'ds_calc_proposal_rate',    0.30 ),
				'proposalMonths' => (int)   get_option( 'ds_calc_proposal_months', 60 ),
				'dmpAdminFee'    => (float) get_option( 'ds_calc_dmp_fee',         0.055 ),
				'dmpMonths'      => (int)   get_option( 'ds_calc_dmp_months',      60 ),
				'consRate'       => (float) get_option( 'ds_calc_cons_rate',       0.1699 ),
				'consMonths'     => (int)   get_option( 'ds_calc_cons_months',     60 ),
				'defaultRate'    => (float) get_option( 'ds_calc_default_rate',    0.2199 ),
				'minPmtPct'      => (float) get_option( 'ds_calc_min_pmt_pct',    0.025 ),
				'rateCreditCard' => (float) get_option( 'ds_calc_rate_credit_card', 0.1999 ),
				'rateLoc'        => (float) get_option( 'ds_calc_rate_loc',         0.0850 ),
				'rateCra'        => (float) get_option( 'ds_calc_rate_cra',         0.0900 ),
				'rateStudent'    => (float) get_option( 'ds_calc_rate_student',     0.0750 ),
				'ratePayday'     => (float) get_option( 'ds_calc_rate_payday',      0.2999 ),
				'ratePersonal'   => (float) get_option( 'ds_calc_rate_personal',    0.1499 ),
				'rateOther'      => (float) get_option( 'ds_calc_rate_other',       0.1999 ),
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

// ══════════════════════════════════════════════════════════════════
// ADMIN — Menu, styles, and page router
// ══════════════════════════════════════════════════════════════════

add_action( 'admin_menu', 'ds_calc_register_admin_menu' );

add_action( 'admin_init', 'ds_calc_maybe_export_csv' );

function ds_calc_maybe_export_csv(): void {
	if (
		! isset( $_GET['page'] ) ||
		$_GET['page'] !== 'ds-debt-calculator' ||
		empty( $_GET['ds_export'] ) ||
		$_GET['ds_export'] !== '1'
	) {
		return;
	}
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Permission denied.', 'ds-debt-calc' ) );
	}
	if ( ! isset( $_GET['_wpnonce'] ) || ! wp_verify_nonce( $_GET['_wpnonce'], 'ds_calc_export' ) ) {
		wp_die( esc_html__( 'Security check failed.', 'ds-debt-calc' ) );
	}
	ds_calc_export_csv();
	exit;
}

function ds_calc_register_admin_menu(): void {
	add_menu_page(
		__( 'Debt Calculator', 'ds-debt-calc' ),
		__( 'Debt Calculator', 'ds-debt-calc' ),
		'manage_options',
		'ds-debt-calculator',
		'ds_calc_admin_page',
		'dashicons-analytics',
		56
	);
}

add_action( 'admin_head', function () {
	$screen = get_current_screen();
	if ( ! $screen || strpos( $screen->id, 'ds-debt-calculator' ) === false ) { return; }
	?>
	<style>
		.ds-calc-wrap { max-width: 1200px; }
		.ds-calc-tabs { display:flex; gap:0; margin-bottom:0; border-bottom:1px solid #c3c4c7; }
		.ds-calc-tab  { padding:8px 18px; text-decoration:none; color:#2271b1; border:1px solid transparent; border-bottom:none; margin-bottom:-1px; background:#f0f0f1; font-size:13px; }
		.ds-calc-tab.active { background:#fff; border-color:#c3c4c7; color:#1d2327; font-weight:600; }
		.ds-calc-tab-content { background:#fff; border:1px solid #c3c4c7; border-top:none; padding:20px; }

		/* Leads table */
		.ds-leads-table { width:100%; border-collapse:collapse; font-size:13px; }
		.ds-leads-table th, .ds-leads-table td { padding:8px 10px; border-bottom:1px solid #f0f0f1; text-align:left; vertical-align:top; }
		.ds-leads-table th { background:#f6f7f7; font-weight:600; white-space:nowrap; }
		.ds-leads-table tr:hover td { background:#f6f7f7; }
		.ds-leads-table td.money { font-weight:600; }

		/* Badges */
		.ds-badge { display:inline-block; padding:2px 8px; border-radius:3px; font-size:11px; font-weight:700; text-transform:uppercase; white-space:nowrap; }
		.ds-badge--proposal { background:#dbeafe; color:#1e40af; }
		.ds-badge--dmp { background:#fef3c7; color:#92400e; }
		.ds-badge--consolidation { background:#e0f2fe; color:#0369a1; }
		.ds-badge--nothing { background:#fee2e2; color:#991b1b; }
		.ds-badge--en { background:#f3f4f6; color:#374151; }
		.ds-badge--fr { background:#ede9fe; color:#5b21b6; }

		/* Filter bar */
		.ds-filter-bar { display:flex; gap:10px; align-items:center; margin-bottom:15px; flex-wrap:wrap; }

		/* Pagination */
		.ds-pagination { margin-top:15px; display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
		.ds-pagination a, .ds-pagination span { padding:4px 10px; border:1px solid #c3c4c7; border-radius:3px; text-decoration:none; font-size:13px; }
		.ds-pagination .current { background:#2271b1; color:#fff; border-color:#2271b1; }

		/* Modal */
		.ds-modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:99999; align-items:center; justify-content:center; }
		.ds-modal-overlay.open { display:flex; }
		.ds-modal { background:#fff; border-radius:6px; padding:24px 28px; max-width:760px; width:95%; max-height:88vh; overflow-y:auto; position:relative; }
		.ds-modal-close { position:absolute; top:12px; right:14px; background:none; border:none; font-size:22px; cursor:pointer; color:#666; line-height:1; }
		.ds-modal h3 { margin:0 0 16px; font-size:16px; }
		.ds-modal-section { margin-bottom:20px; }
		.ds-modal-section h4 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#999; margin:0 0 10px; border-bottom:1px solid #f0f0f1; padding-bottom:6px; }
		.ds-detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; }
		.ds-detail-item label { font-weight:600; display:block; font-size:11px; text-transform:uppercase; color:#888; margin-bottom:2px; }
		.ds-detail-item span { display:block; font-size:13px; color:#1d2327; }

		/* Settings */
		.ds-settings-section { margin-bottom:28px; }
		.ds-settings-section h3 { font-size:14px; font-weight:600; margin:0 0 4px; }
		.ds-settings-section .description { color:#666; font-size:13px; margin:0 0 14px; }
		.ds-rate-fields { display:flex; gap:20px; flex-wrap:wrap; }
		.ds-rate-field { display:flex; flex-direction:column; gap:4px; }
		.ds-rate-field label { font-weight:600; font-size:12px; color:#1d2327; }
		.ds-rate-field input { width:90px; }
		.ds-rate-field .description { font-size:11px; color:#888; margin:0; }
	</style>
	<script>
	function dsCalcOpenModal(id) {
		document.getElementById('ds-calc-modal-' + id).classList.add('open');
		document.body.style.overflow = 'hidden';
	}
	function dsCalcCloseModal(id) {
		document.getElementById('ds-calc-modal-' + id).classList.remove('open');
		document.body.style.overflow = '';
	}
	document.addEventListener('keydown', function(e) {
		if (e.key === 'Escape') {
			document.querySelectorAll('.ds-modal-overlay.open').forEach(function(el) {
				el.classList.remove('open');
				document.body.style.overflow = '';
			});
		}
	});
	</script>
	<?php
} );

// ── Page router ────────────────────────────────────────────────────────────

function ds_calc_admin_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Permission denied.', 'ds-debt-calc' ) );
	}

	// Handle settings save
	if ( isset( $_POST['ds_calc_admin_nonce'] ) ) {
		ds_calc_save_admin_settings();
		wp_safe_redirect( add_query_arg( 'settings-updated', '1', wp_get_referer() ) );
		exit;
	}

	if ( ! empty( $_GET['settings-updated'] ) ) {
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Settings saved.', 'ds-debt-calc' ) . '</p></div>';
	}

	$active_tab = ( isset( $_GET['tab'] ) && $_GET['tab'] === 'settings' ) ? 'settings' : 'leads';
	?>
	<div class="wrap ds-calc-wrap">
		<h1><?php esc_html_e( 'Debt Calculator', 'ds-debt-calc' ); ?></h1>
		<div class="ds-calc-tabs">
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=ds-debt-calculator&tab=leads' ) ); ?>"
			   class="ds-calc-tab <?php echo $active_tab === 'leads' ? 'active' : ''; ?>">
				<?php esc_html_e( 'Leads', 'ds-debt-calc' ); ?>
			</a>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=ds-debt-calculator&tab=settings' ) ); ?>"
			   class="ds-calc-tab <?php echo $active_tab === 'settings' ? 'active' : ''; ?>">
				<?php esc_html_e( 'Settings', 'ds-debt-calc' ); ?>
			</a>
		</div>
		<div class="ds-calc-tab-content">
			<?php
			if ( $active_tab === 'settings' ) {
				ds_calc_render_settings_tab();
			} else {
				ds_calc_render_leads_tab();
			}
			?>
		</div>
	</div>
	<?php
}

// ── Leads tab ──────────────────────────────────────────────────────────────

function ds_calc_render_leads_tab(): void {
	$per_page     = 25;
	$current_page = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
	$province_f   = sanitize_text_field( $_GET['province']    ?? '' );
	$lang_f       = sanitize_text_field( $_GET['lang']        ?? '' );

	$meta_query = [ 'relation' => 'AND' ];
	if ( $province_f ) {
		$meta_query[] = [ 'key' => '_ds_lead_province', 'value' => $province_f, 'compare' => '=' ];
	}
	if ( $lang_f ) {
		$meta_query[] = [ 'key' => '_ds_lead_lang', 'value' => $lang_f, 'compare' => '=' ];
	}

	$query_args = [
		'post_type'      => 'ds_calc_lead',
		'post_status'    => 'publish',
		'posts_per_page' => $per_page,
		'paged'          => $current_page,
		'orderby'        => 'date',
		'order'          => 'DESC',
		'meta_query'     => $meta_query,
	];

	$query       = new WP_Query( $query_args );
	$total       = $query->found_posts;
	$total_pages = $query->max_num_pages;

	$base_url   = admin_url( 'admin.php?page=ds-debt-calculator&tab=leads' );
	$export_url = add_query_arg( [
		'ds_export' => '1',
		'province'  => $province_f,
		'lang'      => $lang_f,
		'_wpnonce'  => wp_create_nonce( 'ds_calc_export' ),
	], $base_url );

	$provinces = [ 'ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU' ];
	?>

	<div class="ds-filter-bar">
		<form method="get" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
			<input type="hidden" name="page" value="ds-debt-calculator">
			<input type="hidden" name="tab"  value="leads">

			<label for="ds-prov-filter" style="font-weight:600;font-size:13px;"><?php esc_html_e( 'Province:', 'ds-debt-calc' ); ?></label>
			<select id="ds-prov-filter" name="province">
				<option value=""><?php esc_html_e( 'All', 'ds-debt-calc' ); ?></option>
				<?php foreach ( $provinces as $p ) : ?>
					<option value="<?php echo esc_attr( $p ); ?>" <?php selected( $province_f, $p ); ?>><?php echo esc_html( $p ); ?></option>
				<?php endforeach; ?>
			</select>

			<label for="ds-lang-filter" style="font-weight:600;font-size:13px;"><?php esc_html_e( 'Language:', 'ds-debt-calc' ); ?></label>
			<select id="ds-lang-filter" name="lang">
				<option value=""><?php esc_html_e( 'All', 'ds-debt-calc' ); ?></option>
				<option value="en" <?php selected( $lang_f, 'en' ); ?>>EN</option>
				<option value="fr" <?php selected( $lang_f, 'fr' ); ?>>FR</option>
			</select>

			<button type="submit" class="button"><?php esc_html_e( 'Filter', 'ds-debt-calc' ); ?></button>
			<a href="<?php echo esc_url( $base_url ); ?>" class="button button-secondary"><?php esc_html_e( 'Reset', 'ds-debt-calc' ); ?></a>
		</form>

		<a href="<?php echo esc_url( $export_url ); ?>" class="button button-secondary" style="margin-left:auto;">
			&#8595; <?php esc_html_e( 'Export CSV', 'ds-debt-calc' ); ?>
		</a>
		<span style="color:#666;font-size:13px;">
			<?php printf( esc_html__( '%d leads', 'ds-debt-calc' ), $total ); ?>
		</span>
	</div>

	<?php if ( ! $query->have_posts() ) : ?>
		<p><?php esc_html_e( 'No leads found.', 'ds-debt-calc' ); ?></p>
	<?php else : ?>

		<table class="ds-leads-table">
			<thead><tr>
				<th><?php esc_html_e( 'Date', 'ds-debt-calc' ); ?></th>
				<th><?php esc_html_e( 'Name', 'ds-debt-calc' ); ?></th>
				<th><?php esc_html_e( 'Province', 'ds-debt-calc' ); ?></th>
				<th><?php esc_html_e( 'Debt', 'ds-debt-calc' ); ?></th>
				<th><?php esc_html_e( 'Income', 'ds-debt-calc' ); ?></th>
				<th><?php esc_html_e( 'Surplus', 'ds-debt-calc' ); ?></th>
				<th><?php esc_html_e( 'DTI', 'ds-debt-calc' ); ?></th>
				<th><?php esc_html_e( 'Recommended', 'ds-debt-calc' ); ?></th>
				<th><?php esc_html_e( 'Call Time', 'ds-debt-calc' ); ?></th>
				<th><?php esc_html_e( 'Lang', 'ds-debt-calc' ); ?></th>
				<th><?php esc_html_e( 'Actions', 'ds-debt-calc' ); ?></th>
			</tr></thead>
			<tbody>
			<?php while ( $query->have_posts() ) :
				$query->the_post();
				$id = get_the_ID();
				$m  = function( $key ) use ( $id ) {
					return get_post_meta( $id, $key, true );
				};

				$name     = $m( '_ds_lead_name' )     ?: '—';
				$email    = $m( '_ds_lead_email' )    ?: '';
				$phone    = $m( '_ds_lead_phone' )    ?: '—';
				$province = $m( '_ds_lead_province' ) ?: '—';
				$debt     = (int) $m( '_ds_lead_debt' );
				$income   = (int) $m( '_ds_lead_income' );
				$surplus  = (int) $m( '_ds_lead_surplus' );
				$dti      = (int) $m( '_ds_lead_dti' );
				$call_t   = $m( '_ds_lead_call_time' )           ?: '—';
				$rec_pmt  = (int) $m( '_ds_lead_recommended_payment' );
				$rec_tot  = (int) $m( '_ds_lead_recommended_total' );
				$lang     = $m( '_ds_lead_lang' )     ?: 'en';
				$date     = $m( '_ds_lead_date' )     ?: get_the_date( 'Y-m-d H:i' );

				$rec_label = ds_calc_guess_recommended( $debt, $rec_pmt, $rec_tot );
			?>
				<tr>
					<td><?php echo esc_html( $date ); ?></td>
					<td>
						<strong><?php echo esc_html( $name ); ?></strong>
						<?php if ( $email ) : ?>
							<br><a href="mailto:<?php echo esc_attr( $email ); ?>" style="font-size:11px;color:#666;"><?php echo esc_html( $email ); ?></a>
						<?php endif; ?>
					</td>
					<td><?php echo esc_html( $province ); ?></td>
					<td class="money">$<?php echo esc_html( number_format( $debt ) ); ?></td>
					<td class="money">$<?php echo esc_html( number_format( $income ) ); ?></td>
					<td class="money">$<?php echo esc_html( number_format( $surplus ) ); ?></td>
					<td><?php echo esc_html( $dti ); ?>%</td>
					<td>
						<?php if ( $rec_label ) : ?>
							<span class="ds-badge ds-badge--<?php echo esc_attr( $rec_label ); ?>">
								<?php echo esc_html( ucfirst( $rec_label ) ); ?>
							</span>
						<?php else : ?>—<?php endif; ?>
					</td>
					<td><?php echo esc_html( $call_t ); ?></td>
					<td><span class="ds-badge ds-badge--<?php echo esc_attr( $lang ); ?>"><?php echo esc_html( strtoupper( $lang ) ); ?></span></td>
					<td>
						<button type="button" class="button button-small" onclick="dsCalcOpenModal(<?php echo esc_js( $id ); ?>)">
							<?php esc_html_e( 'View', 'ds-debt-calc' ); ?>
						</button>
					</td>
				</tr>

				<div id="ds-calc-modal-<?php echo esc_attr( $id ); ?>" class="ds-modal-overlay" onclick="if(event.target===this)dsCalcCloseModal(<?php echo esc_js( $id ); ?>)">
					<div class="ds-modal">
						<button class="ds-modal-close" onclick="dsCalcCloseModal(<?php echo esc_js( $id ); ?>)" aria-label="Close">&times;</button>
						<h3><?php echo esc_html( $name ); ?> &mdash; <?php echo esc_html( $date ); ?></h3>

						<div class="ds-modal-section">
							<h4><?php esc_html_e( 'Contact', 'ds-debt-calc' ); ?></h4>
							<div class="ds-detail-grid">
								<div class="ds-detail-item"><label><?php esc_html_e( 'Name', 'ds-debt-calc' ); ?></label><span><?php echo esc_html( $name ); ?></span></div>
								<div class="ds-detail-item"><label><?php esc_html_e( 'Email', 'ds-debt-calc' ); ?></label><span><?php echo $email ? '<a href="mailto:' . esc_attr( $email ) . '">' . esc_html( $email ) . '</a>' : '—'; ?></span></div>
								<div class="ds-detail-item"><label><?php esc_html_e( 'Phone', 'ds-debt-calc' ); ?></label><span><?php echo $phone !== '—' ? '<a href="tel:' . esc_attr( preg_replace( '/\D/', '', $phone ) ) . '">' . esc_html( $phone ) . '</a>' : '—'; ?></span></div>
								<div class="ds-detail-item"><label><?php esc_html_e( 'Best Call Time', 'ds-debt-calc' ); ?></label><span><?php echo esc_html( $call_t ); ?></span></div>
								<div class="ds-detail-item"><label><?php esc_html_e( 'Language', 'ds-debt-calc' ); ?></label><span><?php echo esc_html( strtoupper( $lang ) ); ?></span></div>
								<div class="ds-detail-item"><label><?php esc_html_e( 'Province', 'ds-debt-calc' ); ?></label><span><?php echo esc_html( $province ); ?></span></div>
							</div>
						</div>

						<div class="ds-modal-section">
							<h4><?php esc_html_e( 'Financial Summary', 'ds-debt-calc' ); ?></h4>
							<div class="ds-detail-grid">
								<div class="ds-detail-item"><label><?php esc_html_e( 'Total Debt', 'ds-debt-calc' ); ?></label><span>$<?php echo esc_html( number_format( $debt ) ); ?></span></div>
								<div class="ds-detail-item"><label><?php esc_html_e( 'Monthly Income', 'ds-debt-calc' ); ?></label><span>$<?php echo esc_html( number_format( $income ) ); ?>/mo</span></div>
								<div class="ds-detail-item"><label><?php esc_html_e( 'Monthly Expenses', 'ds-debt-calc' ); ?></label><span>$<?php echo esc_html( number_format( (int) $m( '_ds_lead_expenses' ) ) ); ?>/mo</span></div>
								<div class="ds-detail-item"><label><?php esc_html_e( 'Monthly Surplus', 'ds-debt-calc' ); ?></label><span>$<?php echo esc_html( number_format( $surplus ) ); ?>/mo</span></div>
								<div class="ds-detail-item"><label><?php esc_html_e( 'Debt-to-Income', 'ds-debt-calc' ); ?></label><span><?php echo esc_html( $dti ); ?>%</span></div>
								<div class="ds-detail-item"><label><?php esc_html_e( 'Annual Rate Used', 'ds-debt-calc' ); ?></label><span><?php echo esc_html( number_format( (float) $m( '_ds_lead_annual_rate' ) * 100, 2 ) ); ?>% APR <?php echo $m( '_ds_lead_is_advanced' ) === '1' ? '(blended)' : '(estimated)'; ?></span></div>
							</div>
						</div>

						<div class="ds-modal-section">
							<h4><?php esc_html_e( 'Recommended Option', 'ds-debt-calc' ); ?></h4>
							<div class="ds-detail-grid">
								<div class="ds-detail-item"><label><?php esc_html_e( 'Monthly Payment', 'ds-debt-calc' ); ?></label><span>$<?php echo esc_html( number_format( $rec_pmt ) ); ?>/mo</span></div>
								<div class="ds-detail-item"><label><?php esc_html_e( 'Total Cost', 'ds-debt-calc' ); ?></label><span>$<?php echo esc_html( number_format( $rec_tot ) ); ?></span></div>
							</div>
						</div>
					</div>
				</div>

			<?php endwhile; wp_reset_postdata(); ?>
			</tbody>
		</table>

		<?php if ( $total_pages > 1 ) : ?>
		<div class="ds-pagination">
			<?php for ( $i = 1; $i <= $total_pages; $i++ ) :
				$url = add_query_arg( 'paged', $i, $base_url );
				if ( $province_f ) $url = add_query_arg( 'province', $province_f, $url );
				if ( $lang_f )     $url = add_query_arg( 'lang', $lang_f, $url );
				if ( $i === $current_page ) : ?>
					<span class="current"><?php echo esc_html( $i ); ?></span>
				<?php else : ?>
					<a href="<?php echo esc_url( $url ); ?>"><?php echo esc_html( $i ); ?></a>
				<?php endif;
			endfor; ?>
		</div>
		<?php endif; ?>

	<?php endif; ?>
	<?php
}

// ── Settings tab ───────────────────────────────────────────────────────────

function ds_calc_render_settings_tab(): void {
	$firm_name       = get_option( 'ds_calc_firm_name',    'Doyle Salewski' );
	$phone           = get_option( 'ds_calc_phone',        '(613) 237-5555' );
	$email_to        = get_option( 'ds_calc_email_to',     get_option( 'admin_email' ) );
	$crm_webhook     = get_option( 'ds_calc_crm_webhook',  '' );
	$proposal_rate   = get_option( 'ds_calc_proposal_rate',   '0.30' );
	$proposal_months = get_option( 'ds_calc_proposal_months', '60' );
	$dmp_fee         = get_option( 'ds_calc_dmp_fee',         '0.055' );
	$dmp_months      = get_option( 'ds_calc_dmp_months',      '60' );
	$cons_rate       = get_option( 'ds_calc_cons_rate',       '0.1699' );
	$cons_months     = get_option( 'ds_calc_cons_months',     '60' );
	$default_rate    = get_option( 'ds_calc_default_rate',    '0.2199' );
	$min_pmt_pct     = get_option( 'ds_calc_min_pmt_pct',    '0.025' );
	$rate_cc         = get_option( 'ds_calc_rate_credit_card', '0.1999' );
	$rate_loc        = get_option( 'ds_calc_rate_loc',         '0.0850' );
	$rate_cra        = get_option( 'ds_calc_rate_cra',         '0.0900' );
	$rate_student    = get_option( 'ds_calc_rate_student',     '0.0750' );
	$rate_payday     = get_option( 'ds_calc_rate_payday',      '0.2999' );
	$rate_personal   = get_option( 'ds_calc_rate_personal',    '0.1499' );
	$rate_other      = get_option( 'ds_calc_rate_other',       '0.1999' );
	?>
	<form method="post" action="">
		<?php wp_nonce_field( 'ds_calc_save_admin_settings', 'ds_calc_admin_nonce' ); ?>

		<?php // ── Section 1: Firm Settings ───────────────────────────────── ?>
		<div class="ds-settings-section">
			<h3><?php esc_html_e( 'Firm Settings', 'ds-debt-calc' ); ?></h3>
			<p class="description"><?php esc_html_e( 'Displayed in the calculator and notification emails.', 'ds-debt-calc' ); ?></p>
			<table class="form-table" role="presentation">
				<tr>
					<th><label for="ds_calc_firm_name"><?php esc_html_e( 'Firm Name', 'ds-debt-calc' ); ?></label></th>
					<td><input type="text" id="ds_calc_firm_name" name="ds_calc_firm_name" value="<?php echo esc_attr( $firm_name ); ?>" class="regular-text"></td>
				</tr>
				<tr>
					<th><label for="ds_calc_phone"><?php esc_html_e( 'Phone Number', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="text" id="ds_calc_phone" name="ds_calc_phone" value="<?php echo esc_attr( $phone ); ?>" class="regular-text">
						<p class="description"><?php esc_html_e( 'Shown in the CTA section and confirmation modal.', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_email_to"><?php esc_html_e( 'Lead Notification Email', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="email" id="ds_calc_email_to" name="ds_calc_email_to" value="<?php echo esc_attr( $email_to ); ?>" class="regular-text">
						<p class="description"><?php esc_html_e( 'Receives an email for every lead submitted through the calculator.', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_crm_webhook"><?php esc_html_e( 'CRM Webhook URL', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="url" id="ds_calc_crm_webhook" name="ds_calc_crm_webhook" value="<?php echo esc_attr( $crm_webhook ); ?>" class="regular-text" placeholder="https://">
						<p class="description"><?php esc_html_e( 'Optional. Full lead payload is POSTed as JSON to this URL on each submission.', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
			</table>
		</div>

		<?php // ── Section 2: Consumer Proposal ──────────────────────────── ?>
		<div class="ds-settings-section">
			<h3><?php esc_html_e( 'Consumer Proposal', 'ds-debt-calc' ); ?></h3>
			<p class="description"><?php esc_html_e( 'A legally binding agreement to repay a portion of unsecured debt. Administered by a Licensed Insolvency Trustee.', 'ds-debt-calc' ); ?></p>
			<table class="form-table" role="presentation">
				<tr>
					<th><label for="ds_calc_proposal_rate"><?php esc_html_e( 'Settlement Rate', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_proposal_rate" name="ds_calc_proposal_rate"
							value="<?php echo esc_attr( $proposal_rate ); ?>"
							min="0.10" max="0.80" step="0.01" class="small-text">
						<p class="description"><?php esc_html_e( 'Decimal. Default: 0.30 (30¢ on the dollar). Typical range: 0.20–0.50.', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_proposal_months"><?php esc_html_e( 'Term (months)', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_proposal_months" name="ds_calc_proposal_months"
							value="<?php echo esc_attr( $proposal_months ); ?>"
							min="12" max="60" step="1" class="small-text">
						<p class="description"><?php esc_html_e( 'Default: 60 months (5 years). Maximum allowed by law: 60.', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
			</table>
		</div>

		<?php // ── Section 3: Debt Management Plan ───────────────────────── ?>
		<div class="ds-settings-section">
			<h3><?php esc_html_e( 'Debt Management Plan (DMP)', 'ds-debt-calc' ); ?></h3>
			<p class="description"><?php esc_html_e( 'A voluntary repayment arrangement with creditors through a credit counselling agency. Repays 100% of principal.', 'ds-debt-calc' ); ?></p>
			<table class="form-table" role="presentation">
				<tr>
					<th><label for="ds_calc_dmp_fee"><?php esc_html_e( 'Admin Fee', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_dmp_fee" name="ds_calc_dmp_fee"
							value="<?php echo esc_attr( $dmp_fee ); ?>"
							min="0.01" max="0.20" step="0.001" class="small-text">
						<p class="description"><?php esc_html_e( 'Decimal. Default: 0.055 (5.5%). Added on top of the principal.', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_dmp_months"><?php esc_html_e( 'Term (months)', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_dmp_months" name="ds_calc_dmp_months"
							value="<?php echo esc_attr( $dmp_months ); ?>"
							min="12" max="120" step="1" class="small-text">
						<p class="description"><?php esc_html_e( 'Default: 60 months (5 years).', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
			</table>
		</div>

		<?php // ── Section 4: Consolidation Loan ─────────────────────────── ?>
		<div class="ds-settings-section">
			<h3><?php esc_html_e( 'Consolidation Loan', 'ds-debt-calc' ); ?></h3>
			<p class="description"><?php esc_html_e( 'A new loan from a bank or lender used to pay off existing debts. Requires a minimum credit score to qualify.', 'ds-debt-calc' ); ?></p>
			<table class="form-table" role="presentation">
				<tr>
					<th><label for="ds_calc_cons_rate"><?php esc_html_e( 'Interest Rate (APR)', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_cons_rate" name="ds_calc_cons_rate"
							value="<?php echo esc_attr( $cons_rate ); ?>"
							min="0.05" max="0.35" step="0.0001" class="small-text">
						<p class="description"><?php esc_html_e( 'Decimal. Default: 0.1699 (16.99% APR). Adjust to reflect current market rates.', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_cons_months"><?php esc_html_e( 'Term (months)', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_cons_months" name="ds_calc_cons_months"
							value="<?php echo esc_attr( $cons_months ); ?>"
							min="12" max="120" step="1" class="small-text">
						<p class="description"><?php esc_html_e( 'Default: 60 months (5 years).', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
			</table>
		</div>

		<?php // ── Section 5: Do Nothing defaults ───────────────────────── ?>
		<div class="ds-settings-section">
			<h3><?php esc_html_e( '"Do Nothing" Assumptions', 'ds-debt-calc' ); ?></h3>
			<p class="description"><?php esc_html_e( 'Used to simulate the cost of making only minimum payments indefinitely. Shown as a cautionary reference — not a recommended path.', 'ds-debt-calc' ); ?></p>
			<table class="form-table" role="presentation">
				<tr>
					<th><label for="ds_calc_default_rate"><?php esc_html_e( 'Default Interest Rate (APR)', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_default_rate" name="ds_calc_default_rate"
							value="<?php echo esc_attr( $default_rate ); ?>"
							min="0.05" max="0.50" step="0.0001" class="small-text">
						<p class="description"><?php esc_html_e( 'Decimal. Default: 0.2199 (21.99% APR). Applied when no debt breakdown is provided. Based on Canadian average unsecured consumer debt rate.', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_min_pmt_pct"><?php esc_html_e( 'Minimum Payment %', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_min_pmt_pct" name="ds_calc_min_pmt_pct"
							value="<?php echo esc_attr( $min_pmt_pct ); ?>"
							min="0.01" max="0.10" step="0.001" class="small-text">
						<p class="description"><?php esc_html_e( 'Decimal. Default: 0.025 (2.5% of balance per month). Industry standard for most Canadian credit cards.', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
			</table>
		</div>

		<?php // ── Section 6: Interest Rates by Debt Type ───────────────── ?>
		<div class="ds-settings-section">
			<h3><?php esc_html_e( 'Interest Rates by Debt Type', 'ds-debt-calc' ); ?></h3>
			<p class="description"><?php esc_html_e( 'Used to calculate a blended weighted interest rate when a user provides a detailed debt breakdown. Enter as decimals (e.g. 0.1999 = 19.99% APR).', 'ds-debt-calc' ); ?></p>
			<table class="form-table" role="presentation">
				<tr>
					<th><label for="ds_calc_rate_credit_card"><?php esc_html_e( 'Credit Card', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_rate_credit_card" name="ds_calc_rate_credit_card"
							value="<?php echo esc_attr( $rate_cc ); ?>"
							min="0.05" max="0.50" step="0.0001" class="small-text">
						<p class="description"><?php esc_html_e( 'Default: 0.1999 (19.99%)', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_rate_loc"><?php esc_html_e( 'Line of Credit', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_rate_loc" name="ds_calc_rate_loc"
							value="<?php echo esc_attr( $rate_loc ); ?>"
							min="0.01" max="0.30" step="0.0001" class="small-text">
						<p class="description"><?php esc_html_e( 'Default: 0.0850 (8.50%)', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_rate_cra"><?php esc_html_e( 'CRA / Tax Debt', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_rate_cra" name="ds_calc_rate_cra"
							value="<?php echo esc_attr( $rate_cra ); ?>"
							min="0.01" max="0.30" step="0.0001" class="small-text">
						<p class="description"><?php esc_html_e( 'Default: 0.0900 (9.00%)', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_rate_student"><?php esc_html_e( 'Student Loan', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_rate_student" name="ds_calc_rate_student"
							value="<?php echo esc_attr( $rate_student ); ?>"
							min="0.01" max="0.25" step="0.0001" class="small-text">
						<p class="description"><?php esc_html_e( 'Default: 0.0750 (7.50%)', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_rate_payday"><?php esc_html_e( 'Payday Loan', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_rate_payday" name="ds_calc_rate_payday"
							value="<?php echo esc_attr( $rate_payday ); ?>"
							min="0.10" max="0.60" step="0.0001" class="small-text">
						<p class="description"><?php esc_html_e( 'Default: 0.2999 (29.99%)', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_rate_personal"><?php esc_html_e( 'Personal Loan', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_rate_personal" name="ds_calc_rate_personal"
							value="<?php echo esc_attr( $rate_personal ); ?>"
							min="0.05" max="0.40" step="0.0001" class="small-text">
						<p class="description"><?php esc_html_e( 'Default: 0.1499 (14.99%)', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
				<tr>
					<th><label for="ds_calc_rate_other"><?php esc_html_e( 'Other Debt', 'ds-debt-calc' ); ?></label></th>
					<td>
						<input type="number" id="ds_calc_rate_other" name="ds_calc_rate_other"
							value="<?php echo esc_attr( $rate_other ); ?>"
							min="0.05" max="0.50" step="0.0001" class="small-text">
						<p class="description"><?php esc_html_e( 'Default: 0.1999 (19.99%)', 'ds-debt-calc' ); ?></p>
					</td>
				</tr>
			</table>
		</div>

		<?php submit_button( __( 'Save Settings', 'ds-debt-calc' ) ); ?>
	</form>
	<?php
}

// ── Save settings ──────────────────────────────────────────────────────────

function ds_calc_save_admin_settings(): void {
	if ( ! current_user_can( 'manage_options' ) ) { return; }
	if ( ! isset( $_POST['ds_calc_admin_nonce'] ) ||
	     ! wp_verify_nonce( $_POST['ds_calc_admin_nonce'], 'ds_calc_save_admin_settings' ) ) { return; }

	update_option( 'ds_calc_firm_name',   sanitize_text_field( wp_unslash( $_POST['ds_calc_firm_name']   ?? '' ) ) );
	update_option( 'ds_calc_phone',       sanitize_text_field( wp_unslash( $_POST['ds_calc_phone']       ?? '' ) ) );
	update_option( 'ds_calc_email_to',    sanitize_email(      wp_unslash( $_POST['ds_calc_email_to']    ?? '' ) ) );
	update_option( 'ds_calc_crm_webhook', esc_url_raw(         wp_unslash( $_POST['ds_calc_crm_webhook'] ?? '' ) ) );

	// Proposal
	update_option( 'ds_calc_proposal_rate',   max( 0.10, min( 0.80, (float) ( $_POST['ds_calc_proposal_rate']   ?? 0.30  ) ) ) );
	update_option( 'ds_calc_proposal_months', max( 12,   min( 60,   (int)   ( $_POST['ds_calc_proposal_months'] ?? 60    ) ) ) );

	// DMP
	update_option( 'ds_calc_dmp_fee',    max( 0.01, min( 0.20, (float) ( $_POST['ds_calc_dmp_fee']    ?? 0.055 ) ) ) );
	update_option( 'ds_calc_dmp_months', max( 12,   min( 120,  (int)   ( $_POST['ds_calc_dmp_months'] ?? 60    ) ) ) );

	// Consolidation
	update_option( 'ds_calc_cons_rate',   max( 0.05, min( 0.35, (float) ( $_POST['ds_calc_cons_rate']   ?? 0.1699 ) ) ) );
	update_option( 'ds_calc_cons_months', max( 12,   min( 120,  (int)   ( $_POST['ds_calc_cons_months'] ?? 60     ) ) ) );

	// Do Nothing defaults
	update_option( 'ds_calc_default_rate', max( 0.05, min( 0.50, (float) ( $_POST['ds_calc_default_rate'] ?? 0.2199 ) ) ) );
	update_option( 'ds_calc_min_pmt_pct',  max( 0.01, min( 0.10, (float) ( $_POST['ds_calc_min_pmt_pct']  ?? 0.025  ) ) ) );

	// Debt type rates
	$debt_rate_fields = [
		'ds_calc_rate_credit_card' => [ 'default' => 0.1999, 'min' => 0.05, 'max' => 0.50 ],
		'ds_calc_rate_loc'         => [ 'default' => 0.0850, 'min' => 0.01, 'max' => 0.30 ],
		'ds_calc_rate_cra'         => [ 'default' => 0.0900, 'min' => 0.01, 'max' => 0.30 ],
		'ds_calc_rate_student'     => [ 'default' => 0.0750, 'min' => 0.01, 'max' => 0.25 ],
		'ds_calc_rate_payday'      => [ 'default' => 0.2999, 'min' => 0.10, 'max' => 0.60 ],
		'ds_calc_rate_personal'    => [ 'default' => 0.1499, 'min' => 0.05, 'max' => 0.40 ],
		'ds_calc_rate_other'       => [ 'default' => 0.1999, 'min' => 0.05, 'max' => 0.50 ],
	];
	foreach ( $debt_rate_fields as $key => $cfg ) {
		$val = (float) ( $_POST[ $key ] ?? $cfg['default'] );
		update_option( $key, max( $cfg['min'], min( $cfg['max'], $val ) ) );
	}
}

// ── CSV export ─────────────────────────────────────────────────────────────

function ds_calc_export_csv(): void {
	$province_f = sanitize_text_field( $_GET['province'] ?? '' );
	$lang_f     = sanitize_text_field( $_GET['lang']     ?? '' );

	$meta_query = [ 'relation' => 'AND' ];
	if ( $province_f ) {
		$meta_query[] = [ 'key' => '_ds_lead_province', 'value' => $province_f, 'compare' => '=' ];
	}
	if ( $lang_f ) {
		$meta_query[] = [ 'key' => '_ds_lead_lang', 'value' => $lang_f, 'compare' => '=' ];
	}

	$query = new WP_Query( [
		'post_type'      => 'ds_calc_lead',
		'post_status'    => 'publish',
		'posts_per_page' => 9999,
		'orderby'        => 'date',
		'order'          => 'DESC',
		'meta_query'     => $meta_query,
	] );

	$filename = 'ds-calc-leads-' . gmdate( 'Y-m-d' ) . '.csv';
	header( 'Content-Type: text/csv; charset=utf-8' );
	header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
	header( 'Pragma: no-cache' );
	header( 'Expires: 0' );

	$out = fopen( 'php://output', 'w' );
	fputs( $out, "\xEF\xBB\xBF" ); // UTF-8 BOM for Excel

	fputcsv( $out, [
		'Date', 'Name', 'Email', 'Phone', 'Call Time', 'Language',
		'Province', 'Debt', 'Income', 'Expenses', 'Surplus', 'DTI (%)',
		'Annual Rate (%)', 'Rate Type', 'Recommended Payment', 'Recommended Total',
	] );

	while ( $query->have_posts() ) {
		$query->the_post();
		$id = get_the_ID();
		$m  = function( $key ) use ( $id ) { return get_post_meta( $id, $key, true ); };

		fputcsv( $out, [
			$m( '_ds_lead_date' ),
			$m( '_ds_lead_name' ),
			$m( '_ds_lead_email' ),
			$m( '_ds_lead_phone' ),
			$m( '_ds_lead_call_time' ),
			strtoupper( $m( '_ds_lead_lang' ) ?: 'EN' ),
			$m( '_ds_lead_province' ),
			$m( '_ds_lead_debt' ),
			$m( '_ds_lead_income' ),
			$m( '_ds_lead_expenses' ),
			$m( '_ds_lead_surplus' ),
			$m( '_ds_lead_dti' ),
			number_format( (float) $m( '_ds_lead_annual_rate' ) * 100, 2 ),
			$m( '_ds_lead_is_advanced' ) === '1' ? 'Blended' : 'Estimated',
			$m( '_ds_lead_recommended_payment' ),
			$m( '_ds_lead_recommended_total' ),
		] );
	}
	wp_reset_postdata();
	fclose( $out );
}

// ── Helper: guess recommended option from payment amount ───────────────────

function ds_calc_guess_recommended( int $debt, int $rec_pmt, int $rec_tot ): string {
	if ( $debt <= 0 || $rec_pmt <= 0 ) return '';
	$proposal_pmt = round( $debt * 0.30 / 60 );
	if ( abs( $rec_pmt - $proposal_pmt ) < 20 ) return 'proposal';
	$dmp_pmt = round( $debt * 1.055 / 60 );
	if ( abs( $rec_pmt - $dmp_pmt ) < 20 ) return 'dmp';
	$cr = 0.1699 / 12;
	$cons_pmt = round( ( $debt * $cr * pow( 1 + $cr, 60 ) ) / ( pow( 1 + $cr, 60 ) - 1 ) );
	if ( abs( $rec_pmt - $cons_pmt ) < 20 ) return 'consolidation';
	return 'proposal';
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
