export type OrderStatus =
  | 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'ASSIGNED'
  | 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';

export type Actor = 'CUSTOMER' | 'VENDOR' | 'DELIVERY' | 'ADMIN' | 'SYSTEM';

/** The only legal moves. Anything else is rejected with INVALID_TRANSITION. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED:     ['ACCEPTED', 'CANCELLED'],
  ACCEPTED:   ['PREPARING', 'CANCELLED'],
  PREPARING:  ['READY', 'CANCELLED'],
  READY:      ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:   ['PICKED_UP', 'CANCELLED'],
  PICKED_UP:  ['ON_THE_WAY', 'CANCELLED'],
  ON_THE_WAY: ['DELIVERED'],
  DELIVERED:  [],
  CANCELLED:  [],
};

/** Who is allowed to move an order into a given status. */
const ALLOWED_ACTORS: Record<OrderStatus, Actor[]> = {
  PLACED:     ['CUSTOMER', 'SYSTEM'],
  ACCEPTED:   ['VENDOR', 'ADMIN'],
  PREPARING:  ['VENDOR', 'ADMIN'],
  READY:      ['VENDOR', 'ADMIN'],
  ASSIGNED:   ['DELIVERY', 'ADMIN', 'SYSTEM'],
  PICKED_UP:  ['DELIVERY', 'ADMIN'],
  ON_THE_WAY: ['DELIVERY', 'ADMIN'],
  DELIVERED:  ['DELIVERY', 'ADMIN'],
  CANCELLED:  ['CUSTOMER', 'VENDOR', 'ADMIN'],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  TRANSITIONS[from].includes(to);

export const actorCanSet = (actor: Actor, to: OrderStatus): boolean =>
  ALLOWED_ACTORS[to].includes(actor);

export const isTerminal = (s: OrderStatus): boolean => TRANSITIONS[s].length === 0;

export const CUSTOMER_TIMELINE: OrderStatus[] = [
  'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: 'Order placed',
  ACCEPTED: 'Vendor accepted',
  PREPARING: 'Preparing your food',
  READY: 'Food is ready',
  ASSIGNED: 'Delivery partner assigned',
  PICKED_UP: 'Picked up',
  ON_THE_WAY: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};
