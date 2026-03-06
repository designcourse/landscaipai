export type UserType = "landscaper" | "homeowner" | "admin";

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
  style_preset: string | null;
  time_of_day: string | null;
  season: string | null;
  weather: string | null;
  is_inpaint: boolean;
  input_tokens: number | null;
  output_tokens: number | null;
  generation_cost_cents: number | null;
  status: GenerationStatus;
  error_message: string | null;
  created_at: string;
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
