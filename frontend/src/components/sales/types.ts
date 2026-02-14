// Types and interfaces for Sales module

export interface PlayTypeConfig {
  name: string;
  numbers_count: number;
  multipliers: {
    first: number;
    second: number;
    third: number;
  };
  enabled: boolean;
}

export interface Lottery {
  id: string;
  name: string;
  country: string;
  lottery_type: string;
  min_number: number;
  max_number: number;
  numbers_to_pick: number;
  price: number;
  currency: string;
  prize_multiplier: number;
  schedule: string[];
  is_open: boolean;
  next_draw_time: string | null;
  closing_minutes_before: number;
  closed_message?: string;
  play_types?: { [key: string]: PlayTypeConfig };
}

export interface CartItem {
  id: string;
  lotteryId: string;
  lotteryName: string;
  numbers: number[];
  amount: number;
  currency: string;
  potentialWin: number;
  country: string;
  playType: string;
  playTypeName: string;
}

export interface CompanyProfile {
  company_name: string;
  logo_url?: string;
  slogan?: string;
  phone?: string;
  address?: string;
  rnc?: string;
}

export interface MultiPlayTicketResponse {
  id: string;
  ticket_number: string;
  plays: Array<{
    lottery_name: string;
    lottery_type?: string;
    numbers: number[];
    amount: number;
    potential_win: number;
  }>;
  total_amount: number;
  total_potential_win: number;
  currency: string;
  customer_name?: string;
  created_at: string;
  commission_earned?: number;
}

export interface FavoritePlay {
  lottery_type: string;
  lottery_id?: string;
  numbers: number[];
  amount: number;
}

export interface Favorite {
  id: string;
  name: string;
  plays: FavoritePlay[];
  currency: string;
  use_count: number;
  created_at: string;
  last_used?: string;
}

export interface RecentPlay {
  id?: string;
  lottery_type: string;
  lottery_id?: string;
  lottery_name?: string;
  numbers: number[];
  amount: number;
  created_at?: string;
}

// Play type abbreviations for display
export const PLAY_TYPE_ABBREVIATIONS: { [key: string]: string } = {
  quiniela: 'Q',
  pale: 'P',
  tripleta: 'T',
  super_pale: 'SP',
};

// Get play type display name
export const getPlayTypeDisplayName = (playType: string): string => {
  const names: { [key: string]: string } = {
    quiniela: 'Quiniela',
    pale: 'Pale',
    tripleta: 'Tripleta',
    super_pale: 'Super Pale',
  };
  return names[playType] || playType;
};
