import type { PrivacySettings } from "@/lib/domain";

export type DemoMeal = {
  id: string;
  title: string;
  mealType: string;
  eatenAt: string;
  visibility?: "private" | "followers" | "public";
  quantity?: number;
  unit?: string;
  notes?: string;
  calories?: number;
  proteinGrams?: number;
  carbohydrateGrams?: number;
  fatGrams?: number;
  nutrientSource?: string;
};

export type DemoComment = { id: string; author: string; text: string };
export type DemoPost = {
  id: string;
  author: string;
  handle: string;
  time: string;
  text: string;
  image: string;
  imageAlt: string;
  tag: string;
  likes: number;
  liked: boolean;
  saved: boolean;
  comments: DemoComment[];
};

export type DemoState = {
  meals: DemoMeal[];
  posts: DemoPost[];
  privacy: PrivacySettings;
};

export const defaultPrivacy: PrivacySettings = {
  profile: "public",
  diary: "private",
  nutrition: "private",
  weight: "private",
  progress: "private",
  goals: "private",
  recipes: "followers",
  community: "public",
};

export const sampleMeals: DemoMeal[] = [
  {
    id: "meal-sample-1",
    title: "Porridge con pera e cannella",
    mealType: "Colazione",
    eatenAt: "2026-10-28T07:45:00.000Z",
    notes: "Esempio demo. Valori nutrizionali non inseriti.",
  },
  {
    id: "meal-sample-2",
    title: "Insalata di ceci e verdure croccanti",
    mealType: "Pranzo",
    eatenAt: "2026-10-28T12:35:00.000Z",
    notes: "Esempio demo. Valori nutrizionali non inseriti.",
  },
];

export const samplePosts: DemoPost[] = [
  {
    id: "post-sample-1",
    author: "Giulia Riva",
    handle: "giulia.in.cucina",
    time: "35 min fa",
    text: "Una ciotola colorata per la pausa di oggi 🌿 Ho aggiunto quello che avevo in frigo: ceci, verdure croccanti e una salsa al limone. Semplice e buonissima.",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "Ciotola fresca con verdure colorate",
    tag: "IDEA PRANZO",
    likes: 28,
    liked: false,
    saved: false,
    comments: [
      { id: "comment-1", author: "Marta", text: "La salsa al limone come la prepari?" },
      { id: "comment-2", author: "Luca", text: "La provo domani!" },
    ],
  },
  {
    id: "post-sample-2",
    author: "Marta Bellini",
    handle: "martabellini",
    time: "2 ore fa",
    text: "Ho preparato una teglia di verdure per la settimana. Mi aiuta a improvvisare pranzi diversi senza complicarmi la giornata. Che cosa preparate in anticipo?",
    image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "Piatto preparato con ingredienti freschi",
    tag: "MEAL PREP",
    likes: 16,
    liked: false,
    saved: false,
    comments: [
      { id: "comment-3", author: "Elena", text: "Io preparo sempre una zuppa di legumi!" },
    ],
  },
];

export const sampleRecipes = [
  {
    id: "recipe-1",
    name: "Ciotola mediterranea",
    category: "PRANZO · 25 MIN",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "Ciotola mediterranea con verdure",
    author: "Giulia Riva",
  },
  {
    id: "recipe-2",
    name: "Pasta verde di stagione",
    category: "CENA · 30 MIN",
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "Pasta con verdure fresche",
    author: "Elena Conti",
  },
  {
    id: "recipe-3",
    name: "Colazione lenta",
    category: "COLAZIONE · 10 MIN",
    image: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "Colazione con frutta e cereali",
    author: "Marta Bellini",
  },
];
