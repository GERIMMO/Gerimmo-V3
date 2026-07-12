"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type AuthContextValue = {
  supabase: SupabaseClient<Database> | null;
  user: User | null;
  isLoading: boolean;
  error: Error | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    try {
      const client = createClient();
      setSupabase(client);

      client.auth
        .getUser()
        .then(({ data, error: authError }) => {
          if (!isMounted) {
            return;
          }

          if (authError) {
            setError(authError);
          }

          setUser(data.user);
          setIsLoading(false);
        })
        .catch((authError: Error) => {
          if (!isMounted) {
            return;
          }

          setError(authError);
          setIsLoading(false);
        });

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        if (isMounted) {
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } catch (setupError) {
      if (isMounted) {
        setError(setupError instanceof Error ? setupError : new Error("Unable to initialize Supabase auth."));
        setIsLoading(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      supabase,
      user,
      isLoading,
      error,
    }),
    [error, isLoading, supabase, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used inside AuthProvider.");
  }

  return context;
}
