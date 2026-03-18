import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { User, UserRole, AuthContextValue } from "../types";
import { MOCK_USERS, MOCK_CREDENTIALS } from "../data/mockData";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 600));

      const credentials = MOCK_CREDENTIALS[email.toLowerCase().trim()];
      if (!credentials || credentials.password !== password) {
        setIsLoading(false);
        return false;
      }

      const foundUser = MOCK_USERS.find((u) => u.id === credentials.userId);
      if (!foundUser) {
        setIsLoading(false);
        return false;
      }

      setUser(foundUser);
      setIsLoading(false);
      return true;
    },
    []
  );

  const loginAs = useCallback((role: UserRole) => {
    const roleMap: Record<UserRole, string> = {
      admin: "user-admin-1",
      office: "user-office-1",
      mentor: "user-mentor-1",
      mentee: "user-mentee-1",
    };
    const foundUser = MOCK_USERS.find((u) => u.id === roleMap[role]);
    if (foundUser) {
      setUser(foundUser);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginAs, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth muss innerhalb eines AuthProviders verwendet werden");
  }
  return context;
}
