/**
 * Doraha Eats — database schema (Drizzle ORM / PostgreSQL)
 *
 * Rule: every money value is an INTEGER number of PAISE. Never a float.
 * Rule: every table carries createdAt / updatedAt.
 */
import { relations } from 'drizzle-orm';
import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp,
  doublePrecision, jsonb, uniqueIndex, index, primaryKey,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ enums */

export const roleEnum = pgEnum('role', ['CUSTOMER', 'VENDOR', 'DELIVERY', 'ADMIN']);
export const accountStatusEnum = pgEnum('account_status', ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED']);
export const orderStatusEnum = pgEnum('order_status', [
  'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED',
  'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED',
]);
export const paymentMethodEnum = pgEnum('payment_method', ['COD', 'UPI']);
export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING', 'AWAITING_VERIFICATION', 'PAID', 'FAILED', 'REFUNDED',
]);
export const assignmentStateEnum = pgEnum('assignment_state', [
  'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'COMPLETED',
]);
export const complaintStatusEnum = pgEnum('complaint_status', [
  'OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED',
]);

// --- Phase 2 additions ---
export const shopStatusEnum = pgEnum('shop_status', ['OPEN', 'CLOSED', 'PAUSED']);

export const vendorApplicationStatusEnum = pgEnum('vendor_application_status', [
  'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
]);

export const billingPeriodEnum = pgEnum('billing_period', [
  'TRIAL', 'MONTHLY', 'QUARTERLY', 'YEARLY',
]);

export const subscriptionStateEnum = pgEnum('subscription_state', [
  'TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED',
]);

const ts = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ users */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: roleEnum('role').notNull(),
  email: text('email').unique(),
  phone: text('phone').unique(),
  passwordHash: text('password_hash'),
  googleId: text('google_id').unique(),
  passwordResetTokenHash: text('password_reset_token_hash'),
  passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),
  fullName: text('full_name').notNull(),
  avatarUrl: text('avatar_url'),
  locale: text('locale').notNull().default('en'),
  status: accountStatusEnum('status').notNull().default('ACTIVE'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  ...ts(),
}, (t) => ({
  roleStatusIdx: index('users_role_status_idx').on(t.role, t.status),
}));

export const customerProfiles = pgTable('customer_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  defaultZoneId: uuid('default_zone_id').references(() => deliveryZones.id),
  totalOrders: integer('total_orders').notNull().default(0),
  ...ts(),
});

export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  platform: text('platform').notNull(),
  ...ts(),
});

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  consumed: boolean('consumed').notNull().default(false),
  ...ts(),
}, (t) => ({
  phoneIdx: index('otp_phone_idx').on(t.phone, t.expiresAt),
}));

/* --------------------------------------------------------- delivery zones */

export const deliveryZones = pgTable('delivery_zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  city: text('city').notNull().default('Doraha'),
  district: text('district').notNull().default('Ludhiana'),
  state: text('state').notNull().default('Punjab'),
  country: text('country').notNull().default('India'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  radiusMeters: integer('radius_meters').notNull(),
  deliveryFeePaise: integer('delivery_fee_paise').notNull(),
  minOrderPaise: integer('min_order_paise').notNull().default(0),
  etaMinutes: integer('eta_minutes').notNull().default(35),
  priority: integer('priority').notNull().default(0),
  isActive: boolean('is_active').notNull().default(false),
  ...ts(),
}, (t) => ({
  activeIdx: index('zones_active_idx').on(t.isActive),
}));

export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull().default('HOME'),
  area: text('area').notNull(),
  line1: text('line1').notNull(),
  landmark: text('landmark'),
  pincode: text('pincode'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  zoneId: uuid('zone_id').references(() => deliveryZones.id),
  isDefault: boolean('is_default').notNull().default(false),
  ...ts(),
}, (t) => ({
  userIdx: index('addresses_user_idx').on(t.userId),
}));

