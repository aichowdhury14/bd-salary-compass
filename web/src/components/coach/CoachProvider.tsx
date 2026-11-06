"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Assessment } from "@/lib/recommend";

export interface CoachProfile {
  role: string;
  level: string;
  employer: string;
  city: string;
  years: number;
  monthlyGross: number;
  skills: string[];
}

/** The visitor's Salary check results, shared with the chat so it can give personal advice on any page. */
export interface SalaryContext {
  profile: CoachProfile;
  assessment: Assessment;
}

interface CoachState {
  salary: SalaryContext | null;
  setSalary: (s: SalaryContext | null) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const Ctx = createContext<CoachState>({ salary: null, setSalary: () => {}, open: false, setOpen: () => {} });

export function CoachProvider({ children }: { children: ReactNode }) {
  const [salary, setSalary] = useState<SalaryContext | null>(null);
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ salary, setSalary, open, setOpen }), [salary, open]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCoach = () => useContext(Ctx);

/**
 * Share the Salary check results with the chat. `key` should change only when the results do,
 * because the profile object itself is rebuilt on every render. The results stay in memory after
 * the visitor moves to another page (so "how much tax on my salary?" works on the tax page) and
 * are gone on reload; nothing is saved.
 */
export function useShareSalary(ctx: SalaryContext | null, key: string) {
  const { setSalary } = useCoach();
  useEffect(() => {
    if (ctx) setSalary(ctx);
  }, [key, setSalary]); // not ctx: it is rebuilt every render, and key tracks its content
}
