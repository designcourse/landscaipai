export const PLANS = {
  starter: {
    name: "Starter",
    creditsPerMonth: 25,
  },
  pro: {
    name: "Pro",
    creditsPerMonth: 100,
  },
  business: {
    name: "Business",
    creditsPerMonth: 500,
  },
} as const;

export type PlanId = keyof typeof PLANS;
