export const Colors = {
  primary: '#0274BC',
  primaryDeep: '#025a9b',
  primaryLight: '#22B3F9',
  secondary: '#1AC9FF',
  secondaryElectric: '#59D2FF',
  secondarySubtle: '#B0DFF0',
  business: '#10B981',
  businessAccent: '#34D399',
  businessDark: '#064E3B',
  white: '#FFFFFF',
  black: '#000000',
  dark: {
    background: '#050505',
    card: '#121212',
    surface: '#1A1A1A',
    border: 'rgba(255,255,255,0.08)',
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textTertiary: '#6B7280',
  },
  light: {
    background: '#FAFAFA',
    card: '#FFFFFF',
    surface: '#F5F5F5',
    border: '#E5E7EB',
    text: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
  },
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  personal: {
    bg: 'rgba(2, 116, 188, 0.1)',
    text: '#22B3F9',
    border: 'rgba(2, 116, 188, 0.3)',
  },
  businessBadge: {
    bg: 'rgba(16, 185, 129, 0.1)',
    text: '#34D399',
    border: 'rgba(16, 185, 129, 0.3)',
  },
};

export const DEFAULT_CATEGORIES = [
  "Food & Dining", "Transportation", "Entertainment", "Shopping",
  "Health & Medical", "Utilities & Bills", "Education", "Travel",
  "Home & Rent", "Office Supplies", "Subscriptions & Memberships",
  "Gifts & Donations", "Insurance", "Miscellaneous"
];

export const CATEGORY_ICONS: Record<string, string> = {
  "Food & Dining": "restaurant",
  "Transportation": "car",
  "Entertainment": "film",
  "Shopping": "cart",
  "Health & Medical": "medkit",
  "Utilities & Bills": "flash",
  "Education": "school",
  "Travel": "airplane",
  "Home & Rent": "home",
  "Office Supplies": "briefcase",
  "Subscriptions & Memberships": "card",
  "Gifts & Donations": "gift",
  "Insurance": "shield-checkmark",
  "Miscellaneous": "ellipsis-horizontal",
};
