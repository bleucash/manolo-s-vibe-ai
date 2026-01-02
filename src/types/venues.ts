export interface Venue {
  id: string;
  name: string;
  location: string;
  description?: string | null;
  image_url?: string | null;
  capacity?: number | null;
  category?: string | null;
  created_at?: string;
  updated_at?: string;
  manager_id?: string | null;
}
