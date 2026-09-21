export type AdminUser = { id: string; role: string; fullName: string; email: string | null };

export type Zone = {
  id: string; name: string; description: string | null;
  city: string; district: string; state: string;
  latitude: number; longitude: number; radiusMeters: number;
  deliveryFeePaise: number; minOrderPaise: number; etaMinutes: number;
  priority: number; isActive: boolean;
};

export type Vendor = {
  id: string; name: string; slug: string; ownerName: string; phone: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  isOpenManual: boolean; isDemo: boolean; ratingAvg: number; ratingCount: number;
  commissionPct: number | null;
  zone: { id: string; name: string } | null;
  owner: { email: string | null; phone: string | null };
};

export type Partner = {
  id: string; vehicle: string; status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  isOnline: boolean;
  user: { id: string; fullName: string; phone: string | null; email: string | null };
};

export type OrderRow = {
  id: string; code: string; status: string; totalPaise: number; paymentMethod: string;
  paymentStatus: string; placedAt: string;
  vendor: { id: string; name: string };
  customer: { id: string; fullName: string; phone: string | null };
  zone: { id: string; name: string };
  items: Array<{ nameSnapshot: string; quantity: number }>;
};

export type AnalyticsResponse = {
  cards: {
    totalCustomers: number; totalVendors: number; activeVendors: number;
    activeDeliveryPartners: number; onlineDeliveryPartners: number; totalFoodItems: number;
    totalOrders: number; todayOrders: number; pendingOrders: number; deliveredOrders: number;
    revenuePaise: number; commissionPaise: number;
  };
  charts: {
    daily: Array<{ day: string; orders: number; revenuePaise: number }>;
    topVendors: Array<{ vendorId: string; name: string; orders: number; revenuePaise: number }>;
  };
};

export type Settings = {
  brandName: string; brandTagline: string; brandPrimaryColor: string;
  platformFeePaise: number; commissionPct: number; taxPct: number;
  riderPayoutPaise: number; cancelWindowSeconds: number;
  defaultLocale: string; supportedLocales: string[]; supportPhone: string;
};

export type Complaint = {
  id: string; subject: string; message: string; status: string; resolution: string | null;
  createdAt: string; user: { fullName: string; phone: string | null };
};

export type ReviewRow = {
  id: string; rating: number; comment: string | null; isHidden: boolean; createdAt: string;
  vendor: { id: string; name: string }; customer: { fullName: string };
};

export type Category = { id: string; slug: string; name: string; icon: string | null; isActive: boolean; sortOrder: number };

export type Customer = {
  id: string; fullName: string; email: string | null; phone: string | null;
  status: string; createdAt: string; orderCount: number;
};

export type PendingPayment = {
  p: { id: string; provider: string; amountPaise: number; upiRef: string | null };
  o: { id: string; code: string };
};
