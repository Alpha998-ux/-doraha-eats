/**
 * Doraha Eats — demo seed.
 *
 * EVERY vendor, customer and delivery partner created here is FICTIONAL sample
 * data for local development. None of these are real Doraha businesses and no
 * claim is made that they exist. Vendor rows carry isDemo = true and names are
 * prefixed "[DEMO]" so they can never be mistaken for real listings.
 *
 * Run:  npm run seed
 */
import { sql } from 'drizzle-orm';
import { db, pool } from './index.js';
import {
  users, customerProfiles, carts, deliveryPartners, deliveryZones, categories,
  vendors, vendorCategories, vendorHours, menuSections, foodItems,
  customizationGroups, customizationOptions, orders, orderItems,
  orderStatusEvents, payments, deliveryAssignments, reviews, settings,
} from './schema.js';
import { hashPassword } from '../lib/password.js';
import { env } from '../config/env.js';
import { DEFAULT_SETTINGS } from '../services/settings.service.js';
import { generateOrderCode } from '../lib/orderCode.js';

const DEMO_PASSWORD = env.DEMO_PASSWORD;

// Doraha town centre. Used as the anchor for demo coordinates.
const DORAHA = { lat: 30.7996, lng: 76.0236 };

/** Nudges a coordinate a few hundred metres for realistic scatter. */
const near = (dLat: number, dLng: number) => ({
  latitude: DORAHA.lat + dLat,
  longitude: DORAHA.lng + dLng,
});

const rupees = (r: number) => r * 100;

const FULL_WEEK = (opensAt: string, closesAt: string) =>
  Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, opensAt, closesAt }));

async function reset() {
  // Truncate in one statement so FK order doesn't matter.
  await db.execute(sql`
    TRUNCATE TABLE
      order_item_options, order_items, order_status_events, payments,
      delivery_assignments, reviews, orders,
      cart_item_options, cart_items, carts,
      customization_options, customization_groups, food_items, menu_sections,
      vendor_hours, vendor_categories, vendors,
      favorites, notifications, complaints, device_tokens, otp_codes,
      addresses, customer_profiles, delivery_partners, users,
      categories, delivery_zones, settings
    RESTART IDENTITY CASCADE
  `);
}

