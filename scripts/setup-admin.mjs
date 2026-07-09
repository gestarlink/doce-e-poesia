import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hhaiugyjlppafzfoalwx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoYWl1Z3lqbHBwYWZ6Zm9hbHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDM3NDAsImV4cCI6MjA4OTcxOTc0MH0.6uon11Pnq5EF-45YmOWD7sRn5L0UQbka5112trY1N3A";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const email = "admin@docepoesia.com";
const password = "DocePoesia@2026!";

async function setup() {
  console.log(`=== Setup Admin - Doce & Poesia ===\n`);

  // 1. Check if user already exists by trying to sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInData?.user) {
    console.log(`✓ Usuário já existe: ${signInData.user.email}`);
  } else {
    console.log(`Criando usuário ${email}...`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome: "Admin Doce & Poesia" } },
    });

    if (signUpError) {
      console.error(`✗ Erro ao criar usuário: ${signUpError.message}`);
      return;
    }
    console.log(`✓ Usuário criado: ${signUpData.user?.email}`);
    console.log(`ℹ Verifique o email de confirmação: ${email}`);
  }

  // Try to get a fresh session
  const { data: { session } } = await supabase.auth.signInWithPassword({ email, password });
  
  if (!session) {
    console.log(`\n✗ Não foi possível obter sessão. O email pode precisar de confirmação.`);
    console.log(`\nPróximo passo: Acesse o Supabase Dashboard e rode o SQL abaixo:`);
    printSql(email);
    return;
  }

  console.log(`\n✓ Sessão obtida! Tentando promover a admin...\n`);

  // 2. Try to update profile via API (will probably be blocked by RLS)
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ tipo: "admin" })
    .eq("user_id", session.user.id);

  if (updateError) {
    console.log(`✗ RLS bloqueou a promoção: ${updateError.message}`);
    console.log(`\nIsso é esperado - a segurança do banco impede alteração de tipo pelo app.`);
    console.log(`\nPara liberar seu acesso como admin, siga o passo abaixo:\n`);
    printSql(email);
  } else {
    console.log(`✓ Usuário promovido a admin com sucesso!`);
    console.log(`\nAcesse http://localhost:3000/admin e faça login com:`);
    console.log(`  Email: ${email}`);
    console.log(`  Senha: ${password}`);
  }
}

function printSql(email) {
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`  1. Acesse: https://supabase.com/dashboard/project/hhaiugyjlppafzfoalwx`);
  console.log(`  2. Vá em "SQL Editor"`);
  console.log(`  3. Execute: `);
  console.log(`───────────────────────────────────────────────────────`);
  console.log(`  UPDATE public.profiles`);
  console.log(`  SET tipo = 'admin'`);
  console.log(`  WHERE email = '${email}';`);
  console.log(`───────────────────────────────────────────────────────`);
  console.log(`  4. Acesse http://localhost:3000/auth`);
  console.log(`     Email: ${email}`);
  console.log(`     Senha: ${password}`);
  console.log(`═══════════════════════════════════════════════════════`);
}

setup().catch(console.error);
