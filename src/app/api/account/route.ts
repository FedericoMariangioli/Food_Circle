import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 403 });
  }

  let confirmation: unknown;
  try {
    confirmation = (await request.json()).confirmation;
  } catch {
    return NextResponse.json({ error: "Conferma richiesta." }, { status: 400 });
  }
  if (confirmation !== "DELETE MY ACCOUNT") {
    return NextResponse.json({ error: "Conferma di cancellazione non valida." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: "La cancellazione dell’account non è configurata. Aggiungi la chiave service role solo lato server." },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Autenticazione non configurata." }, { status: 503 });
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) return NextResponse.json({ error: "Accedi di nuovo per continuare." }, { status: 401 });

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) return NextResponse.json({ error: "Non è stato possibile cancellare l’account." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