/* ------------------------------------------------------- categories/vendor */

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  nameHi: text('name_hi'),
  namePa: text('name_pa'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...ts(),
});

export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  zoneId: uuid('zone_id').notNull().references(() => deliveryZones.id),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerName: text('owner_name').notNull(),
  phone: text('phone').notNull(),
  about: text('about'),
  addressLine: text('address_line').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  logoUrl: text('logo_url'),
  coverUrl: text('cover_url'),
  prepTimeMinutes: integer('prep_time_minutes').notNull().default(20),
  commissionPct: doublePrecision('commission_pct'),
  status: accountStatusEnum('status').notNull().default('PENDING'),
  isOpenManual: boolean('is_open_manual').notNull().default(true),
  shopStatus: shopStatusEnum('shop_status').notNull().default('CLOSED'),
  isDemo: boolean('is_demo').notNull().default(false),
  ratingAvg: doublePrecision('rating_avg').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  ...ts(),
}, (t) => ({
  zoneStatusIdx: index('vendors_zone_status_idx').on(t.zoneId, t.status),
}));

export const vendorCategories = pgTable('vendor_categories', {
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.vendorId, t.categoryId] }),
}));

export const vendorHours = pgTable('vendor_hours', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday
  opensAt: text('opens_at').notNull(),         // "09:00"
  closesAt: text('closes_at').notNull(),       // "23:00"
}, (t) => ({
  vendorIdx: index('vendor_hours_vendor_idx').on(t.vendorId),
}));

export const menuSections = pgTable('menu_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...ts(),
});

export const foodItems = pgTable('food_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').references(() => menuSections.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').references(() => categories.id),
  name: text('name').notNull(),
  description: text('description'),
  pricePaise: integer('price_paise').notNull(),
  imageUrl: text('image_url'),
  isVeg: boolean('is_veg').notNull().default(true),
  prepTimeMinutes: integer('prep_time_minutes'),
  isAvailable: boolean('is_available').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...ts(),
}, (t) => ({
  vendorIdx: index('food_vendor_idx').on(t.vendorId, t.isAvailable),
  categoryIdx: index('food_category_idx').on(t.categoryId),
}));

export const customizationGroups = pgTable('customization_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  foodItemId: uuid('food_item_id').notNull().references(() => foodItems.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  minSelect: integer('min_select').notNull().default(0),
  maxSelect: integer('max_select').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => ({
  itemIdx: index('cust_group_item_idx').on(t.foodItemId),
}));

export const customizationOptions = pgTable('customization_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => customizationGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  priceDeltaPaise: integer('price_delta_paise').notNull().default(0),
  isAvailable: boolean('is_available').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

/* ------------------------------------------------------------------- cart */

export const carts = pgTable('carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  ...ts(),
});

export const cartItems = pgTable('cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  cartId: uuid('cart_id').notNull().references(() => carts.id, { onDelete: 'cascade' }),
  foodItemId: uuid('food_item_id').notNull().references(() => foodItems.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
  instructions: text('instructions'),
  ...ts(),
}, (t) => ({
  cartIdx: index('cart_items_cart_idx').on(t.cartId),
}));

export const cartItemOptions = pgTable('cart_item_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  cartItemId: uuid('cart_item_id').notNull().references(() => cartItems.id, { onDelete: 'cascade' }),
  optionId: uuid('option_id').notNull().references(() => customizationOptions.id, { onDelete: 'cascade' }),
}, (t) => ({
  uniq: uniqueIndex('cart_item_option_uniq').on(t.cartItemId, t.optionId),
}));

