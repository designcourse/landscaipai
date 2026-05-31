export type UserType = "landscaper" | "homeowner" | "admin";

export type LibraryItemType = "plant" | "hardscape";

export interface LibraryItem {
  id: string;
  item_type: LibraryItemType;
  common_name: string;
  scientific_name: string | null;
  category: string;
  subcategory: string;
  description: string | null;
  image_path: string | null;
  thumbnail_path: string | null;
  zone_min: string | null;
  zone_max: string | null;
  height_min_ft: number | null;
  height_max_ft: number | null;
  spread_min_ft: number | null;
  spread_max_ft: number | null;
  sun_requirement: string | null;
  water_needs: string | null;
  growth_rate: string | null;
  maintenance_level: string | null;
  foliage_type: string | null;
  bloom_season: string[] | null;
  flower_colors: string[] | null;
  foliage_colors: string[] | null;
  drought_tolerant: boolean;
  deer_resistant: boolean;
  attracts_pollinators: boolean;
  native_regions: string[] | null;
  toxic_to_pets: boolean;
  material_type: string | null;
  color_options: string[] | null;
  design_styles: string[] | null;
  common_uses: string[] | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  user_type: UserType | null;
  credits_balance: number;
  stripe_customer_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  zip_code: string | null;
  hardiness_zone: string | null;
  is_shared: boolean;
  share_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface Image {
  id: string;
  project_id: string;
  user_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  original_filename: string | null;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

export type GenerationStatus = "pending" | "processing" | "completed" | "failed";

export interface Generation {
  id: string;
  image_id: string;
  user_id: string;
  parent_generation_id: string | null;
  storage_path: string;
  prompt: string;
  custom_prompt: string | null;
  selected_library_items: { id: string; name: string; thumbnail_url: string }[] | null;
  style_preset: string | null;
  time_of_day: string | null;
  season: string | null;
  weather: string | null;
  is_inpaint: boolean;
  is_finalized?: boolean;
  input_tokens: number | null;
  output_tokens: number | null;
  generation_cost_cents: number | null;
  status: GenerationStatus;
  error_message: string | null;
  created_at: string;
  image_model: string | null;
}

export type CreditTransactionType =
  | "free_signup"
  | "purchase"
  | "subscription"
  | "generation"
  | "refund"
  | "admin_adjustment";

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: CreditTransactionType;
  description: string | null;
  generation_id: string | null;
  stripe_event_id: string | null;
  created_at: string;
}

export type VideoGenerationStatus = "pending" | "processing" | "completed" | "failed";

export interface VideoGeneration {
  id: string;
  user_id: string;
  project_id: string;
  start_image_id: string | null;
  start_generation_id: string | null;
  end_image_id: string | null;
  end_generation_id: string | null;
  model: string;
  duration_seconds: number;
  resolution: "720p" | "1080p";
  aspect_ratio: string | null;
  camera_preset: string | null;
  transition_preset: string | null;
  motion_prompt: string;
  generate_audio: boolean;
  width: number | null;
  height: number | null;
  storage_path: string | null;
  // Actual media metadata probed from the rendered MP4 at completion.
  // Used by the Remotion finalize composition for frame-accurate timing.
  actual_duration_seconds: number | null;
  actual_fps: number | null;
  actual_width: number | null;
  actual_height: number | null;
  status: VideoGenerationStatus;
  error_message: string | null;
  cost_credits: number;
  created_at: string;
  updated_at: string;
}

// ===== Finalize Video feature =====

export interface CompanySettings {
  user_id: string;
  company_name: string | null;
  company_phone: string | null;
  logo_path: string | null;
  default_note: string | null;
  updated_at: string;
}

export type VideoFinalizationStatus =
  | "pending"
  | "rendering"
  | "downloading"
  | "completed"
  | "failed";

export interface VideoFinalization {
  id: string;
  user_id: string;
  video_generation_id: string;
  status: VideoFinalizationStatus;
  lambda_render_id: string | null;
  lambda_bucket_name: string | null;
  lambda_function_name: string | null;
  lambda_serve_url: string | null;
  output_storage_path: string | null;
  input_props_snapshot: Record<string, unknown>;
  input_props_hash: string;
  cost_credits: number;
  cost_cents: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionPlan = "starter" | "pro" | "business";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "incomplete";

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  credits_per_period: number;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}
