export interface Venue {
  id: string;
  name: string;
  location: string;
  image_url: string | null;
  description: string | null;
  capacity: number | null;
  entry_price: number | null;
  category: string;
  // ✅ ADD THIS LINE
  owner_id: string | null;
  created_at?: string;
}
