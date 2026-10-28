"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatNutrient,
  mealInputSchema,
  mealTypes,
  privacyCategories,
  sumNutrients,
  type PrivacyCategory,
  type PrivacySettings,
  type Visibility,
} from "@/lib/domain";
import {
  defaultPrivacy,
  sampleMeals,
  samplePosts,
  sampleRecipes,
  type DemoComment,
  type DemoMeal,
  type DemoPost,
  type DemoState,
} from "@/lib/demo-data";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Icon, type IconName } from "@/components/icons";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

type Section = "Home" | "Esplora" | "Diario" | "Ricette" | "Community" | "Profilo";
type AppMode = "demo" | "anonymous" | "user";
type Account = { id: string; email: string; username: string };
type PostRow = {
  id: string;
  body: string;
  created_at: string;
  visibility?: string;
  profiles: { username: string | null; display_name: string | null } | { username: string | null; display_name: string | null }[] | null;
};
type MealRow = { id: string; title: string; meal_type: string; eaten_at: string; notes: string | null };
type NutrientRow = {
  meal_id: string;
  calories: number | null;
  protein_g: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
};
type LikeRow = { post_id: string; user_id: string };
type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  profiles: { username: string | null; display_name: string | null } | { username: string | null; display_name: string | null }[] | null;
};

const STORAGE_KEY = "foodcircle-demo-v1";
const navItems: { label: Section; icon: IconName }[] = [
  { label: "Home", icon: "home" },
  { label: "Esplora", icon: "explore" },
  { label: "Diario", icon: "diary" },
  { label: "Ricette", icon: "recipes" },
  { label: "Community", icon: "community" },
  { label: "Profilo", icon: "profile" },
];

const privacyLabels: Record<PrivacyCategory, string> = {
  profile: "Profilo",
  diary: "Diario alimentare",
  nutrition: "Valori nutrizionali",
  weight: "Peso e variazioni",
  progress: "Grafici dei progressi",
  goals: "Obiettivi personali",
  recipes: "Ricette salvate",
  community: "Attività nella community",
};

function emptyState(): DemoState {
  return {
    meals: sampleMeals,
    posts: samplePosts,
    privacy: defaultPrivacy,
  };
}

function initials(name: string) {
  return name
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateTimeInput(date: Date | null) {
  if (!date) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Avatar({ name, className = "", tone = "sage" }: { name: string; className?: string; tone?: string }) {
  return <span className={`avatar avatar-${tone} ${className}`} aria-label={name}>{initials(name)}</span>;
}

function FoodImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={`food-image ${className}`}
      role="img"
      aria-label={alt}
      style={{ backgroundImage: `linear-gradient(180deg, transparent 45%, rgba(31, 38, 30, .08)), url("${src}")` }}
    />
  );
}

function useStoredDemo() {
  const [state, setState] = useState<DemoState>(emptyState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isSupabaseConfigured()) {
        try {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as Partial<DemoState>;
            setState({
              meals: Array.isArray(parsed.meals) ? parsed.meals : sampleMeals,
              posts: Array.isArray(parsed.posts) ? parsed.posts : samplePosts,
              privacy: parsed.privacy ?? defaultPrivacy,
            });
          }
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready && !isSupabaseConfigured()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [ready, state]);

  return { state, setState, ready };
}