/* ----------------------------------------------------------------- orders */

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => users.id),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  zoneId: uuid('zone_id').notNull().references(() => deliveryZones.id),
  addressId: uuid('address_id').references(() => addresses.id),
  status: orderStatusEnum('status').notNull().default('PLACED'),

  // frozen delivery target
  addressLine: text('address_line').notNull(),
  addressArea: text('address_area').notNull(),
  addressLandmark: text('address_landmark'),
  addressLatitude: doublePrecision('address_latitude').notNull(),
  addressLongitude: doublePrecision('address_longitude').notNull(),
  contactPhone: text('contact_phone').notNull(),

  // frozen money (paise)
  subtotalPaise: integer('subtotal_paise').notNull(),
  deliveryFeePaise: integer('delivery_fee_paise').notNull(),
  platformFeePaise: integer('platform_fee_paise').notNull().default(0),
  taxPaise: integer('tax_paise').notNull().default(0),
  discountPaise: integer('discount_paise').notNull().default(0),
  totalPaise: integer('total_paise').notNull(),
  commissionPaise: integer('commission_paise').notNull().default(0),

  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('PENDING'),
  etaMinutes: integer('eta_minutes').notNull(),
  cookingNote: text('cooking_note'),
  cancelReason: text('cancel_reason'),
  cancelledById: uuid('cancelled_by_id').references(() => users.id),

  placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  ...ts(),
}, (t) => ({
  customerIdx: index('orders_customer_idx').on(t.customerId, t.placedAt),
  vendorIdx: index('orders_vendor_idx').on(t.vendorId, t.status),
  zoneIdx: index('orders_zone_idx').on(t.zoneId, t.placedAt),
  statusIdx: index('orders_status_idx').on(t.status),
}));

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  foodItemId: uuid('food_item_id').references(() => foodItems.id, { onDelete: 'set null' }),
  nameSnapshot: text('name_snapshot').notNull(),
  basePricePaise: integer('base_price_paise').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
  quantity: integer('quantity').notNull(),
  instructions: text('instructions'),
}, (t) => ({
  orderIdx: index('order_items_order_idx').on(t.orderId),
}));

export const orderItemOptions = pgTable('order_item_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderItemId: uuid('order_item_id').notNull().references(() => orderItems.id, { onDelete: 'cascade' }),
  nameSnapshot: text('name_snapshot').notNull(),
  priceDeltaPaise: integer('price_delta_paise').notNull(),
});

export const orderStatusEvents = pgTable('order_status_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: orderStatusEnum('status').notNull(),
  actorId: uuid('actor_id').references(() => users.id),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orderIdx: index('order_events_order_idx').on(t.orderId, t.createdAt),
}));

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().unique().references(() => orders.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  status: paymentStatusEnum('status').notNull().default('PENDING'),
  amountPaise: integer('amount_paise').notNull(),
  upiRef: text('upi_ref'),
  providerRef: text('provider_ref'),
  verifiedById: uuid('verified_by_id').references(() => users.id),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  raw: jsonb('raw'),
  ...ts(),
});

/* --------------------------------------------------------------- delivery */

export const deliveryPartners = pgTable('delivery_partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  vehicle: text('vehicle').notNull().default('BIKE'),
  idProofUrl: text('id_proof_url'),
  status: accountStatusEnum('status').notNull().default('PENDING'),
  isOnline: boolean('is_online').notNull().default(false),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  isDemo: boolean('is_demo').notNull().default(false),
  ...ts(),
}, (t) => ({
  statusIdx: index('partners_status_idx').on(t.status, t.isOnline),
}));

export const deliveryAssignments = pgTable('delivery_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  partnerId: uuid('partner_id').notNull().references(() => deliveryPartners.id, { onDelete: 'cascade' }),
  state: assignmentStateEnum('state').notNull().default('OFFERED'),
  payoutPaise: integer('payout_paise').notNull().default(0),
  codCollectedPaise: integer('cod_collected_paise'),
  offeredAt: timestamp('offered_at', { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  ...ts(),
}, (t) => ({
  uniq: uniqueIndex('assignment_order_partner_uniq').on(t.orderId, t.partnerId),
  partnerIdx: index('assignments_partner_idx').on(t.partnerId, t.state),
}));

/* ------------------------------------------------------------- engagement */

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().unique().references(() => orders.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  partnerId: uuid('partner_id').references(() => deliveryPartners.id),
  rating: integer('rating').notNull(),
  deliveryRating: integer('delivery_rating'),
  comment: text('comment'),
  isHidden: boolean('is_hidden').notNull().default(false),
  ...ts(),
}, (t) => ({
  vendorIdx: index('reviews_vendor_idx').on(t.vendorId, t.isHidden),
}));

