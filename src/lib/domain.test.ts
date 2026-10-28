import { describe, expect, it } from "vitest";
import {
  canViewCategory,
  canViewMeal,
  formatNutrient,
  mealInputSchema,
  sumNutrients,
} from "./domain";

describe("nutrient provenance and summaries", () => {
  it("rejects supplied nutrient values without a source", () => {
    const result = mealInputSchema.safeParse({
      title: "Piatto inserito",
      mealType: "Pranzo",
      eatenAt: "2026-10-28T12:00:00.000Z",
      calories: 250,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toContain("nutrientSource");
  });

  it("accepts values when the contributor supplies a source", () => {
    const result = mealInputSchema.safeParse({
      title: "Piatto inserito",
      mealType: "Pranzo",
      eatenAt: "2026-10-28T12:00:00.000Z",
      calories: 250,
      nutrientSource: "Etichetta del prodotto",
    });
    expect(result.success).toBe(true);
  });

  it("does not turn missing nutrient values into zero", () => {
    const totals = sumNutrients([
      { calories: 210, proteinGrams: 8 },
      { calories: 160, proteinGrams: undefined },
    ]);
    expect(totals.calories).toBe(370);
    expect(totals.proteinGrams).toBeNull();
    expect(totals.missingValues).toBe(5);
    expect(formatNutrient(totals.proteinGrams, " g")).toBe("—");
  });
});

describe("granular privacy checks", () => {
  const ownerId = "owner-1";
  const followerId = "follower-1";

  it("fails closed for every category unless its permission is explicit", () => {
    expect(canViewCategory({ ownerId, viewerId: null, settings: {} }, "diary")).toBe(false);
    expect(canViewCategory({ ownerId, viewerId: followerId, settings: {} }, "diary")).toBe(false);
    expect(canViewCategory({ ownerId, viewerId: ownerId, settings: {} }, "diary")).toBe(true);
  });

  it("requires an approved follower and honors blocks", () => {
    const context = {
      ownerId,
      viewerId: followerId,
      settings: { diary: "followers" as const, nutrition: "private" as const },
      isApprovedFollower: true,
    };
    expect(canViewCategory(context, "diary")).toBe(true);
    expect(canViewCategory({ ...context, isBlocked: true }, "diary")).toBe(false);
    expect(canViewCategory(context, "nutrition")).toBe(false);
  });

  it("keeps per-category choices independent", () => {
    const context = {
      ownerId,
      viewerId: followerId,
      settings: { profile: "public" as const, diary: "private" as const, nutrition: "followers" as const },
      isApprovedFollower: true,
    };
    expect(canViewCategory(context, "profile")).toBe(true);
    expect(canViewCategory(context, "diary")).toBe(false);
    expect(canViewCategory(context, "nutrition")).toBe(true);
    expect(canViewMeal(context, "followers")).toBe(false);
    expect(canViewMeal({ ...context, settings: { diary: "followers" } }, "private")).toBe(false);
    expect(canViewMeal({ ...context, settings: { diary: "followers" } }, "followers")).toBe(true);
  });
});
