import { z } from "zod";

export const mealTypes = [
  "Colazione",
  "Spuntino",
  "Pranzo",
  "Merenda",
  "Cena",
  "Altro",
] as const;

export const visibilityValues = ["private", "followers", "public"] as const;
export const privacyCategories = [
  "profile",
  "diary",
  "nutrition",
  "weight",
  "progress",
  "goals",
  "recipes",
  "community",
] as const;

export type Visibility = (typeof visibilityValues)[number];
export type PrivacyCategory = (typeof privacyCategories)[number];
export type PrivacySettings = Partial<Record<PrivacyCategory, Visibility>>;

const optionalNonNegativeNumber = z.number().finite().min(0).optional();

export const mealInputSchema = z
  .object({
    title: z.string().trim().min(1, "Inserisci il nome del pasto").max(120),
    mealType: z.enum(mealTypes),
    visibility: z.enum(visibilityValues).default("private"),
    eatenAt: z.string().datetime(),
    quantity: z.number().finite().positive().optional(),
    unit: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(500).optional(),
    calories: optionalNonNegativeNumber,
    proteinGrams: optionalNonNegativeNumber,
    carbohydrateGrams: optionalNonNegativeNumber,
    fatGrams: optionalNonNegativeNumber,
    nutrientSource: z.string().trim().max(160).optional(),
  })
  .superRefine((meal, context) => {
    const hasNutrition = [
      meal.calories,
      meal.proteinGrams,
      meal.carbohydrateGrams,
      meal.fatGrams,
    ].some((value) => value !== undefined);

    if (hasNutrition && !meal.nutrientSource) {
      context.addIssue({
        code: "custom",
        message: "Indica la fonte dei valori nutrizionali inseriti",
        path: ["nutrientSource"],
      });
    }
  });

export type MealInput = z.infer<typeof mealInputSchema>;

export type NutrientValue = number | null | undefined;
export type NutrientTotals = {
  calories: NutrientValue;
  proteinGrams: NutrientValue;
  carbohydrateGrams: NutrientValue;
  fatGrams: NutrientValue;
  missingValues: number;
};

const nutrientKeys = [
  "calories",
  "proteinGrams",
  "carbohydrateGrams",
  "fatGrams",
] as const;
type NutrientKey = (typeof nutrientKeys)[number];

/** Returns null for a total when even one entry lacks that nutrient. */
export function sumNutrients(
  entries: readonly Partial<Record<NutrientKey, NutrientValue>>[],
): NutrientTotals {
  const total: Record<NutrientKey, NutrientValue> = {
    calories: null,
    proteinGrams: null,
    carbohydrateGrams: null,
    fatGrams: null,
  };
  let missingValues = 0;

  for (const key of nutrientKeys) {
    const values = entries.map((entry) => entry[key]);
    const present = values.filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value),
    );
    missingValues += values.length - present.length;
    total[key] = values.length > 0 && present.length === values.length
      ? present.reduce((sum, value) => sum + value, 0)
      : null;
  }

  return { ...total, missingValues };
}

export type AccessContext = {
  ownerId: string;
  viewerId: string | null;
  settings: PrivacySettings;
  isApprovedFollower?: boolean;
  isBlocked?: boolean;
};

/** Fail closed. Unconfigured categories are always private. */
export function canViewCategory(
  context: AccessContext,
  category: PrivacyCategory,
): boolean {
  if (context.viewerId === context.ownerId) return true;
  if (!context.viewerId || context.isBlocked) return false;

  const visibility = context.settings[category] ?? "private";
  if (visibility === "public") return true;
  if (visibility === "followers") return context.isApprovedFollower === true;
  return false;
}

export function canViewMeal(
  context: AccessContext,
  mealVisibility: Visibility = "private",
): boolean {
  if (context.viewerId === context.ownerId) return true;
  if (!canViewCategory(context, "diary")) return false;
  return canViewCategory(
    { ...context, settings: { ...context.settings, diary: mealVisibility } },
    "diary",
  );
}

export function formatNutrient(value: NutrientValue, suffix = ""): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(value)}${suffix}`
    : "—";
}