export function FoodCircleApp() {
  const { state, setState, ready } = useStoredDemo();
  const [section, setSection] = useState<Section>("Home");
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<AppMode>(() => isSupabaseConfigured() ? "anonymous" : "demo");
  const [authOpen, setAuthOpen] = useState(false);
  const [mealOpen, setMealOpen] = useState(false);
  const [mealPrefill, setMealPrefill] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [searching, setSearching] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationRead, setNotificationRead] = useState(false);
  const [joinedGroups, setJoinedGroups] = useState<string[]>([]);
  const [joinedGroupsReady, setJoinedGroupsReady] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const openMeal = (title = "") => {
    setMealPrefill(title);
    setMealOpen(true);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentDate(new Date()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isSupabaseConfigured()) {
        try {
          const stored = window.localStorage.getItem("foodcircle-demo-groups-v1");
          if (stored) setJoinedGroups(JSON.parse(stored) as string[]);
        } catch {
          window.localStorage.removeItem("foodcircle-demo-groups-v1");
        }
      }
      setJoinedGroupsReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (joinedGroupsReady && !isSupabaseConfigured()) {
      window.localStorage.setItem("foodcircle-demo-groups-v1", JSON.stringify(joinedGroups));
    }
  }, [joinedGroups, joinedGroupsReady]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    if (!supabase) return;
    const [mealResult, postResult, privacyResult, nutrientResult] = await Promise.all([
      supabase
        .from("meals")
        .select("id, title, meal_type, eaten_at, notes")
        .eq("owner_id", userId)
        .order("eaten_at", { ascending: false })
        .limit(40),
      supabase
        .from("posts")
        .select("id, body, created_at, visibility, profiles!posts_author_id_fkey(username, display_name)")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("privacy_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("meal_nutrients")
        .select("meal_id, calories, protein_g, carbohydrates_g, fat_g, source_label")
        .eq("owner_id", userId),
    ]);

    if (mealResult.error) notify("Non sono riuscita a caricare il diario. Verifica le policy del database.");
    if (postResult.error) notify("Il feed non è disponibile: verifica la configurazione del database.");

    const nutrientsByMeal = new Map(
      ((nutrientResult.data ?? []) as NutrientRow[]).map((row) => [row.meal_id, row]),
    );
    const meals: DemoMeal[] = (mealResult.data ?? []).map((row: MealRow) => {
      const nutrients = nutrientsByMeal.get(row.id);
      return {
      id: row.id,
      title: row.title,
      mealType: row.meal_type,
      eatenAt: row.eaten_at,
      notes: row.notes ?? undefined,
      calories: nutrients?.calories ?? undefined,
      proteinGrams: nutrients?.protein_g ?? undefined,
      carbohydrateGrams: nutrients?.carbohydrates_g ?? undefined,
      fatGrams: nutrients?.fat_g ?? undefined,
      nutrientSource: nutrients ? "Fonte indicata" : undefined,
    };
    });
    const postRows = (postResult.data ?? []) as PostRow[];
    const postIds = postRows.map((row) => row.id);
    const [likesResult, commentsResult] = postIds.length
      ? await Promise.all([
          supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
          supabase.from("comments").select("id, post_id, author_id, body, profiles!comments_author_id_fkey(username, display_name)").in("post_id", postIds).order("created_at", { ascending: true }).limit(100),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    const likeRows = (likesResult.data ?? []) as LikeRow[];
    const commentRows = (commentsResult.data ?? []) as CommentRow[];
    const posts: DemoPost[] = postRows.map((row: PostRow) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const authorName = profile?.display_name || profile?.username || "Membro FoodCircle";
      const postComments: DemoComment[] = commentRows
        .filter((comment) => comment.post_id === row.id)
        .map((comment) => {
          const commentProfile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
          return { id: comment.id, author: commentProfile?.display_name || commentProfile?.username || "Membro", text: comment.body };
        });
      return {
        id: row.id,
        author: authorName,
        handle: profile?.username || "community",
        time: new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(row.created_at)),
        text: row.body,
        image: "",
        imageAlt: "",
        tag: "COMMUNITY",
        likes: likeRows.filter((like) => like.post_id === row.id).length,
        liked: likeRows.some((like) => like.post_id === row.id && like.user_id === userId),
        saved: false,
        comments: postComments,
      };
    });

    let privacy = defaultPrivacy;
    if (privacyResult.data) {
      privacy = Object.fromEntries(
        privacyCategories.map((category) => [
          category,
          privacyResult.data[`${category}_visibility`] ?? "private",
        ]),
      ) as PrivacySettings;
    }

    setState((current) => ({
      ...current,
      meals,
      posts: posts.length ? posts : [],
      privacy,
    }));
  }, [notify, setState, supabase]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const setSession = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !active) return;
      if (data.user) {
        const user = data.user;
        const username = user.user_metadata?.username || user.email?.split("@")[0] || "membro";
        setAccount({ id: user.id, email: user.email ?? "", username });
        setMode("user");
        await loadUserData(user.id);
      } else {
        setAccount(null);
        setMode("anonymous");
        setState({ meals: [], posts: [], privacy: defaultPrivacy });
        const { data: publicPosts } = await supabase
          .from("posts")
          .select("id, body, created_at, profiles!posts_author_id_fkey(username, display_name)")
          .eq("visibility", "public")
          .order("created_at", { ascending: false })
          .limit(20);
        if (active && publicPosts?.length) {
          const posts: DemoPost[] = publicPosts.map((row: PostRow) => {
            const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
            const authorName = profile?.display_name || profile?.username || "Membro FoodCircle";
            return {
              id: row.id,
              author: authorName,
              handle: profile?.username || "community",
              time: new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(row.created_at)),
              text: row.body,
              image: "",
              imageAlt: "",
              tag: "COMMUNITY",
              likes: 0,
              liked: false,
              saved: false,
              comments: [],
            };
          });
          setState((current) => ({ ...current, posts }));
        }
      }
    };

    void setSession();
    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!active) return;
      if (session?.user) {
        const user = session.user;
        setAccount({
          id: user.id,
          email: user.email ?? "",
          username: user.user_metadata?.username || user.email?.split("@")[0] || "membro",
        });
        setMode("user");
        window.setTimeout(() => void loadUserData(user.id), 0);
      } else {
        setAccount(null);
        setMode("anonymous");
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [loadUserData, setState, supabase]);

  const today = currentDate ? localDateKey(currentDate) : "";
  const todayMeals = state.meals.filter((meal) => meal.eatenAt.slice(0, 10) === today);
  const todayTotals = sumNutrients(todayMeals);
  const isConnected = mode === "user" && Boolean(account);
  const visiblePosts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it-IT");
    if (!query) return state.posts;
    return state.posts.filter((post) => `${post.text} ${post.author} ${post.tag}`.toLocaleLowerCase("it-IT").includes(query));
  }, [search, state.posts]);

  const handleMeal = async (formData: FormData) => {
    const title = String(formData.get("title") ?? "");
    const dateValue = String(formData.get("eatenAt") ?? "");
    const eatenAt = new Date(dateValue);
    if (!Number.isFinite(eatenAt.getTime())) {
      notify("Inserisci una data e un orario validi.");
      return;
    }
    const result = mealInputSchema.safeParse({
      title,
      mealType: String(formData.get("mealType") ?? "Colazione"),
      visibility: String(formData.get("mealVisibility") ?? "private"),
      eatenAt: eatenAt.toISOString(),
      quantity: formData.get("quantity") ? Number(formData.get("quantity")) : undefined,
      unit: String(formData.get("unit") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
      calories: formData.get("calories") ? Number(formData.get("calories")) : undefined,
      proteinGrams: formData.get("proteinGrams") ? Number(formData.get("proteinGrams")) : undefined,
      carbohydrateGrams: formData.get("carbohydrateGrams") ? Number(formData.get("carbohydrateGrams")) : undefined,
      fatGrams: formData.get("fatGrams") ? Number(formData.get("fatGrams")) : undefined,
      nutrientSource: String(formData.get("nutrientSource") ?? "") || undefined,
    });

    if (!result.success) {
      notify(result.error.issues[0]?.message ?? "Controlla i dati inseriti.");
      return;
    }

    const meal: DemoMeal = {
      id: crypto.randomUUID(),
      ...result.data,
      mealType: result.data.mealType,
    };

    if (isConnected && supabase && account) {
      const { data, error } = await supabase
        .from("meals")
        .insert({
          owner_id: account.id,
          title: meal.title,
          meal_type: meal.mealType,
          eaten_at: meal.eatenAt,
          notes: meal.notes ?? null,
          visibility: meal.visibility ?? "private",
        })
        .select("id")
        .single();
      if (error || !data) {
        notify("Non è stato possibile salvare il pasto. Verifica le policy RLS.");
        return;
      }
      let partialSaveMessage = "";
      const { error: entryError } = await supabase.from("meal_entries").insert({
        owner_id: account.id,
        meal_id: data.id,
        food_label: meal.title,
        quantity: meal.quantity ?? null,
        unit: meal.unit ?? null,
      });
      if (entryError) partialSaveMessage = "Il pasto è salvato, ma non è stato registrato il dettaglio della porzione.";
      const hasNutrition = [meal.calories, meal.proteinGrams, meal.carbohydrateGrams, meal.fatGrams].some((value) => value !== undefined);
      if (hasNutrition) {
        const { error: nutritionError } = await supabase.from("meal_nutrients").insert({
          owner_id: account.id,
          meal_id: data.id,
          calories: meal.calories ?? null,
          protein_g: meal.proteinGrams ?? null,
          carbohydrates_g: meal.carbohydrateGrams ?? null,
          fat_g: meal.fatGrams ?? null,
          source_label: meal.nutrientSource,
        });
        if (nutritionError) {
          partialSaveMessage = "Il pasto è salvato, ma i valori nutrizionali no. Puoi aggiungerli di nuovo.";
        }
      }
      await loadUserData(account.id);
      setMealOpen(false);
      notify(partialSaveMessage || "Pasto salvato nel diario privato.");
      return;
    } else if (mode === "demo") {
      setState((current) => ({ ...current, meals: [meal, ...current.meals] }));
    } else {
      notify("Accedi per salvare un pasto nel tuo account.");
      return;
    }

    setMealOpen(false);
    setMealPrefill("");
    notify("Pasto salvato nel diario privato.");
  };

  const handlePost = async (formData: FormData) => {
    const text = String(formData.get("postText") ?? "").trim();
    const visibility = String(formData.get("postVisibility") ?? "followers") as Visibility;
    if (!text || text.length > 1200) {
      notify("Scrivi un testo da 1 a 1200 caratteri.");
      return;
    }
    if (isConnected && supabase && account) {
      const { error } = await supabase.from("posts").insert({
        author_id: account.id,
        body: text,
        visibility,
      });
      if (error) {
        notify("Non è stato possibile pubblicare. Verifica le policy RLS.");
        return;
      }
      await loadUserData(account.id);
    } else if (mode === "demo") {
      const post: DemoPost = {
        id: crypto.randomUUID(),
        author: "Il tuo profilo",
        handle: "tu",
        time: "ora",
        text,
        image: "",
        imageAlt: "",
        tag: "IL TUO POST",
        likes: 0,
        liked: false,
        saved: false,
        comments: [],
      };
      setState((current) => ({ ...current, posts: [post, ...current.posts] }));
    } else {
      notify("Accedi per pubblicare nella community.");
      return;
    }
    setComposerOpen(false);
    notify("Post pubblicato.");
  };

  const toggleLike = async (post: DemoPost) => {
    if (isConnected && supabase && account && !post.id.startsWith("post-sample-")) {
      const action = post.liked
        ? supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", account.id)
        : supabase.from("post_likes").insert({ post_id: post.id, user_id: account.id });
      const { error } = await action;
      if (error) notify("Non è stato possibile aggiornare il mi piace.");
      else setState((current) => ({
        ...current,
        posts: current.posts.map((item) => item.id === post.id
          ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) }
          : item),
      }));
      return;
    }
    if (mode === "anonymous") {
      notify("Accedi per interagire con i post.");
      return;
    }
    setState((current) => ({
      ...current,
      posts: current.posts.map((item) => item.id === post.id
        ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) }
        : item),
    }));
  };

  const toggleSave = (postId: string) => {
    if (mode === "anonymous") {
      notify("Accedi per salvare un post.");
      return;
    }
    setState((current) => ({
      ...current,
      posts: current.posts.map((post) => post.id === postId ? { ...post, saved: !post.saved } : post),
    }));
    notify("Post aggiornato tra i salvati.");
  };

  const addComment = async (post: DemoPost, formData: FormData) => {
    const text = String(formData.get("comment") ?? "").trim();
    if (!text) return;
    if (isConnected && supabase && account && !post.id.startsWith("post-sample-")) {
      const { data, error } = await supabase.from("comments").insert({
        post_id: post.id,
        author_id: account.id,
        body: text,
      }).select("id").single();
      if (error) notify("Non è stato possibile aggiungere il commento.");
      else if (data) setState((current) => ({
        ...current,
        posts: current.posts.map((item) => item.id === post.id
          ? { ...item, comments: [...item.comments, { id: data.id, author: account.username, text }] }
          : item),
      }));
      return;
    }
    if (mode === "anonymous") {
      notify("Accedi per commentare.");
      return;
    }
    const comment: DemoComment = { id: crypto.randomUUID(), author: "Tu", text };
    setState((current) => ({
      ...current,
      posts: current.posts.map((item) => item.id === post.id
        ? { ...item, comments: [...item.comments, comment] }
        : item),
    }));
  };

  const changePrivacy = async (category: PrivacyCategory, visibility: Visibility) => {
    const nextPrivacy = { ...state.privacy, [category]: visibility };
    if (isConnected && supabase && account) {
      const { error } = await supabase
        .from("privacy_settings")
        .update({ [`${category}_visibility`]: visibility })
        .eq("user_id", account.id);
      if (error) {
        notify("Impostazione non salvata. Verifica la tabella privacy_settings.");
        return;
      }
    } else if (mode === "anonymous") {
      notify("Accedi per salvare le preferenze di privacy.");
      return;
    }
    setState((current) => ({ ...current, privacy: nextPrivacy }));
    notify(`Privacy aggiornata: ${privacyLabels[category].toLocaleLowerCase("it-IT")}.`);
  };

  const exportData = async () => {
    if (mode === "anonymous") {
      setAuthOpen(true);
      return;
    }
    let exportPayload: unknown;
    if (isConnected && supabase && account) {
      const [profile, privacy, meals, entries, nutrients, foods, posts, recipes, follows, blocks, comments, likes, savedPosts, savedRecipes, groupMemberships, groupPosts, notifications, reports] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", account.id).maybeSingle(),
        supabase.from("privacy_settings").select("*").eq("user_id", account.id).maybeSingle(),
        supabase.from("meals").select("*").eq("owner_id", account.id),
        supabase.from("meal_entries").select("*").eq("owner_id", account.id),
        supabase.from("meal_nutrients").select("*").eq("owner_id", account.id),
        supabase.from("food_items").select("*").eq("owner_id", account.id),
        supabase.from("posts").select("*").eq("author_id", account.id),
        supabase.from("recipes").select("*").eq("author_id", account.id),
        supabase.from("follows").select("*").or(`follower_id.eq.${account.id},following_id.eq.${account.id}`),
        supabase.from("blocks").select("*").or(`blocker_id.eq.${account.id},blocked_id.eq.${account.id}`),
        supabase.from("comments").select("*").eq("author_id", account.id),
        supabase.from("post_likes").select("*").eq("user_id", account.id),
        supabase.from("saved_posts").select("*").eq("user_id", account.id),
        supabase.from("saved_recipes").select("*").eq("user_id", account.id),
        supabase.from("group_members").select("*").eq("user_id", account.id),
        supabase.from("group_posts").select("*").eq("author_id", account.id),
        supabase.from("notifications").select("*").eq("recipient_id", account.id),
        supabase.from("reports").select("*").eq("reporter_id", account.id),
      ]);
      const errors = [profile, privacy, meals, entries, nutrients, foods, posts, recipes, follows, blocks, comments, likes, savedPosts, savedRecipes, groupMemberships, groupPosts, notifications, reports]
        .filter((result) => result.error);
      if (errors.length) {
        notify("Esportazione incompleta: verifica l’accesso alle tabelle del tuo account.");
        return;
      }
      exportPayload = {
        exportedAt: new Date().toISOString(),
        profile: profile.data,
        privacySettings: privacy.data,
        meals: meals.data,
        mealEntries: entries.data,
        mealNutrients: nutrients.data,
        foodItems: foods.data,
        posts: posts.data,
        recipes: recipes.data,
        follows: follows.data,
        blocks: blocks.data,
        comments: comments.data,
        likes: likes.data,
        savedPosts: savedPosts.data,
        savedRecipes: savedRecipes.data,
        groupMemberships: groupMemberships.data,
        groupPosts: groupPosts.data,
        notifications: notifications.data,
        reports: reports.data,
      };
    } else {
      exportPayload = {
        exportedAt: new Date().toISOString(),
        demoOnly: true,
        note: "Dati dimostrativi conservati nel browser corrente.",
        ...state,
        savedRecipes: window.localStorage.getItem("foodcircle-demo-recipes-v1"),
      };
    }
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `foodcircle-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Esportazione avviata.");
  };

  const deleteAccount = async () => {
    if (!account || !supabase) return;
    const confirmed = window.confirm("Vuoi cancellare definitivamente il tuo account FoodCircle e i dati collegati? Questa azione non può essere annullata.");
    if (!confirmed) return;
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
    });
    const result = await response.json() as { error?: string; ok?: boolean };
    if (!response.ok || !result.ok) {
      notify(result.error ?? "Non è stato possibile cancellare l’account.");
      return;
    }
    await supabase.auth.signOut();
    setAccount(null);
    setMode("anonymous");
    setState({ meals: [], posts: [], privacy: defaultPrivacy });
    notify("Account cancellato. I dati collegati sono stati rimossi dal database.");
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setAccount(null);
    setMode(isSupabaseConfigured() ? "anonymous" : "demo");
    if (isSupabaseConfigured()) setState({ meals: [], posts: [], privacy: defaultPrivacy });
    notify("Hai effettuato la disconnessione.");
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    if (value.trim()) setSection("Esplora");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setSection("Home"); }}>
          <span className="brand-mark"><Icon name="leaf" size={22} strokeWidth={2.1} /></span>
          <span className="brand-name">food<span>circle</span><small>mangiare bene, insieme</small></span>
        </a>

        <div className="sidebar-label">MENU</div>
        <nav className="main-nav" aria-label="Navigazione principale">
          {navItems.map((item) => (
            <button
              className={`nav-item ${section === item.label ? "active" : ""}`}
              key={item.label}
              onClick={() => setSection(item.label)}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.label === "Home" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-community">
          <div className="sidebar-label">I TUOI SPAZI</div>
          <button className="small-group-link" onClick={() => setSection("Community")}>
            <span className="group-emoji">🥑</span><span>Cucina vegetale</span>
          </button>
          <button className="small-group-link" onClick={() => setSection("Community")}>
            <span className="group-emoji">🍲</span><span>Meal prep easy</span>
          </button>
          <button className="create-group-link" onClick={() => setSection("Community")}>
            <Icon name="plus" size={15} /> Scopri i gruppi
          </button>
        </div>

        <div className="sidebar-bottom">
          <div className="privacy-note"><Icon name="lock" size={16} /><span>I tuoi dati alimentari sono privati per impostazione predefinita.</span></div>
          <button className="profile-mini" onClick={() => setSection("Profilo")}>
            <Avatar name={account?.username ?? "FoodCircle Demo"} />
            <span className="profile-mini-copy"><strong>{account?.username ?? "Profilo demo"}</strong><small>{account ? "Account collegato" : "Modalità locale"}</small></span>
            <Icon name="arrow" size={15} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Icon name="leaf" size={20} /></span><strong>foodcircle</strong></div>
          <div className={`search-box ${searching ? "search-open" : ""}`} onClick={() => { if (window.innerWidth <= 620 && !searching) { setSearching(true); window.setTimeout(() => searchInputRef.current?.focus(), 0); } }}>
            <Icon name="search" size={18} />
            <input
              aria-label="Cerca persone, ricette e argomenti"
              placeholder="Cerca persone, ricette, argomenti..."
              ref={searchInputRef}
              value={search}
              onChange={(event) => handleSearch(event.target.value)}
              onFocus={() => setSearching(true)}
              onBlur={() => setSearching(false)}
            />
          </div>
          <div className="topbar-actions">
            <span className={`mode-pill ${mode === "demo" ? "mode-demo" : "mode-live"}`}>
              <i />{mode === "demo" ? "DEMO LOCALE" : mode === "user" ? "ACCOUNT" : "COMMUNITY"}
            </span>
            <div className="notification-wrap">
              <button className="icon-button notification-button" aria-label="Notifiche" onClick={() => { setNotificationOpen(!notificationOpen); setNotificationRead(true); }}>
                <Icon name="bell" size={19} />
                {!notificationRead && <span className="notification-ping" />}
              </button>
              {notificationOpen && <div className="notification-popover"><strong>Sei aggiornata/o</strong><p>Quando qualcuno interagirà con i tuoi post, lo troverai qui.</p></div>}
            </div>
            {account ? (
              <button className="topbar-avatar-button" onClick={signOut} title="Esci"><Avatar name={account.username} /></button>
            ) : (
              <button className="topbar-login" onClick={() => setAuthOpen(true)}>{mode === "demo" ? "Configura account" : "Accedi"}</button>
            )}
          </div>
        </header>

        {mode === "demo" && (
          <div className="demo-banner"><Icon name="sparkles" size={17} /><span><strong>Stai esplorando FoodCircle in demo.</strong> I dati sono salvati solo in questo browser; per un archivio protetto configura Supabase.</span><button onClick={() => setAuthOpen(true)}>Configura <Icon name="arrow" size={14} /></button></div>
        )}

        <div className="content-layout">
          <section className="primary-column">
            {section === "Home" && (
              <HomeSection
                posts={visiblePosts}
                meals={todayMeals}
                account={account}
                mode={mode}
                search={search}
                currentDate={currentDate}
                onOpenMeal={openMeal}
                onOpenComposer={() => setComposerOpen(true)}
                onLike={toggleLike}
                onSave={toggleSave}
                onComment={addComment}
              />
            )}
            {section === "Esplora" && (
              <ExploreSection
                query={search}
                posts={visiblePosts}
                onSearch={setSearch}
                onLike={toggleLike}
                onSave={toggleSave}
                onComment={addComment}
                onOpenComposer={() => setComposerOpen(true)}
              />
            )}
            {section === "Diario" && (
              <DiarySection meals={todayMeals} totals={todayTotals} currentDate={currentDate} onOpenMeal={openMeal} />
            )}
            {section === "Ricette" && <RecipesSection onAddMeal={openMeal} />}
            {section === "Community" && <CommunitySection joined={joinedGroups} mode={mode} onJoin={(group) => setJoinedGroups((items) => items.includes(group) ? items.filter((item) => item !== group) : [...items, group])} />}
            {section === "Profilo" && (
              <ProfileSection
                account={account}
                mode={mode}
                privacy={state.privacy}
                onPrivacyChange={changePrivacy}
                onOpenAuth={() => setAuthOpen(true)}
                onSignOut={signOut}
                onExport={exportData}
                onDeleteAccount={deleteAccount}
              />
            )}
          </section>

          <aside className="right-column">
            <DailyCard meals={todayMeals} totals={todayTotals} currentDate={currentDate} onAdd={openMeal} />
            <WeekCard meals={state.meals} currentDate={currentDate} onOpenDiary={() => setSection("Diario")} />
            <div className="right-recipe-card">
              <div className="side-title-row"><div><span className="eyebrow">ISPIRAZIONE</span><h3>Un’idea per oggi</h3></div><button className="text-arrow" onClick={() => setSection("Ricette")} aria-label="Vedi tutte le ricette"><Icon name="arrow" size={17} /></button></div>
              <FoodImage src={sampleRecipes[0].image} alt={sampleRecipes[0].imageAlt} className="side-recipe-image" />
              <div className="side-recipe-info"><div><strong>{sampleRecipes[0].name}</strong><small>{sampleRecipes[0].category}</small></div><button className="round-arrow" onClick={() => setSection("Ricette")} aria-label="Apri ricetta"><Icon name="arrow" size={16} /></button></div>
              <p className="source-note">Ricetta d’esempio · valori nutrizionali non indicati</p>
            </div>
            <div className="gentle-note"><span>✦</span><p>Ogni percorso è personale. Qui si condivide con gentilezza, senza giudizi.</p></div>
          </aside>
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Navigazione mobile">
        {navItems.map((item) => (
          <button className={section === item.label ? "active" : ""} key={item.label} aria-label={item.label} onClick={() => setSection(item.label)}>
            <Icon name={item.icon} size={20} /><span>{item.label}</span>
          </button>
        ))}
      </nav>

      {mealOpen && <MealDialog initialTitle={mealPrefill} currentDate={currentDate} onClose={() => setMealOpen(false)} onSubmit={handleMeal} />}
      {composerOpen && <ComposerDialog onClose={() => setComposerOpen(false)} onSubmit={handlePost} />}
      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} configured={isSupabaseConfigured()} />}
      {toast && <div className="toast-message" role="status"><Icon name="circle-check" size={18} />{toast}</div>}
      {!ready && <div className="loading-cover" aria-label="Caricamento"><span className="spinner" /></div>}
    </div>
  );
}

function SectionHeading({ eyebrow, title, intro, action }: { eyebrow: string; title: string; intro?: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{intro && <p>{intro}</p>}</div>
      {action}
    </div>
  );
}

function HomeSection({
  posts, meals, account, mode, search, currentDate, onOpenMeal, onOpenComposer, onLike, onSave, onComment,
}: {
  posts: DemoPost[]; meals: DemoMeal[]; account: Account | null; mode: AppMode; search: string;
  currentDate: Date | null;
  onOpenMeal: () => void; onOpenComposer: () => void; onLike: (post: DemoPost) => void;
  onSave: (id: string) => void; onComment: (post: DemoPost, data: FormData) => void;
}) {
  const name = account?.username ?? "Giulia";
  const todayLabel = currentDate
    ? new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(currentDate).toLocaleUpperCase("it-IT")
    : "";
  return (
    <>
      <div className="welcome-row">
        <div><span className="eyebrow">{todayLabel}</span><h1>Buongiorno, {name} <span className="wave">✦</span></h1><p>Un piccolo spazio per prenderti cura delle tue abitudini.</p></div>
        <button className="primary-button" onClick={onOpenMeal}><Icon name="plus" size={18} /> Registra un pasto</button>
      </div>

      <div className="daily-summary-mobile">
        <div><span className="eyebrow">OGGI</span><strong>{meals.length} {meals.length === 1 ? "pasto" : "pasti"} registrati</strong><small>I dati nutrizionali restano privati.</small></div>
        <button className="round-button" onClick={onOpenMeal} aria-label="Aggiungi un pasto"><Icon name="plus" size={19} /></button>
      </div>

      <div className="feed-heading"><div><h2>Il tuo cerchio</h2><p>Idee e momenti condivisi dalla community</p></div><span className="feed-filter"><Icon name="sparkles" size={15} /> Per te</span></div>

      {mode === "demo" && posts.length > 0 && <div className="sample-label"><span /> POST DI ESEMPIO · INFORMAZIONI PERSONALI NON INCLUSE</div>}
      {search && <div className="search-result-note">Risultati per <strong>“{search}”</strong></div>}
      <div className="feed-list">
        {posts.length === 0 ? (
          <div className="empty-card"><span className="empty-icon"><Icon name="community" size={22} /></span><h3>Il feed si sta riempiendo</h3><p>Quando verranno pubblicati contenuti visibili a te, li troverai qui. Puoi iniziare con un post tutto tuo.</p><button className="primary-button" onClick={onOpenComposer}><Icon name="plus" size={17} /> Crea un post</button></div>
        ) : posts.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} onLike={() => onLike(post)} onSave={() => onSave(post.id)} onComment={(formData) => onComment(post, formData)} />
        ))}
      </div>
      <button className="floating-create" onClick={onOpenComposer} aria-label="Crea un post"><Icon name="plus" size={22} /></button>
    </>
  );
}

function PostCard({ post, index, onLike, onSave, onComment }: {
  post: DemoPost; index: number; onLike: () => void; onSave: () => void; onComment: (data: FormData) => void;
}) {
  const [commentOpen, setCommentOpen] = useState(false);
  const hasImage = Boolean(post.image);
  return (
    <article className="post-card">
      <div className="post-topline">
        <div className="post-author"><Avatar name={post.author} tone={index % 3 === 1 ? "rose" : index % 3 === 2 ? "lavender" : "sage"} /><span><strong>{post.author}</strong><small>@{post.handle} <span>·</span> {post.time}</small></span></div>
        <div className="post-top-actions"><span className="visibility-chip"><Icon name="community" size={13} /> {post.tag}</span></div>
      </div>
      <p className="post-copy">{post.text}</p>
      {hasImage && <FoodImage src={post.image} alt={post.imageAlt} className={`post-image post-image-${index % 2 === 0 ? "wide" : "compact"}`} />}
      <div className="post-actions">
        <button className={`post-action ${post.liked ? "liked" : ""}`} onClick={onLike} aria-label={post.liked ? "Rimuovi mi piace" : "Metti mi piace"}><Icon name="heart" size={18} /><span>{post.likes}</span></button>
        <button className="post-action" onClick={() => setCommentOpen(!commentOpen)} aria-label="Mostra commenti"><Icon name="comment" size={18} /><span>{post.comments.length}</span></button>
        <button className="post-action" aria-label="Condividi post" onClick={() => { if (navigator.share) void navigator.share({ title: "FoodCircle", text: post.text }).catch(() => undefined); else void navigator.clipboard?.writeText(post.text); }}><Icon name="share" size={17} /><span>Condividi</span></button>
        <button className={`post-save ${post.saved ? "saved" : ""}`} onClick={onSave} aria-label={post.saved ? "Rimuovi dai salvati" : "Salva post"}><Icon name="bookmark" size={18} /></button>
      </div>
      {post.comments.length > 0 && !commentOpen && <button className="view-comments" onClick={() => setCommentOpen(true)}>Vedi tutti i {post.comments.length} commenti</button>}
      {commentOpen && (
        <div className="comments-panel">
          {post.comments.map((comment) => <div className="comment-line" key={comment.id}><strong>{comment.author}</strong><span>{comment.text}</span></div>)}
          <form action={onComment} className="comment-form"><input name="comment" placeholder="Aggiungi un commento gentile..." maxLength={500} aria-label="Aggiungi un commento" /><button type="submit" aria-label="Invia commento"><Icon name="send" size={17} /></button></form>
        </div>
      )}
      {hasImage && <div className="post-meta-note"><Icon name="lock" size={13} /> I valori nutrizionali non sono stati condivisi</div>}
    </article>
  );
}

function ExploreSection({ query, posts, onSearch, onLike, onSave, onComment, onOpenComposer }: {
  query: string; posts: DemoPost[]; onSearch: (value: string) => void; onLike: (post: DemoPost) => void;
  onSave: (id: string) => void; onComment: (post: DemoPost, data: FormData) => void; onOpenComposer: () => void;
}) {
  const topics = ["Pasti veloci", "Cucina vegetale", "Meal prep", "Colazioni", "Senza glutine"];
  return (
    <>
      <SectionHeading eyebrow="SCOPRI IL TUO CERCHIO" title="Esplora" intro="Ricette, idee e conversazioni dalla community." action={<button className="outline-button" onClick={onOpenComposer}><Icon name="plus" size={16} /> Condividi</button>} />
      <div className="explore-search"><Icon name="search" size={18} /><input placeholder="Cerca un argomento o una persona" value={query} onChange={(event) => onSearch(event.target.value)} aria-label="Cerca contenuti" /></div>
      <div className="topic-row">{topics.map((topic) => <button key={topic} onClick={() => onSearch(topic)}>{topic}<Icon name="arrow" size={13} /></button>)}</div>
      <div className="explore-feature"><FoodImage src={sampleRecipes[1].image} alt={sampleRecipes[1].imageAlt} className="explore-feature-image" /><div><span className="eyebrow">IL TEMA DELLA SETTIMANA</span><h2>Idee semplici, ingredienti di stagione</h2><p>Condividi quello che ti ispira: ogni esperienza è personale.</p></div></div>
      <div className="explore-feed-heading"><h2>Conversazioni recenti</h2><button className="text-arrow" onClick={() => onSearch("")}>Tutti <Icon name="arrow" size={15} /></button></div>
      <div className="feed-list">{posts.length ? posts.map((post, index) => <PostCard key={post.id} post={post} index={index} onLike={() => onLike(post)} onSave={() => onSave(post.id)} onComment={(data) => onComment(post, data)} />) : <div className="empty-card"><h3>Nessun risultato per ora</h3><p>Prova un’altra ricerca oppure avvia la conversazione.</p><button className="primary-button" onClick={onOpenComposer}><Icon name="plus" size={17} /> Crea un post</button></div>}</div>
    </>
  );
}

function DiarySection({ meals, totals, currentDate, onOpenMeal }: { meals: DemoMeal[]; totals: ReturnType<typeof sumNutrients>; currentDate: Date | null; onOpenMeal: () => void }) {
  const groups = mealTypes.map((type) => ({ type, meals: meals.filter((meal) => meal.mealType === type) }));
  return (
    <>
      <SectionHeading eyebrow="IL TUO SPAZIO PERSONALE" title="Diario alimentare" intro="Un promemoria gentile delle tue giornate. La visibilità segue le tue impostazioni." action={<button className="primary-button" onClick={onOpenMeal}><Icon name="plus" size={18} /> Aggiungi pasto</button>} />
      <div className="privacy-banner"><Icon name="lock" size={17} /><span><strong>Il diario è privato per impostazione predefinita.</strong> Un pasto non viene pubblicato nel feed quando lo registri.</span></div>
      <div className="diary-datebar"><strong><Icon name="calendar" size={17} /> Oggi{currentDate ? `, ${new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(currentDate)}` : ""}</strong><button className="text-arrow date-week" onClick={() => document.querySelector(".week-card")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Riepilogo settimanale <Icon name="chevron" size={14} /></button></div>
      <div className="nutrient-summary">
        <div className="nutrient-summary-heading"><div><span className="eyebrow">RIEPILOGO DI OGGI</span><h2>Quello che hai registrato</h2></div><span className="private-label"><Icon name="lock" size={13} /> Condivisione separata</span></div>
        <div className="nutrient-grid">
          <NutrientTile label="Energia" value={formatNutrient(totals.calories, " kcal")} color="green" />
          <NutrientTile label="Proteine" value={formatNutrient(totals.proteinGrams, " g")} color="rose" />
          <NutrientTile label="Carboidrati" value={formatNutrient(totals.carbohydrateGrams, " g")} color="blue" />
          <NutrientTile label="Grassi" value={formatNutrient(totals.fatGrams, " g")} color="orange" />
        </div>
        <p className="nutrition-explainer">I valori mancanti restano indicati con un trattino. Aggiungi numeri solo quando hai una fonte attendibile.</p>
      </div>
      <div className="meal-list-heading"><h2>I tuoi pasti</h2><span>{meals.length} {meals.length === 1 ? "registrato" : "registrati"}</span></div>
      <div className="meal-groups">
        {groups.filter((group) => group.meals.length > 0).map((group) => (
          <div className="meal-group" key={group.type}><div className="meal-group-title"><span className={`meal-type-icon type-${group.type.toLocaleLowerCase("it-IT")}`}><Icon name={group.type === "Colazione" ? "sparkles" : "utensils"} size={16} /></span><strong>{group.type}</strong><span>{group.meals.length}</span><button className="text-arrow" onClick={onOpenMeal}><Icon name="plus" size={16} /></button></div>
            {group.meals.map((meal) => <div className="meal-row" key={meal.id}><div className="meal-time"><Icon name="clock" size={14} />{new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(meal.eatenAt))}</div><div className="meal-copy"><strong>{meal.title}</strong>{meal.notes && <small>{meal.notes}</small>}</div><span className="meal-private-tag"><Icon name="lock" size={12} /> Privato</span></div>)}
          </div>
        ))}
        {meals.length === 0 && <div className="empty-card meal-empty"><span className="empty-icon"><Icon name="diary" size={22} /></span><h3>Comincia quando vuoi</h3><p>Registrare un pasto è facoltativo. Il tuo diario resta privato.</p><button className="primary-button" onClick={onOpenMeal}><Icon name="plus" size={17} /> Registra il primo pasto</button></div>}
      </div>
    </>
  );
}

function NutrientTile({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className={`nutrient-tile nutrient-${color}`}><span>{label}</span><strong>{value}</strong><div className="nutrient-track"><i /></div></div>;
}

function RecipesSection({ onAddMeal }: { onAddMeal: (title?: string) => void }) {
  const [saved, setSaved] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tutte");
  const filtered = sampleRecipes.filter((recipe) => {
    const matchesQuery = recipe.name.toLocaleLowerCase("it-IT").includes(query.toLocaleLowerCase("it-IT"));
    const recipeCategory = recipe.category.split("·")[0].trim().toLocaleLowerCase("it-IT");
    const matchesCategory = selectedCategory === "Tutte" || recipeCategory === selectedCategory.toLocaleUpperCase("it-IT") || (selectedCategory === "Vegetali" && recipe.id !== "recipe-3");
    return matchesQuery && matchesCategory;
  });
  const toggleSaved = (recipeId: string) => {
    setSaved((current) => {
      const next = current.includes(recipeId) ? current.filter((id) => id !== recipeId) : [...current, recipeId];
      window.localStorage.setItem("foodcircle-demo-recipes-v1", JSON.stringify(next));
      return next;
    });
  };
  return (
    <>
      <SectionHeading eyebrow="IDEE DA PORTARE IN TAVOLA" title="Ricette" intro="Ispirazioni della community, con ingredienti e passaggi condivisi da chi cucina." />
      <div className="sample-label"><span /> RICETTE DI ESEMPIO · VALORI NUTRIZIONALI NON INDICATI</div>
      <div className="recipe-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca una ricetta" aria-label="Cerca ricette" /></div>
      <div className="recipe-categories">{["Tutte", "Colazione", "Pranzo", "Cena", "Vegetali"].map((category) => <button onClick={() => setSelectedCategory(category)} className={selectedCategory === category ? "selected" : ""} key={category}>{category}</button>)}</div>
      <div className="recipe-grid">
        {filtered.map((recipe, index) => <article className="recipe-card" key={recipe.id}><div className="recipe-image-wrap"><FoodImage src={recipe.image} alt={recipe.imageAlt} className="recipe-image" /><span className="recipe-time"><Icon name="clock" size={13} /> {recipe.category.split("·")[1]?.trim()}</span><button className={`recipe-save ${saved.includes(recipe.id) ? "saved" : ""}`} aria-label={saved.includes(recipe.id) ? "Rimuovi ricetta dai salvati" : "Salva ricetta"} onClick={() => toggleSaved(recipe.id)}><Icon name="bookmark" size={17} /></button></div><div className="recipe-card-copy"><span className="eyebrow">{recipe.category.split("·")[0]}</span><h3>{recipe.name}</h3><div className="recipe-author"><Avatar name={recipe.author} tone={index % 2 ? "rose" : "sage"} /><span>di {recipe.author}</span><span className="recipe-nutrition-unavailable">Valori non indicati</span></div><button className="recipe-action" onClick={() => onAddMeal(recipe.name)}>Registra nel diario <Icon name="arrow" size={15} /></button></div></article>)}
        {filtered.length === 0 && <div className="empty-card"><h3>Nessuna ricetta trovata</h3><p>Prova una ricerca diversa.</p></div>}
      </div>
      <div className="recipe-disclaimer"><Icon name="sparkles" size={16} /> Le ricette sono esperienze condivise dalla community, non consigli nutrizionali o medici.</div>
    </>
  );
}

function CommunitySection({ joined, mode, onJoin }: { joined: string[]; mode: AppMode; onJoin: (name: string) => void }) {
  const groups = [
    { name: "Cucina vegetale", topic: "Idee vegetali di tutti i giorni", members: "Gruppo pubblico", icon: "🥑", color: "mint" },
    { name: "Meal prep easy", topic: "Organizzarsi senza stress", members: "Gruppo pubblico", icon: "🍲", color: "peach" },
    { name: "Colazioni lente", topic: "Piccoli rituali del mattino", members: "Gruppo pubblico", icon: "☕", color: "lavender" },
    { name: "Cucina economica", topic: "Buone idee, ingredienti accessibili", members: "Gruppo pubblico", icon: "🍋", color: "yellow" },
  ];
  return (
    <>
      <SectionHeading eyebrow="UNA COMMUNITY GENTILE" title="Trova il tuo spazio" intro="Gruppi per scambiarsi idee e fare nuove scoperte, senza competizioni." />
      <div className="community-feature"><div className="community-orbit orbit-one"/><div className="community-orbit orbit-two"/><div className="community-feature-copy"><span className="eyebrow">PICCOLI PASSI, INSIEME</span><h2>Una buona abitudine può nascere da una conversazione.</h2><p>Incontra persone con interessi simili e condividi ciò che ti fa stare bene.</p><button className="light-button" onClick={() => document.getElementById("community-groups")?.scrollIntoView({ behavior: "smooth" })}>Scopri i gruppi <Icon name="arrow" size={15} /></button></div><div className="community-feature-art"><span>🥕</span><span>🍋</span><span>🥬</span><span>🍅</span></div></div>
      <div className="explore-feed-heading"><h2>Gruppi di esempio</h2><button className="text-arrow" onClick={() => document.getElementById("community-groups")?.scrollIntoView({ behavior: "smooth" })}>Vai ai gruppi <Icon name="arrow" size={15} /></button></div>
      <div className="sample-label"><span /> {mode === "demo" ? "LE ISCRIZIONI DI QUESTA DEMO SI SALVANO SOLO NEL BROWSER" : "GRUPPI NON ANCORA COLLEGATI AGLI ACCOUNT"}</div>
      <div className="group-grid" id="community-groups">{groups.map((group) => <article className="community-card" key={group.name}><div className={`group-cover cover-${group.color}`}><span>{group.icon}</span><small>COMMUNITY</small></div><div className="community-card-copy"><h3>{group.name}</h3><p>{group.topic}</p><div className="community-card-bottom"><span><Icon name="community" size={14} /> {group.members}</span><button disabled={mode !== "demo"} title={mode !== "demo" ? "Gruppi reali non ancora collegati" : undefined} className={joined.includes(group.name) ? "joined-button" : "join-button"} onClick={() => onJoin(group.name)}>{joined.includes(group.name) ? "Iscritto" : "Unisciti"}</button></div></div></article>)}</div>
      <div className="gentle-note community-note"><span>♡</span><p>Le sfide FoodCircle celebrano curiosità e costanza personale, mai restrizione o perdita di peso.</p></div>
    </>
  );
}

function ProfileSection({ account, mode, privacy, onPrivacyChange, onOpenAuth, onSignOut, onExport, onDeleteAccount }: {
  account: Account | null; mode: AppMode; privacy: PrivacySettings;
  onPrivacyChange: (category: PrivacyCategory, visibility: Visibility) => void; onOpenAuth: () => void;
  onSignOut: () => void; onExport: () => void; onDeleteAccount: () => void;
}) {
  return (
    <>
      <SectionHeading eyebrow="IL TUO SPAZIO" title="Profilo" intro="Scegli che cosa raccontare di te e a chi mostrarlo." />
      <div className="profile-cover"><div className="cover-sun"/><div className="profile-cover-dots">✦ &nbsp; ✧ &nbsp; ✦</div></div>
      <div className="profile-detail-card"><Avatar name={account?.username ?? "Giulia Riva"} className="profile-large-avatar" /><div className="profile-detail-copy"><div className="profile-title-row"><h2>{account?.username ?? "Giulia Riva"}</h2><span className="profile-handle">@{account?.username ?? "giulia.in.cucina"}</span></div><p className="profile-bio">{account ? "Aggiungi una bio personale quando completerai il profilo." : "Profilo di esempio per esplorare FoodCircle."}</p></div></div>
      {mode === "demo" && <div className="demo-account-info"><Icon name="sparkles" size={17} /><span>Profilo dimostrativo: le modifiche sono locali a questo browser e non rappresentano un account reale.</span><button onClick={onOpenAuth}>Configura account <Icon name="arrow" size={14} /></button></div>}
      <div className="privacy-settings-card"><div className="privacy-settings-header"><div><span className="eyebrow">CONTROLLO GRANULARE</span><h2>La tua privacy, categoria per categoria</h2><p>Ogni scelta è indipendente. Il diario è privato finché non decidi diversamente.</p></div><span className="privacy-header-icon"><Icon name="lock" size={20} /></span></div><div className="privacy-options">{privacyCategories.map((category) => <label className="privacy-option" key={category}><span className="privacy-option-copy"><strong>{privacyLabels[category]}</strong><small>{category === "nutrition" ? "Calorie e macronutrienti condivisi" : category === "diary" ? "Pasti e orari registrati" : category === "weight" ? "Peso e sue variazioni nel tempo" : category === "progress" ? "Grafici e riepiloghi personali" : "Controlla chi può vedere questa categoria"}</small></span><select aria-label={`Visibilità: ${privacyLabels[category]}`} value={privacy[category] ?? "private"} onChange={(event) => onPrivacyChange(category, event.target.value as Visibility)}><option value="private">Solo io</option><option value="followers">Follower approvati</option><option value="public">Tutti</option></select></label>)}</div><div className="privacy-settings-footer"><Icon name="check" size={15} /> Le modifiche si applicano alle richieste successive e non pubblicano i dati passati.</div></div>
      <div className="profile-actions-card"><div><h3>Account e dati</h3><p>{account ? account.email : mode === "demo" ? "Sei in modalità demo locale." : "Accedi per gestire i tuoi dati."}</p></div><div className="profile-data-actions"><button className="outline-button" onClick={onExport}><Icon name="arrow" size={15} /> Esporta dati</button>{account ? <><button className="danger-button" onClick={onDeleteAccount}>Elimina account</button><button className="outline-button" onClick={onSignOut}><Icon name="logout" size={16} /> Esci</button></> : <button className="outline-button" onClick={onOpenAuth}>Accedi / registrati</button>}</div></div>
    </>
  );
}

function DailyCard({ meals, totals, currentDate, onAdd }: { meals: DemoMeal[]; totals: ReturnType<typeof sumNutrients>; currentDate: Date | null; onAdd: () => void }) {
  const dateLabel = currentDate
    ? new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "short" }).format(currentDate).toLocaleUpperCase("it-IT")
    : "OGGI";
  return (
    <div className="daily-card"><div className="side-title-row"><div><span className="eyebrow">{dateLabel}</span><h3>Il tuo diario</h3></div><span className="tiny-lock"><Icon name="lock" size={13} /></span></div><div className="daily-progress"><div className="progress-ring"><span><strong>{meals.length}</strong><small>pasti</small></span></div><div className="daily-copy"><strong>Un giorno alla volta</strong><p>{meals.length ? "Hai registrato qualche momento della tua giornata." : "Registra un pasto quando ti va."}</p></div></div><div className="daily-macro-list"><MacroRow label="Energia registrata" value={formatNutrient(totals.calories, " kcal")} tone="green" /><MacroRow label="Proteine" value={formatNutrient(totals.proteinGrams, " g")} tone="rose" /><MacroRow label="Carboidrati" value={formatNutrient(totals.carbohydrateGrams, " g")} tone="blue" /></div><button className="daily-add-button" onClick={onAdd}><Icon name="plus" size={16} /> Aggiungi al diario</button><small className="side-privacy-caption"><Icon name="lock" size={12} /> Visibilità secondo le tue impostazioni</small></div>
  );
}

function MacroRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="macro-row"><span><i className={`macro-dot dot-${tone}`} />{label}</span><strong>{value}</strong></div>;
}

function WeekCard({ meals, currentDate, onOpenDiary }: { meals: DemoMeal[]; currentDate: Date | null; onOpenDiary: () => void }) {
  const dates = currentDate ? Array.from({ length: 7 }, (_, index) => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - (6 - index));
    const iso = localDateKey(date);
    return { iso, label: new Intl.DateTimeFormat("it-IT", { weekday: "narrow" }).format(date), count: meals.filter((meal) => localDateKey(new Date(meal.eatenAt)) === iso).length };
  }) : [];
  const maxCount = Math.max(...dates.map((day) => day.count), 1);
  return <div className="week-card"><div className="side-title-row"><div><span className="eyebrow">LA TUA SETTIMANA</span><h3>Piccoli momenti</h3></div><button className="text-arrow" aria-label="Apri diario" onClick={onOpenDiary}><Icon name="arrow" size={16} /></button></div><div className="week-chart" aria-label="Pasti registrati negli ultimi sette giorni">{dates.map((day) => <div className="week-day" key={day.iso}><div className="week-bar-track"><i style={{ height: `${day.count ? Math.max(18, (day.count / maxCount) * 100) : 5}%` }} /></div><span>{day.label}</span></div>)}</div><p className="week-caption">La costanza è personale. Nessun obiettivo o confronto.</p></div>;
}

function MealDialog({ initialTitle, currentDate, onClose, onSubmit }: { initialTitle: string; currentDate: Date | null; onClose: () => void; onSubmit: (data: FormData) => void }) {
  const [showNutrition, setShowNutrition] = useState(false);
  return (
    <Modal onClose={onClose} title="Aggiungi un pasto" eyebrow="IL TUO DIARIO PRIVATO">
      <form action={onSubmit} className="form-stack">
        <label className="field-label">Che cosa hai mangiato?<input name="title" autoFocus required maxLength={120} defaultValue={initialTitle} placeholder="Es. Insalata di ceci" /></label>
        <div className="form-two-columns"><label className="field-label">Momento<select name="mealType">{mealTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="field-label">Data e ora<input name="eatenAt" type="datetime-local" defaultValue={localDateTimeInput(currentDate)} required /></label></div>
        <div className="form-two-columns"><label className="field-label">Quantità <span>(facoltativo)</span><input name="quantity" type="number" min="0" step="any" placeholder="Es. 150" /></label><label className="field-label">Unità <span>(facoltativo)</span><input name="unit" maxLength={30} placeholder="g, porzione, tazza..." /></label></div>
        <label className="field-label">Note personali <span>(facoltative)</span><textarea name="notes" maxLength={500} rows={2} placeholder="Un pensiero, gli ingredienti o come ti sei sentita/o..." /></label>
        <label className="field-label">Visibilità di questo pasto<select name="mealVisibility" defaultValue="private"><option value="private">Solo io</option><option value="followers">Follower approvati</option><option value="public">Tutti</option></select><small className="field-hint">Per condividerlo servono anche i permessi della categoria Diario nelle impostazioni privacy.</small></label>
        <div className="nutrition-input-toggle"><div><strong>Valori nutrizionali</strong><small>Solo se li conosci da una fonte attendibile.</small></div><button type="button" className={`switch ${showNutrition ? "on" : ""}`} role="switch" aria-checked={showNutrition} onClick={() => setShowNutrition(!showNutrition)}><span /></button></div>
        {showNutrition && <div className="nutrition-inputs"><div className="form-two-columns"><label className="field-label">Energia <span>(kcal)</span><input name="calories" type="number" min="0" step="any" placeholder="—" /></label><label className="field-label">Proteine <span>(g)</span><input name="proteinGrams" type="number" min="0" step="any" placeholder="—" /></label></div><div className="form-two-columns"><label className="field-label">Carboidrati <span>(g)</span><input name="carbohydrateGrams" type="number" min="0" step="any" placeholder="—" /></label><label className="field-label">Grassi <span>(g)</span><input name="fatGrams" type="number" min="0" step="any" placeholder="—" /></label></div><label className="field-label">Fonte dei valori<input name="nutrientSource" maxLength={160} placeholder="Es. etichetta confezione, banca dati..." /></label><small className="field-hint">I campi non compilati resteranno vuoti. Non stimiamo né completiamo valori mancanti.</small></div>}
        <div className="form-footer"><span className="private-label"><Icon name="lock" size={13} /> Privato</span><div><button type="button" className="text-button" onClick={onClose}>Annulla</button><button type="submit" className="primary-button"><Icon name="check" size={16} /> Salva pasto</button></div></div>
      </form>
    </Modal>
  );
}

function ComposerDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: FormData) => void }) {
  return (
    <Modal onClose={onClose} title="Condividi con il tuo cerchio" eyebrow="UN POST, UNA SCELTA CONSAPEVOLE">
      <form action={onSubmit} className="form-stack"><div className="composer-author"><Avatar name="Tu" /><span><strong>Il tuo profilo</strong><small>Le informazioni del diario restano separate</small></span></div><label className="field-label">Che cosa vuoi condividere?<textarea name="postText" autoFocus required rows={5} maxLength={1200} placeholder="Una ricetta, un’idea o un piccolo momento della tua giornata..." /></label><div className="post-privacy-field"><Icon name="lock" size={17} /><div><strong>Chi può vedere questo post?</strong><small>La scelta non modifica la privacy del diario.</small></div><select name="postVisibility" defaultValue="followers"><option value="private">Solo io</option><option value="followers">Follower approvati</option><option value="public">Tutti</option></select></div><div className="composer-note"><Icon name="sparkles" size={15} /> Puoi modificare o rimuovere il post in qualsiasi momento.</div><div className="form-footer"><span className="private-label"><Icon name="lock" size={13} /> Scegli la visibilità</span><div><button type="button" className="text-button" onClick={onClose}>Annulla</button><button type="submit" className="primary-button"><Icon name="send" size={15} /> Pubblica</button></div></div></form>
    </Modal>
  );
}

function AuthDialog({ onClose, configured }: { onClose: () => void; configured: boolean }) {
  const [signUp, setSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const submit = async (formData: FormData) => {
    if (!configured || !supabase) return;
    setBusy(true);
    setMessage("");
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const username = String(formData.get("username") ?? "").trim();
    const result = signUp
      ? await supabase.auth.signUp({ email, password, options: { data: { username } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMessage(signUp ? "Account creato. Controlla la tua email se è richiesta la verifica." : "Accesso completato.");
    if (!signUp && result.data.session) window.setTimeout(onClose, 400);
  };

  const sendRecoveryEmail = async () => {
    if (!configured || !supabase) return;
    if (!email.trim()) {
      setMessage("Inserisci prima l’indirizzo email del tuo account.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setBusy(false);
    setMessage(error ? error.message : "Se l’indirizzo è registrato, riceverai un link per scegliere una nuova password.");
  };

  return (
    <Modal onClose={onClose} title={configured ? (signUp ? "Crea il tuo account" : "Bentornata/o") : "Benvenuta/o in FoodCircle"} eyebrow="IL TUO SPAZIO, LE TUE REGOLE" className="auth-modal">
      {!configured ? <div className="setup-panel"><span className="setup-icon"><Icon name="lock" size={23} /></span><h3>La demo è pronta da esplorare</h3><p>Per creare un account reale e salvare i dati in modo protetto, aggiungi le credenziali del tuo progetto Supabase nel file <code>.env.local</code>, poi applica la migrazione SQL inclusa.</p><div className="setup-steps"><span><i>1</i> Crea un progetto Supabase</span><span><i>2</i> Copia URL e chiave anonima</span><span><i>3</i> Applica <code>supabase/migrations/001_foodcircle.sql</code></span></div><button className="primary-button full-button" onClick={onClose}>Continua in demo <Icon name="arrow" size={15} /></button></div> : <form action={submit} className="form-stack auth-form">{signUp && <label className="field-label">Username<input name="username" minLength={3} maxLength={30} required placeholder="es. giulia.in.cucina" /></label>}<label className="field-label">Email<input name="email" type="email" autoComplete="email" required placeholder="nome@email.it" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field-label">Password<input name="password" type="password" minLength={8} autoComplete={signUp ? "new-password" : "current-password"} required placeholder="Almeno 8 caratteri" /></label><p className="auth-privacy-note"><Icon name="lock" size={15} /> Il tuo diario e i dati personali restano privati.</p>{message && <p className={message.includes("Account creato") || message.includes("completato") || message.startsWith("Se l’indirizzo") ? "form-success" : "form-error"}>{message}</p>}<button type="submit" className="primary-button full-button" disabled={busy}>{busy ? "Attendi..." : signUp ? "Crea account" : "Accedi"}</button><button type="button" className="text-button auth-switch" onClick={() => { setSignUp(!signUp); setMessage(""); }}>{signUp ? "Hai già un account? Accedi" : "Non hai un account? Registrati"}</button>{!signUp && <button type="button" className="text-button auth-recovery" disabled={busy} onClick={sendRecoveryEmail}>Hai dimenticato la password?</button>}</form>}
    </Modal>
  );
}

function Modal({ children, onClose, title, eyebrow, className = "" }: { children: React.ReactNode; onClose: () => void; title: string; eyebrow: string; className?: string }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="eyebrow">{eyebrow}</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Chiudi"><Icon name="close" size={19} /></button></div>{children}</section></div>;
}
