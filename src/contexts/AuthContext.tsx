import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string;
  tipo: "admin" | "cliente" | "entregador";
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isDevAdmin: boolean;
  isEntregador: boolean;
  isDevEntregador: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
      return;
    }
    setProfile(data as Profile | null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Use setTimeout to avoid Supabase auth deadlock
        setTimeout(() => fetchProfile(session.user.id), 100);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const userEmail = user?.email?.toLowerCase() || "";
  const devAdminEmails = import.meta.env.VITE_DEV_ADMIN_EMAILS?.split(",").map(e => e.trim().toLowerCase()) || [];
  const devEntregadorEmails = import.meta.env.VITE_DEV_ENTREGADOR_EMAILS?.split(",").map(e => e.trim().toLowerCase()) || [];
  const isDevAdmin = user ? devAdminEmails.includes(userEmail) : false;
  const isDevEntregador = user ? devEntregadorEmails.includes(userEmail) || isDevAdmin : false;
  const isAdmin = profile?.tipo === "admin" || isDevAdmin;
  const isEntregador = profile?.tipo === "entregador" || isDevEntregador;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isDevAdmin, isEntregador, isDevEntregador, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
