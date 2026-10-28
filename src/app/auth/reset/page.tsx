import type { Metadata } from "next";
import { AuthResetForm } from "@/components/auth-reset-form";

export const metadata: Metadata = { title: "Reimposta password — FoodCircle" };

export default function ResetPasswordPage() {
  return <AuthResetForm />;
}
