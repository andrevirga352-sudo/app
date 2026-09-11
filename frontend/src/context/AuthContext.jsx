import { createContext, useContext, useEffect, useState } from "react";
import api, { apiError } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=anon, obj=auth

  useEffect(() => {
    let active = true;
    api.get("/auth/me")
      .then((r) => active && setUser(r.data))
      .catch(() => active && setUser((prev) => (prev ? prev : false)));
    return () => { active = false; };
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data);
    return data;
  };
  const register = async (email, password, name) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    setUser(data);
    return data;
  };
  const logout = async () => {
    await api.post("/auth/logout");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { apiError };
