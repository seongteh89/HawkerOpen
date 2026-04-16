export type HawkerStatus = 'open' | 'closed_cleaning' | 'closed_rr' | 'closed_other_works';

export interface HawkerCentreRow {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  description: string | null;
  no_market_stalls: number;
  no_food_stalls: number;
  source_status: string | null;
}

export interface ActiveClosureRow {
  hawker_centre_id: string;
  event_type: 'cleaning' | 'rr' | 'other_works';
  title: string;
  start_date: string;
  end_date: string;
  remarks: string | null;
  source_quarter: string | null;
}

export interface HawkerListItem extends HawkerCentreRow {
  distance_km: number | null;
  status: HawkerStatus;
  active_closure: ActiveClosureRow | null;
}

export interface NeaClosureRecord {
  [key: string]: unknown;
}
