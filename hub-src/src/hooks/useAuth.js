import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isHandlingPasswordReset } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // If LoginPage is handling a recovery token, ignore auth events
        // until the user has set their new password and signed out
        if (isHandlingPasswordReset) {
          setLoading(false);
          return;
        }

        if (event === 'PASSWORD_RECOVERY') {
          setLoading(false);
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