async function main() {
  console.log('Seeding Doraha Eats demo data...\n');
  await reset();

  /* ----------------------------------------------------------- settings */
  await db.insert(settings).values({ key: 'platform', value: DEFAULT_SETTINGS });

  /* -------------------------------------------------------------- zones */
  const zoneRows = await db.insert(deliveryZones).values([
    {
      name: 'Doraha Main Bazaar',
      description: 'Core market area and surrounding streets',
      ...near(0, 0), radiusMeters: 2500,
      deliveryFeePaise: rupees(20), minOrderPaise: rupees(99), etaMinutes: 30,
      priority: 10, isActive: true,
    },
    {
      name: 'Doraha Outer / GT Road side',
      description: 'GT Road stretch and nearby colonies',
      ...near(0.012, 0.014), radiusMeters: 3000,
      deliveryFeePaise: rupees(30), minOrderPaise: rupees(149), etaMinutes: 40,
      priority: 5, isActive: true,
    },
    {
      // Deliberately INACTIVE: proves expansion is opt-in and must be switched
      // on by an admin. Addresses here return the unavailable message.
      name: 'Payal (future expansion)',
      description: 'Nearby town — not yet serviceable. Activate from the admin panel.',
      ...near(0.08, 0.09), radiusMeters: 4000,
      deliveryFeePaise: rupees(35), minOrderPaise: rupees(199), etaMinutes: 50,
      priority: 1, isActive: false,
    },
  ]).returning();

  const mainZone = zoneRows[0];
  const outerZone = zoneRows[1];
  console.log(`  zones            ${zoneRows.length} (${zoneRows.filter((z) => z.isActive).length} active)`);

  /* --------------------------------------------------------- categories */
  const catRows = await db.insert(categories).values([
    { slug: 'burger',   name: 'Burgers',  nameHi: 'बर्गर',    namePa: 'ਬਰਗਰ',     icon: '🍔', sortOrder: 1 },
    { slug: 'pizza',    name: 'Pizza',    nameHi: 'पिज़्ज़ा',   namePa: 'ਪੀਜ਼ਾ',     icon: '🍕', sortOrder: 2 },
    { slug: 'momos',    name: 'Momos',    nameHi: 'मोमोज',    namePa: 'ਮੋਮੋਜ਼',     icon: '🥟', sortOrder: 3 },
    { slug: 'rolls',    name: 'Rolls',    nameHi: 'रोल',      namePa: 'ਰੋਲ',       icon: '🌯', sortOrder: 4 },
    { slug: 'chinese',  name: 'Chinese',  nameHi: 'चायनीज़',   namePa: 'ਚਾਈਨੀਜ਼',   icon: '🍜', sortOrder: 5 },
    { slug: 'snacks',   name: 'Snacks',   nameHi: 'स्नैक्स',    namePa: 'ਸਨੈਕਸ',     icon: '🍟', sortOrder: 6 },
    { slug: 'drinks',   name: 'Drinks',   nameHi: 'ड्रिंक्स',   namePa: 'ਡਰਿੰਕਸ',    icon: '🥤', sortOrder: 7 },
    { slug: 'chicken',  name: 'Chicken',  nameHi: 'चिकन',     namePa: 'ਚਿਕਨ',      icon: '🍗', sortOrder: 8 },
    { slug: 'tea',      name: 'Tea',      nameHi: 'चाय',      namePa: 'ਚਾਹ',       icon: '☕', sortOrder: 9 },
    { slug: 'desserts', name: 'Desserts', nameHi: 'मिठाई',    namePa: 'ਮਿਠਾਈ',     icon: '🍰', sortOrder: 10 },
  ]).returning();
  const cat = Object.fromEntries(catRows.map((c) => [c.slug, c.id]));
  console.log(`  categories       ${catRows.length}`);

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  /* --------------------------------------------------------- admin user */
  await db.insert(users).values({
    role: 'ADMIN', email: 'admin@dorahaeats.local', phone: '+919000000001',
    fullName: 'Demo Admin', passwordHash, status: 'ACTIVE',
  });

  /* ---------------------------------------------------------- customers */
  const customerSpecs = [
    { email: 'customer@dorahaeats.local', phone: '+919000000010', fullName: 'Demo Customer', locale: 'en' },
    { email: 'customer2@dorahaeats.local', phone: '+919000000011', fullName: 'Demo Customer Two', locale: 'pa' },
    { email: 'customer3@dorahaeats.local', phone: '+919000000012', fullName: 'Demo Customer Three', locale: 'hi' },
    { email: 'customer4@dorahaeats.local', phone: '+919000000013', fullName: 'Demo Customer Four', locale: 'en' },
    { email: 'customer5@dorahaeats.local', phone: '+919000000014', fullName: 'Demo Customer Five', locale: 'pa' },
  ];
  const customerRows = await db.insert(users)
    .values(customerSpecs.map((c) => ({ ...c, role: 'CUSTOMER' as const, passwordHash, status: 'ACTIVE' as const })))
    .returning();
  await db.insert(customerProfiles).values(customerRows.map((u) => ({ userId: u.id, defaultZoneId: mainZone.id })));
  await db.insert(carts).values(customerRows.map((u) => ({ userId: u.id })));

  const { addresses } = await import('./schema.js');
  await db.insert(addresses).values([
    {
      userId: customerRows[0].id, label: 'HOME', area: 'Main Bazaar, Doraha',
      line1: 'House 12, Street 3, near the clock tower', landmark: 'Opposite bus stand',
      pincode: '141421', ...near(0.001, 0.0008), zoneId: mainZone.id, isDefault: true,
    },
    {
      userId: customerRows[0].id, label: 'WORK', area: 'GT Road, Doraha',
      line1: 'Shop 4, GT Road market', pincode: '141421',
      ...near(0.010, 0.012), zoneId: outerZone.id, isDefault: false,
    },
    ...customerRows.slice(1).map((u, i) => ({
      userId: u.id, label: 'HOME', area: 'Main Bazaar, Doraha',
      line1: `House ${20 + i}, Doraha`, pincode: '141421',
      ...near(0.002 + i * 0.001, 0.001), zoneId: mainZone.id, isDefault: true,
    })),
  ]);
  console.log(`  customers        ${customerRows.length}`);

  /* -------------------------------------------------- delivery partners */
  const partnerSpecs = [
    { email: 'delivery@dorahaeats.local', phone: '+919000000020', fullName: 'Demo Delivery Partner', vehicle: 'BIKE' },
    { email: 'delivery2@dorahaeats.local', phone: '+919000000021', fullName: 'Demo Partner Two', vehicle: 'SCOOTER' },
    { email: 'delivery3@dorahaeats.local', phone: '+919000000022', fullName: 'Demo Partner Three', vehicle: 'BIKE' },
    { email: 'delivery4@dorahaeats.local', phone: '+919000000023', fullName: 'Demo Partner Four', vehicle: 'CYCLE' },
    { email: 'delivery5@dorahaeats.local', phone: '+919000000024', fullName: 'Demo Partner Five', vehicle: 'BIKE' },
  ];
  const partnerUsers = await db.insert(users)
    .values(partnerSpecs.map((p) => ({
      role: 'DELIVERY' as const, email: p.email, phone: p.phone,
      fullName: p.fullName, passwordHash, status: 'ACTIVE' as const,
    }))).returning();

  const partnerRows = await db.insert(deliveryPartners).values(partnerUsers.map((u, i) => ({
    userId: u.id,
    vehicle: partnerSpecs[i].vehicle,
    status: 'ACTIVE' as const,      // pre-approved so the demo flow runs immediately
    isOnline: i < 3,
    ...near(0.001 * i, 0.001 * i),
    lastSeenAt: new Date(),
    isDemo: true,
  }))).returning();
  console.log(`  delivery partners ${partnerRows.length}`);

  /* ------------------------------------------------------------ vendors */
  type MenuSpec = {
    section: string;
    items: Array<{
      name: string; desc: string; price: number; veg: boolean; cat: string;
      customizations?: Array<{
        name: string; min: number; max: number;
        options: Array<{ name: string; delta: number; def?: boolean }>;
      }>;
    }>;
  };

  const sizeGroup = (regularLabel = 'Regular', largeLabel = 'Large', largeDelta = 3000) => ({
    name: 'Size', min: 1, max: 1,
    options: [
      { name: regularLabel, delta: 0, def: true },
      { name: largeLabel, delta: largeDelta },
    ],
  });

  const spiceGroup = {
    name: 'Spice level', min: 1, max: 1,
    options: [
      { name: 'Normal', delta: 0, def: true },
      { name: 'Spicy', delta: 0 },
      { name: 'Extra spicy', delta: 0 },
    ],
  };

  const addOnGroup = (options: Array<{ name: string; delta: number }>) => ({
    name: 'Add-ons', min: 0, max: 4, options,
  });

  const vendorSpecs: Array<{
    name: string; slug: string; owner: string; email: string; phone: string;
    about: string; address: string; cats: string[]; prep: number;
    latitude: number; longitude: number; zoneId: string; rating: number; ratingCount: number;
    hours: Array<{ dayOfWeek: number; opensAt: string; closesAt: string }>;
    menu: MenuSpec[];
  }> = [
    {
      name: '[DEMO] Sharma Burger Corner', slug: 'demo-sharma-burger-corner',
      owner: 'Demo Owner Sharma', email: 'vendor@dorahaeats.local', phone: '+919000000030',
      about: 'Sample demo stall for testing. Burgers and quick bites.',
      address: 'Stall 1, Main Bazaar, Doraha', cats: ['burger', 'snacks', 'drinks'],
      prep: 15, ...near(0.0006, 0.0004), zoneId: mainZone.id, rating: 4.4, ratingCount: 38,
      hours: FULL_WEEK('10:00', '23:00'),
      menu: [
        {
          section: 'Burgers',
          items: [
            { name: 'Classic Veg Burger', desc: 'Crispy veg patty, lettuce, house sauce', price: rupees(49), veg: true, cat: 'burger',
              customizations: [sizeGroup('Regular', 'Large', rupees(25)), addOnGroup([
                { name: 'Extra cheese', delta: rupees(20) },
                { name: 'Extra mayo', delta: rupees(10) },
                { name: 'Extra patty', delta: rupees(35) },
              ])] },
            { name: 'Cheese Burger', desc: 'Veg patty with a thick cheese slice', price: rupees(69), veg: true, cat: 'burger',
              customizations: [sizeGroup('Regular', 'Large', rupees(25))] },
            { name: 'Double Cheese Burger', desc: 'Two patties, double cheese', price: rupees(109), veg: true, cat: 'burger' },
            { name: 'Chicken Burger', desc: 'Grilled chicken patty with mayo', price: rupees(99), veg: false, cat: 'chicken',
              customizations: [spiceGroup] },
          ],
        },
        {
          section: 'Sides & Drinks',
          items: [
            { name: 'French Fries', desc: 'Salted, served hot', price: rupees(59), veg: true, cat: 'snacks',
              customizations: [sizeGroup('Regular', 'Large', rupees(30)), addOnGroup([
                { name: 'Peri peri masala', delta: rupees(10) },
                { name: 'Cheese dip', delta: rupees(25) },
              ])] },
            { name: 'Cold Drink 300ml', desc: 'Chilled soft drink', price: rupees(25), veg: true, cat: 'drinks' },
            { name: 'Cold Coffee', desc: 'Thick blended cold coffee', price: rupees(69), veg: true, cat: 'drinks' },
          ],
        },
      ],
    },
    {
      name: '[DEMO] Doraha Momos Point', slug: 'demo-doraha-momos-point',
      owner: 'Demo Owner Singh', email: 'vendor2@dorahaeats.local', phone: '+919000000031',
      about: 'Sample demo stall. Steamed and fried momos.',
      address: 'Near bus stand, Doraha', cats: ['momos', 'chinese', 'snacks'],
      prep: 18, ...near(-0.0008, 0.0011), zoneId: mainZone.id, rating: 4.6, ratingCount: 52,
      hours: FULL_WEEK('11:00', '22:30'),
      menu: [
        {
          section: 'Momos',
          items: [
            { name: 'Veg Steam Momos (6 pc)', desc: 'Classic steamed momos with red chutney', price: rupees(49), veg: true, cat: 'momos',
              customizations: [spiceGroup, addOnGroup([{ name: 'Extra chutney', delta: rupees(10) }, { name: 'Mayo dip', delta: rupees(15) }])] },
            { name: 'Veg Fried Momos (6 pc)', desc: 'Deep fried till golden', price: rupees(69), veg: true, cat: 'momos' },
            { name: 'Paneer Momos (6 pc)', desc: 'Stuffed with spiced paneer', price: rupees(79), veg: true, cat: 'momos' },
            { name: 'Chicken Steam Momos (6 pc)', desc: 'Minced chicken filling', price: rupees(89), veg: false, cat: 'chicken',
              customizations: [spiceGroup] },
            { name: 'Tandoori Momos (6 pc)', desc: 'Momos tossed in tandoori masala', price: rupees(109), veg: true, cat: 'momos' },
          ],
        },
        {
          section: 'Chinese',
          items: [
            { name: 'Veg Chowmein', desc: 'Hakka style noodles with vegetables', price: rupees(79), veg: true, cat: 'chinese',
              customizations: [sizeGroup('Half', 'Full', rupees(40)), spiceGroup] },
            { name: 'Veg Fried Rice', desc: 'Wok tossed rice', price: rupees(89), veg: true, cat: 'chinese' },
            { name: 'Chilli Paneer Dry', desc: 'Paneer in spicy chilli sauce', price: rupees(129), veg: true, cat: 'chinese' },
          ],
        },
      ],
    },
    {
      name: '[DEMO] Punjabi Pizza House', slug: 'demo-punjabi-pizza-house',
      owner: 'Demo Owner Kaur', email: 'vendor3@dorahaeats.local', phone: '+919000000032',
      about: 'Sample demo stall. Hand-tossed pizzas with local toppings.',
      address: 'GT Road, Doraha', cats: ['pizza', 'snacks'],
      prep: 25, ...near(0.009, 0.011), zoneId: outerZone.id, rating: 4.2, ratingCount: 27,
      hours: FULL_WEEK('11:30', '23:00'),
      menu: [
        {
          section: 'Pizzas',
          items: [
            { name: 'Margherita Pizza', desc: 'Cheese and tomato base', price: rupees(149), veg: true, cat: 'pizza',
              customizations: [sizeGroup('Regular 7"', 'Large 10"', rupees(120)), addOnGroup([
                { name: 'Extra cheese', delta: rupees(40) },
                { name: 'Olives', delta: rupees(30) },
                { name: 'Jalapenos', delta: rupees(30) },
              ])] },
            { name: 'Farmhouse Pizza', desc: 'Onion, capsicum, tomato, corn', price: rupees(219), veg: true, cat: 'pizza',
              customizations: [sizeGroup('Regular 7"', 'Large 10"', rupees(150))] },
            { name: 'Paneer Tikka Pizza', desc: 'Tandoori paneer with onions', price: rupees(249), veg: true, cat: 'pizza' },
            { name: 'Chicken Tikka Pizza', desc: 'Chicken tikka chunks and onion', price: rupees(279), veg: false, cat: 'chicken' },
            { name: 'Garlic Bread', desc: 'Buttery garlic bread sticks', price: rupees(89), veg: true, cat: 'snacks' },
          ],
        },
      ],
    },
    {
      name: '[DEMO] Gupta Rolls & Wraps', slug: 'demo-gupta-rolls-wraps',
      owner: 'Demo Owner Gupta', email: 'vendor4@dorahaeats.local', phone: '+919000000033',
      about: 'Sample demo stall. Kathi rolls and wraps.',
      address: 'Old market lane, Doraha', cats: ['rolls', 'chicken', 'snacks'],
      prep: 14, ...near(0.0012, -0.0009), zoneId: mainZone.id, rating: 4.3, ratingCount: 31,
      hours: FULL_WEEK('12:00', '23:30'),
      menu: [
        {
          section: 'Rolls',
          items: [
            { name: 'Veg Kathi Roll', desc: 'Paratha wrap with veggies', price: rupees(59), veg: true, cat: 'rolls',
              customizations: [spiceGroup, addOnGroup([{ name: 'Extra mayo', delta: rupees(10) }, { name: 'Cheese', delta: rupees(20) }])] },
            { name: 'Paneer Roll', desc: 'Spiced paneer in a paratha wrap', price: rupees(89), veg: true, cat: 'rolls' },
            { name: 'Egg Roll', desc: 'Double egg wrap', price: rupees(69), veg: false, cat: 'rolls' },
            { name: 'Chicken Tikka Roll', desc: 'Chicken tikka with onions and chutney', price: rupees(119), veg: false, cat: 'chicken',
              customizations: [spiceGroup] },
            { name: 'Double Chicken Roll', desc: 'Extra filling chicken roll', price: rupees(159), veg: false, cat: 'chicken' },
          ],
        },
      ],
    },
    {
      name: '[DEMO] Gill Chinese Corner', slug: 'demo-gill-chinese-corner',
      owner: 'Demo Owner Gill', email: 'vendor5@dorahaeats.local', phone: '+919000000034',
      about: 'Sample demo stall. Indo-Chinese street food.',
      address: 'Market chowk, Doraha', cats: ['chinese', 'snacks'],
      prep: 20, ...near(-0.0014, -0.0006), zoneId: mainZone.id, rating: 4.1, ratingCount: 19,
      hours: FULL_WEEK('12:00', '22:00'),
      menu: [
        {
          section: 'Noodles & Rice',
          items: [
            { name: 'Hakka Noodles', desc: 'Classic street style noodles', price: rupees(89), veg: true, cat: 'chinese',
              customizations: [sizeGroup('Half', 'Full', rupees(45)), spiceGroup] },
            { name: 'Schezwan Noodles', desc: 'Spicy schezwan tossed noodles', price: rupees(99), veg: true, cat: 'chinese' },
            { name: 'Schezwan Fried Rice', desc: 'Fiery fried rice', price: rupees(99), veg: true, cat: 'chinese' },
            { name: 'Chicken Chowmein', desc: 'Noodles with chicken', price: rupees(129), veg: false, cat: 'chicken' },
          ],
        },
        {
          section: 'Starters',
          items: [
            { name: 'Veg Manchurian Dry', desc: 'Fried veg balls in manchurian sauce', price: rupees(109), veg: true, cat: 'chinese' },
            { name: 'Chilli Potato', desc: 'Crispy potato in sweet chilli sauce', price: rupees(89), veg: true, cat: 'snacks' },
            { name: 'Spring Roll (4 pc)', desc: 'Crunchy veg spring rolls', price: rupees(79), veg: true, cat: 'snacks' },
          ],
        },
      ],
    },
    {
      name: '[DEMO] Doraha Chai Adda', slug: 'demo-doraha-chai-adda',
      owner: 'Demo Owner Verma', email: 'vendor6@dorahaeats.local', phone: '+919000000035',
      about: 'Sample demo stall. Tea, snacks and breakfast.',
      address: 'Near railway crossing, Doraha', cats: ['tea', 'snacks', 'drinks'],
      prep: 10, ...near(0.0004, -0.0016), zoneId: mainZone.id, rating: 4.7, ratingCount: 64,
      hours: FULL_WEEK('06:00', '21:00'),
      menu: [
        {
          section: 'Tea & Coffee',
          items: [
            { name: 'Masala Chai', desc: 'Strong cutting chai', price: rupees(15), veg: true, cat: 'tea',
              customizations: [sizeGroup('Cutting', 'Full glass', rupees(10))] },
            { name: 'Ginger Tea', desc: 'Adrak wali chai', price: rupees(20), veg: true, cat: 'tea' },
            { name: 'Filter Coffee', desc: 'Hot milk coffee', price: rupees(30), veg: true, cat: 'tea' },
          ],
        },
        {
          section: 'Snacks',
          items: [
            { name: 'Samosa (2 pc)', desc: 'Crisp potato samosas with chutney', price: rupees(30), veg: true, cat: 'snacks' },
            { name: 'Bread Pakora', desc: 'Stuffed bread pakora', price: rupees(35), veg: true, cat: 'snacks' },
            { name: 'Aloo Paratha', desc: 'Served with curd and butter', price: rupees(60), veg: true, cat: 'snacks',
              customizations: [addOnGroup([{ name: 'Extra butter', delta: rupees(10) }, { name: 'Extra curd', delta: rupees(15) }])] },
            { name: 'Poha', desc: 'Light flattened rice breakfast', price: rupees(40), veg: true, cat: 'snacks' },
          ],
        },
      ],
    },
    {
      name: '[DEMO] Tandoori Chicken Junction', slug: 'demo-tandoori-chicken-junction',
      owner: 'Demo Owner Bains', email: 'vendor7@dorahaeats.local', phone: '+919000000036',
      about: 'Sample demo stall. Tandoori and grilled chicken.',
      address: 'GT Road service lane, Doraha', cats: ['chicken', 'snacks'],
      prep: 28, ...near(0.011, 0.013), zoneId: outerZone.id, rating: 4.5, ratingCount: 44,
      hours: FULL_WEEK('13:00', '23:30'),
      menu: [
        {
          section: 'Tandoor',
          items: [
            { name: 'Tandoori Chicken (Half)', desc: 'Marinated overnight, clay oven grilled', price: rupees(219), veg: false, cat: 'chicken',
              customizations: [spiceGroup] },
            { name: 'Tandoori Chicken (Full)', desc: 'Full bird, serves two', price: rupees(399), veg: false, cat: 'chicken' },
            { name: 'Chicken Tikka (8 pc)', desc: 'Boneless tikka chunks', price: rupees(229), veg: false, cat: 'chicken' },
            { name: 'Paneer Tikka (8 pc)', desc: 'Grilled paneer with capsicum', price: rupees(199), veg: true, cat: 'snacks' },
            { name: 'Chicken Malai Tikka', desc: 'Creamy mild tikka', price: rupees(249), veg: false, cat: 'chicken' },
          ],
        },
      ],
    },
    {
      name: '[DEMO] Sweet Home Desserts', slug: 'demo-sweet-home-desserts',
      owner: 'Demo Owner Jain', email: 'vendor8@dorahaeats.local', phone: '+919000000037',
      about: 'Sample demo stall. Indian sweets and desserts.',
      address: 'Bazaar road, Doraha', cats: ['desserts', 'drinks'],
      prep: 12, ...near(-0.0011, 0.0014), zoneId: mainZone.id, rating: 4.4, ratingCount: 22,
      hours: FULL_WEEK('09:00', '21:30'),
      menu: [
        {
          section: 'Sweets',
          items: [
            { name: 'Gulab Jamun (2 pc)', desc: 'Warm syrup soaked jamuns', price: rupees(40), veg: true, cat: 'desserts' },
            { name: 'Rasgulla (2 pc)', desc: 'Soft spongy rasgulla', price: rupees(40), veg: true, cat: 'desserts' },
            { name: 'Gajar Halwa (250g)', desc: 'Winter special carrot halwa', price: rupees(90), veg: true, cat: 'desserts' },
            { name: 'Jalebi (250g)', desc: 'Crisp hot jalebi', price: rupees(70), veg: true, cat: 'desserts' },
          ],
        },
        {
          section: 'Shakes & Lassi',
          items: [
            { name: 'Sweet Lassi', desc: 'Thick Punjabi lassi', price: rupees(50), veg: true, cat: 'drinks',
              customizations: [sizeGroup('Regular', 'Large', rupees(25))] },
            { name: 'Mango Shake', desc: 'Seasonal mango shake', price: rupees(70), veg: true, cat: 'drinks' },
            { name: 'Chocolate Shake', desc: 'Thick chocolate shake', price: rupees(80), veg: true, cat: 'drinks' },
          ],
        },
      ],
    },
    {
      name: '[DEMO] Quick Bite Snacks', slug: 'demo-quick-bite-snacks',
      owner: 'Demo Owner Arora', email: 'vendor9@dorahaeats.local', phone: '+919000000038',
      about: 'Sample demo stall. Chaat and evening snacks.',
      address: 'School road, Doraha', cats: ['snacks', 'drinks'],
      prep: 12, ...near(0.0017, 0.0013), zoneId: mainZone.id, rating: 4.0, ratingCount: 15,
      hours: FULL_WEEK('15:00', '22:00'),
      menu: [
        {
          section: 'Chaat',
          items: [
            { name: 'Golgappa (6 pc)', desc: 'Spicy pani puri', price: rupees(30), veg: true, cat: 'snacks',
              customizations: [spiceGroup] },
            { name: 'Aloo Tikki Chaat', desc: 'Crisp tikki with curd and chutney', price: rupees(50), veg: true, cat: 'snacks' },
            { name: 'Papdi Chaat', desc: 'Papdi, curd, chutney, sev', price: rupees(60), veg: true, cat: 'snacks' },
            { name: 'Chole Bhature', desc: 'Two bhature with chole', price: rupees(90), veg: true, cat: 'snacks' },
          ],
        },
        {
          section: 'Drinks',
          items: [
            { name: 'Lemon Soda', desc: 'Fresh lime soda', price: rupees(35), veg: true, cat: 'drinks' },
            { name: 'Nimbu Pani', desc: 'Chilled lemon water', price: rupees(25), veg: true, cat: 'drinks' },
          ],
        },
      ],
    },
    {
      name: '[DEMO] Night Owl Kitchen', slug: 'demo-night-owl-kitchen',
      owner: 'Demo Owner Sethi', email: 'vendor10@dorahaeats.local', phone: '+919000000039',
      about: 'Sample demo stall. Late night meals. Closed during the day on purpose so you can test the closed state.',
      address: 'Highway side, Doraha', cats: ['chinese', 'chicken', 'snacks'],
      prep: 22, ...near(0.013, 0.010), zoneId: outerZone.id, rating: 3.9, ratingCount: 11,
      hours: FULL_WEEK('20:00', '03:00'),   // overnight window — exercises the cross-midnight logic
      menu: [
        {
          section: 'Late Night',
          items: [
            { name: 'Midnight Maggi', desc: 'Masala maggi with veggies', price: rupees(60), veg: true, cat: 'snacks',
              customizations: [addOnGroup([{ name: 'Cheese', delta: rupees(20) }, { name: 'Egg', delta: rupees(20) }])] },
            { name: 'Egg Bhurji with Bread', desc: 'Spiced scrambled eggs', price: rupees(80), veg: false, cat: 'snacks' },
            { name: 'Butter Chicken with Rice', desc: 'Creamy butter chicken bowl', price: rupees(199), veg: false, cat: 'chicken' },
            { name: 'Veg Thali', desc: 'Dal, sabzi, roti, rice', price: rupees(149), veg: true, cat: 'snacks' },
          ],
        },
      ],
    },
  ];

  let itemCount = 0;
  const createdVendors: Array<{ id: string; slug: string; ownerUserId: string; items: Array<{ id: string; name: string; price: number }> }> = [];

  for (const spec of vendorSpecs) {
    const [ownerUser] = await db.insert(users).values({
      role: 'VENDOR', email: spec.email, phone: spec.phone,
      fullName: spec.owner, passwordHash, status: 'ACTIVE',
    }).returning();

    const [vendor] = await db.insert(vendors).values({
      ownerUserId: ownerUser.id, zoneId: spec.zoneId,
      name: spec.name, slug: spec.slug, ownerName: spec.owner, phone: spec.phone,
      about: spec.about, addressLine: spec.address,
      latitude: spec.latitude, longitude: spec.longitude,
      prepTimeMinutes: spec.prep,
      status: 'ACTIVE', isOpenManual: true, isDemo: true,
      ratingAvg: spec.rating, ratingCount: spec.ratingCount,
    }).returning();

    await db.insert(vendorCategories).values(spec.cats.map((c) => ({ vendorId: vendor.id, categoryId: cat[c] })));
    await db.insert(vendorHours).values(spec.hours.map((h) => ({ ...h, vendorId: vendor.id })));

    const items: Array<{ id: string; name: string; price: number }> = [];

    for (const [sIdx, sec] of spec.menu.entries()) {
      const [section] = await db.insert(menuSections)
        .values({ vendorId: vendor.id, name: sec.section, sortOrder: sIdx }).returning();

      for (const [iIdx, it] of sec.items.entries()) {
        const [item] = await db.insert(foodItems).values({
          vendorId: vendor.id, sectionId: section.id, categoryId: cat[it.cat],
          name: it.name, description: it.desc, pricePaise: it.price,
          isVeg: it.veg, isAvailable: true, sortOrder: iIdx,
        }).returning();
        itemCount++;
        items.push({ id: item.id, name: item.name, price: item.pricePaise });

        for (const [gIdx, g] of (it.customizations ?? []).entries()) {
          const [group] = await db.insert(customizationGroups).values({
            foodItemId: item.id, name: g.name, minSelect: g.min, maxSelect: g.max, sortOrder: gIdx,
          }).returning();
          await db.insert(customizationOptions).values(g.options.map((o, oIdx) => ({
            groupId: group.id, name: o.name, priceDeltaPaise: o.delta,
            isDefault: o.def ?? false, sortOrder: oIdx,
          })));
        }
      }
    }
    createdVendors.push({ id: vendor.id, slug: vendor.slug, ownerUserId: ownerUser.id, items });
  }
  console.log(`  vendors          ${createdVendors.length}`);
  console.log(`  food items       ${itemCount}`);

  /* ------------------------------------------------------- demo orders */
  // A few historical orders so the admin dashboard and order history are not empty.
  const demoOrderSpecs = [
    { vendorIdx: 0, customerIdx: 0, status: 'DELIVERED' as const, daysAgo: 3, review: { rating: 5, comment: 'Demo review — burger was hot and fresh.' } },
    { vendorIdx: 1, customerIdx: 1, status: 'DELIVERED' as const, daysAgo: 2, review: { rating: 4, comment: 'Demo review — momos were good.' } },
    { vendorIdx: 5, customerIdx: 2, status: 'DELIVERED' as const, daysAgo: 1, review: null },
    { vendorIdx: 3, customerIdx: 3, status: 'PREPARING' as const, daysAgo: 0, review: null },
    { vendorIdx: 4, customerIdx: 4, status: 'PLACED' as const, daysAgo: 0, review: null },
  ];

  let orderCount = 0;
  for (const spec of demoOrderSpecs) {
    const vendor = createdVendors[spec.vendorIdx];
    const customer = customerRows[spec.customerIdx];
    const picked = vendor.items.slice(0, 2);
    const subtotal = picked.reduce((s, i) => s + i.price, 0);
    const deliveryFee = mainZone.deliveryFeePaise;
    const platformFee = DEFAULT_SETTINGS.platformFeePaise;
    const tax = Math.round((subtotal * DEFAULT_SETTINGS.taxPct) / 100);
    const total = subtotal + deliveryFee + platformFee + tax;
    const placedAt = new Date(Date.now() - spec.daysAgo * 86_400_000 - 3_600_000);

    const [order] = await db.insert(orders).values({
      code: generateOrderCode(),
      customerId: customer.id, vendorId: vendor.id, zoneId: mainZone.id,
      status: spec.status,
      addressLine: 'House 12, Street 3, near the clock tower',
      addressArea: 'Main Bazaar, Doraha',
      addressLandmark: 'Opposite bus stand',
      addressLatitude: DORAHA.lat + 0.001, addressLongitude: DORAHA.lng + 0.0008,
      contactPhone: customer.phone!,
      subtotalPaise: subtotal, deliveryFeePaise: deliveryFee, platformFeePaise: platformFee,
      taxPaise: tax, totalPaise: total,
      commissionPaise: Math.round((subtotal * DEFAULT_SETTINGS.commissionPct) / 100),
      paymentMethod: 'COD', paymentStatus: spec.status === 'DELIVERED' ? 'PAID' : 'PENDING',
      etaMinutes: mainZone.etaMinutes,
      placedAt, createdAt: placedAt,
      acceptedAt: spec.status === 'PLACED' ? null : placedAt,
      deliveredAt: spec.status === 'DELIVERED' ? new Date(placedAt.getTime() + 2_400_000) : null,
    }).returning();

    await db.insert(orderItems).values(picked.map((i) => ({
      orderId: order.id, foodItemId: i.id, nameSnapshot: i.name,
      basePricePaise: i.price, unitPricePaise: i.price, quantity: 1,
    })));

    await db.insert(orderStatusEvents).values({
      orderId: order.id, status: 'PLACED', actorId: customer.id, note: 'Demo seeded order', createdAt: placedAt,
    });

    await db.insert(payments).values({
      orderId: order.id, provider: 'cod',
      status: spec.status === 'DELIVERED' ? 'PAID' : 'PENDING', amountPaise: total,
    });

    if (spec.status === 'DELIVERED') {
      await db.insert(deliveryAssignments).values({
        orderId: order.id, partnerId: partnerRows[0].id, state: 'COMPLETED',
        payoutPaise: DEFAULT_SETTINGS.riderPayoutPaise,
        codCollectedPaise: total,
        respondedAt: placedAt, pickedUpAt: placedAt, deliveredAt: new Date(placedAt.getTime() + 2_400_000),
      });
      if (spec.review) {
        await db.insert(reviews).values({
          orderId: order.id, customerId: customer.id, vendorId: vendor.id,
          partnerId: partnerRows[0].id, rating: spec.review.rating,
          deliveryRating: 5, comment: spec.review.comment,
        });
      }
    }
    orderCount++;
  }
  console.log(`  demo orders      ${orderCount}`);

  console.log(`
Demo login credentials (local development only — password from DEMO_PASSWORD)

  Customer  customer@dorahaeats.local   ${DEMO_PASSWORD}
  Vendor    vendor@dorahaeats.local     ${DEMO_PASSWORD}
  Delivery  delivery@dorahaeats.local   ${DEMO_PASSWORD}
  Admin     admin@dorahaeats.local      ${DEMO_PASSWORD}

All vendors above are FICTIONAL demo data, not real Doraha businesses.
`);
}

main()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await pool.end();
    process.exit(1);
  });
