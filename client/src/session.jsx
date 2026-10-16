import { createContext, useContext, useEffect, useState } from 'react';
import { api, setSession, clearSession, getUser, getToken } from './api.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(() => getUser());
  const [token, setTok] = useState(() => getToken());

  // api.js broadcasts `kai:unauthorized` when the server rejects a token
  // (expired / revoked). Drop the local session so guards redirect to /login.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setTok(null);
    };
    window.addEventListener('kai:unauthorized', onUnauthorized);
    return () => window.removeEventListener('kai:unauthorized', onUnauthorized);
  }, []);

  async function login(voen, password) {
    const data = await api.login(voen, password);
    setSession(data.token, data.user);
    setUser(data.user);
    setTok(data.token);
    return data.user;
  }

  // "mygov ID" sign-in (simulated). The server verifies the FİN and returns a
  // normal session token, exactly like a real password login would.
  async function loginWithMyGov(fin) {
    const data = await api.mygovLogin(fin);
    setSession(data.token, data.user);
    setUser(data.user);
    setTok(data.token);
    return data.user;
  }

  // Registers a new account. All self-service accounts are `pending` until an
  // operator approves them, so no session is started here.
  async function register(payload) {
    const res = await api.register(payload);
    return res;
  }

  function logout() {
    clearSession();
    setUser(null);
    setTok(null);
  }

  return (
    <SessionContext.Provider value={{ user, token, login, loginWithMyGov, register, logout, isAuthed: !!token }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
