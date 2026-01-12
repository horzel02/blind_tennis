// client/src/contexts/AuthContext.jsx
import { createContext, useState, useEffect, useContext, useRef } from "react";
import * as authService from "../services/authService";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import { socketOrigin } from "../services/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const profile = await authService.fetchProfile();
        setUser(profile);
      } catch (err) {
        if (err?.status === 401) setUser(null);
        else console.error("Błąd podczas ładowania profilu:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch {}
        socketRef.current = null;
      }
      return;
    }

    // jeśli ORIGIN puste => socket bierze window.location (ten sam origin)
    const s = io(socketOrigin(), { withCredentials: true });
    socketRef.current = s;

    const onForceLogout = () => {
      try {
        s.disconnect();
      } catch {}
      toast.error("Twoje konto zostało wylogowane przez administratora.");
      setUser(null);
      window.location.replace("/login");
    };

    s.on("force-logout", onForceLogout);

    return () => {
      s.off("force-logout", onForceLogout);
      try {
        s.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, [user?.id]);

  const login = async (creds) => {
    const u = await authService.login(creds);
    setUser(u);
    return u;
  };

  const register = async (creds) => {
    await authService.register(creds);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    try {
      socketRef.current?.disconnect();
    } catch {}
    socketRef.current = null;
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    await authService.changePassword({ currentPassword, newPassword });
    toast.success("Hasło zostało zmienione.");
  };

  const updatePreferences = async ({ preferredCategory }) => {
    const updated = await authService.updatePreferences({ preferredCategory });
    setUser((prev) => (prev ? { ...prev, preferredCategory: updated.preferredCategory } : prev));
    toast.success("Zapisano preferencje.");
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, changePassword, updatePreferences }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