export const favorites = pgTable('favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'cascade' }),
  foodItemId: uuid('food_item_id').references(() => foodItems.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  vendorUniq: uniqueIndex('fav_user_vendor_uniq').on(t.userId, t.vendorId),
  itemUniq: uniqueIndex('fav_user_item_uniq').on(t.userId, t.foodItemId),
}));

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: jsonb('data'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('notifications_user_idx').on(t.userId, t.createdAt),
}));

export const complaints = pgTable('complaints', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: complaintStatusEnum('status').notNull().default('OPEN'),
  resolution: text('resolution'),
  handledById: uuid('handled_by_id').references(() => users.id),
  ...ts(),
}, (t) => ({
  statusIdx: index('complaints_status_idx').on(t.status),
}));

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------- vendor applications
   Phase 2 addition — the pre-approval application record. A vendor "applies"
   here first; only once admin approves does a row in `vendors` go ACTIVE. */

export const vendorApplications = pgTable('vendor_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicantUserId: uuid('applicant_user_id').notNull().references(() => users.id),
  ownerName: text('owner_name').notNull(),
  shopName: text('shop_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  addressLine: text('address_line').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  categorySlug: text('category_slug'),
  description: text('description'),
  opensAt: text('opens_at'),
  closesAt: text('closes_at'),
  logoUrl: text('logo_url'),
  verificationDocUrl: text('verification_doc_url'),
  payoutAccountName: text('payout_account_name'),
  payoutAccountNumber: text('payout_account_number'),
  payoutIfsc: text('payout_ifsc'),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  status: vendorApplicationStatusEnum('status').notNull().default('PENDING'),
  reviewedById: uuid('reviewed_by_id').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  resultingVendorId: uuid('resulting_vendor_id').references(() => vendors.id),
  ...ts(),
}, (t) => ({
  statusIdx: index('vendor_apps_status_idx').on(t.status),
}));

/* ---------------------------------------------------------- subscriptions
   Phase 2 addition. Kept deliberately separate from `orders.commissionPaise`
   (order commission) and `deliveryZones.deliveryFeePaise` (delivery charge)
   so the three can vary independently per the business-design requirement. */

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  billingPeriod: billingPeriodEnum('billing_period').notNull(),
  pricePaise: integer('price_paise').notNull().default(0),
  trialDays: integer('trial_days').notNull().default(0),
  commissionPct: doublePrecision('commission_pct'),
  features: jsonb('features'),
  isActive: boolean('is_active').notNull().default(true),
  ...ts(),
});

export const vendorSubscriptions = pgTable('vendor_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().unique().references(() => vendors.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => subscriptionPlans.id),
  state: subscriptionStateEnum('state').notNull().default('TRIAL'),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  currentPeriodEndsAt: timestamp('current_period_ends_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  extendedById: uuid('extended_by_id').references(() => users.id),
  extendedNote: text('extended_note'),
  ...ts(),
}, (t) => ({
  stateIdx: index('vendor_subs_state_idx').on(t.state),
}));

export const subscriptionPayments = pgTable('subscription_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorSubscriptionId: uuid('vendor_subscription_id').notNull().references(() => vendorSubscriptions.id, { onDelete: 'cascade' }),
  amountPaise: integer('amount_paise').notNull(),
  provider: text('provider').notNull(),
  providerRef: text('provider_ref'),
  status: paymentStatusEnum('status').notNull().default('PENDING'),
  periodStart: timestamp('period_start', { withTimezone: true }),
  periodEnd: timestamp('period_end', { withTimezone: true }),
  ...ts(),
});

