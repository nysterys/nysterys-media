import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Track when we're in password-reset mode so we don't redirect to the app
  const inPasswordReset = useRef(false);

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, creator_name, avatar_url')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.warn('Profile fetch failed, signing out:', error?.message);
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } else {
      setProfile(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    // Check if we landed via a recovery link — if so, don't auto-load the app
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      inPasswordReset.current = true;
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (inPasswordReset.current) return; // wait for user to set password
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'PASSWORD_RECOVERY') {
          inPasswordReset.current = true;
          setLoading(false);
          return;
        }

        // After password is updated and we sign out, clear the reset flag
        if (event === 'SIGNED_OUT') {
          inPasswordReset.current = false;
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // If we're mid-reset and get a SIGNED_IN (from setSession),
        // don't load the app — LoginPage is handling it
        if (inPasswordReset.current && event === 'SIGNED_IN') {
          return;
        }

        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return { error };
  }

  async function signOut() {
    setProfile(null);
    setUser(null);
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signOut, fetchProfile,
      isAdmin: profile?.role === 'admin',
      isCreator: profile?.role === 'creator',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