/* --------------------------------------------------- delivery pricing tiers
   Phase 2 addition. Replaces (additively — the flat deliveryZones.deliveryFeePaise
   stays as a fallback) a single flat fee with distance-banded pricing per zone,
   e.g. 0-2km = Rs20, 2-4km = Rs30. */

export const deliveryPricingTiers = pgTable('delivery_pricing_tiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  zoneId: uuid('zone_id').notNull().references(() => deliveryZones.id, { onDelete: 'cascade' }),
  fromKm: doublePrecision('from_km').notNull(),
  toKm: doublePrecision('to_km').notNull(),
  feePaise: integer('fee_paise').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => ({
  zoneIdx: index('pricing_tiers_zone_idx').on(t.zoneId, t.sortOrder),
}));

/* -------------------------------------------------------------- audit log
   Phase 2 addition. Generic actor/action/entity log for admin-sensitive
   operations (approvals, suspensions, subscription extensions, etc). */

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index('audit_entity_idx').on(t.entityType, t.entityId),
}));

/* -------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ one, many }) => ({
  customerProfile: one(customerProfiles, { fields: [users.id], references: [customerProfiles.userId] }),
  vendor: one(vendors, { fields: [users.id], references: [vendors.ownerUserId] }),
  deliveryPartner: one(deliveryPartners, { fields: [users.id], references: [deliveryPartners.userId] }),
  addresses: many(addresses),
  orders: many(orders),
  favorites: many(favorites),
  notifications: many(notifications),
  vendorApplications: many(vendorApplications),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  owner: one(users, { fields: [vendors.ownerUserId], references: [users.id] }),
  zone: one(deliveryZones, { fields: [vendors.zoneId], references: [deliveryZones.id] }),
  categories: many(vendorCategories),
  hours: many(vendorHours),
  sections: many(menuSections),
  foodItems: many(foodItems),
  orders: many(orders),
  reviews: many(reviews),
  subscription: one(vendorSubscriptions, { fields: [vendors.id], references: [vendorSubscriptions.vendorId] }),
}));

export const vendorCategoriesRelations = relations(vendorCategories, ({ one }) => ({
  vendor: one(vendors, { fields: [vendorCategories.vendorId], references: [vendors.id] }),
  category: one(categories, { fields: [vendorCategories.categoryId], references: [categories.id] }),
}));

export const vendorHoursRelations = relations(vendorHours, ({ one }) => ({
  vendor: one(vendors, { fields: [vendorHours.vendorId], references: [vendors.id] }),
}));

export const menuSectionsRelations = relations(menuSections, ({ one, many }) => ({
  vendor: one(vendors, { fields: [menuSections.vendorId], references: [vendors.id] }),
  foodItems: many(foodItems),
}));

export const foodItemsRelations = relations(foodItems, ({ one, many }) => ({
  vendor: one(vendors, { fields: [foodItems.vendorId], references: [vendors.id] }),
  section: one(menuSections, { fields: [foodItems.sectionId], references: [menuSections.id] }),
  category: one(categories, { fields: [foodItems.categoryId], references: [categories.id] }),
  customizationGroups: many(customizationGroups),
}));

export const customizationGroupsRelations = relations(customizationGroups, ({ one, many }) => ({
  foodItem: one(foodItems, { fields: [customizationGroups.foodItemId], references: [foodItems.id] }),
  options: many(customizationOptions),
}));

export const customizationOptionsRelations = relations(customizationOptions, ({ one }) => ({
  group: one(customizationGroups, { fields: [customizationOptions.groupId], references: [customizationGroups.id] }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  vendor: one(vendors, { fields: [carts.vendorId], references: [vendors.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one, many }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  foodItem: one(foodItems, { fields: [cartItems.foodItemId], references: [foodItems.id] }),
  options: many(cartItemOptions),
}));

export const cartItemOptionsRelations = relations(cartItemOptions, ({ one }) => ({
  cartItem: one(cartItems, { fields: [cartItemOptions.cartItemId], references: [cartItems.id] }),
  option: one(customizationOptions, { fields: [cartItemOptions.optionId], references: [customizationOptions.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, { fields: [orders.customerId], references: [users.id] }),
  vendor: one(vendors, { fields: [orders.vendorId], references: [vendors.id] }),
  zone: one(deliveryZones, { fields: [orders.zoneId], references: [deliveryZones.id] }),
  items: many(orderItems),
  events: many(orderStatusEvents),
  payment: one(payments, { fields: [orders.id], references: [payments.orderId] }),
  assignments: many(deliveryAssignments),
  review: one(reviews, { fields: [orders.id], references: [reviews.orderId] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  options: many(orderItemOptions),
}));

export const orderItemOptionsRelations = relations(orderItemOptions, ({ one }) => ({
  orderItem: one(orderItems, { fields: [orderItemOptions.orderItemId], references: [orderItems.id] }),
}));

export const orderStatusEventsRelations = relations(orderStatusEvents, ({ one }) => ({
  order: one(orders, { fields: [orderStatusEvents.orderId], references: [orders.id] }),
}));

export const deliveryAssignmentsRelations = relations(deliveryAssignments, ({ one }) => ({
  order: one(orders, { fields: [deliveryAssignments.orderId], references: [orders.id] }),
  partner: one(deliveryPartners, { fields: [deliveryAssignments.partnerId], references: [deliveryPartners.id] }),
}));

export const deliveryPartnersRelations = relations(deliveryPartners, ({ one, many }) => ({
  user: one(users, { fields: [deliveryPartners.userId], references: [users.id] }),
  assignments: many(deliveryAssignments),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  order: one(orders, { fields: [reviews.orderId], references: [orders.id] }),
  customer: one(users, { fields: [reviews.customerId], references: [users.id] }),
  vendor: one(vendors, { fields: [reviews.vendorId], references: [vendors.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  vendor: one(vendors, { fields: [favorites.vendorId], references: [vendors.id] }),
  foodItem: one(foodItems, { fields: [favorites.foodItemId], references: [foodItems.id] }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
  zone: one(deliveryZones, { fields: [addresses.zoneId], references: [deliveryZones.id] }),
}));

export const deliveryZonesRelations = relations(deliveryZones, ({ many }) => ({
  vendors: many(vendors),
  addresses: many(addresses),
  orders: many(orders),
  pricingTiers: many(deliveryPricingTiers),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  foodItems: many(foodItems),
  vendors: many(vendorCategories),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const complaintsRelations = relations(complaints, ({ one }) => ({
  user: one(users, { fields: [complaints.userId], references: [users.id] }),
  order: one(orders, { fields: [complaints.orderId], references: [orders.id] }),
}));

export const vendorApplicationsRelations = relations(vendorApplications, ({ one }) => ({
  applicant: one(users, { fields: [vendorApplications.applicantUserId], references: [users.id] }),
  reviewedBy: one(users, { fields: [vendorApplications.reviewedById], references: [users.id] }),
  resultingVendor: one(vendors, { fields: [vendorApplications.resultingVendorId], references: [vendors.id] }),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  vendorSubscriptions: many(vendorSubscriptions),
}));

export const vendorSubscriptionsRelations = relations(vendorSubscriptions, ({ one, many }) => ({
  vendor: one(vendors, { fields: [vendorSubscriptions.vendorId], references: [vendors.id] }),
  plan: one(subscriptionPlans, { fields: [vendorSubscriptions.planId], references: [subscriptionPlans.id] }),
  payments: many(subscriptionPayments),
}));

export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({ one }) => ({
  vendorSubscription: one(vendorSubscriptions, { fields: [subscriptionPayments.vendorSubscriptionId], references: [vendorSubscriptions.id] }),
}));

export const deliveryPricingTiersRelations = relations(deliveryPricingTiers, ({ one }) => ({
  zone: one(deliveryZones, { fields: [deliveryPricingTiers.zoneId], references: [deliveryZones.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));