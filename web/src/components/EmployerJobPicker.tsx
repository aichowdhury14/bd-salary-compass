"use client";

import { bench, functionsFor, jobFunction } from "@/lib/benchmark";
import { controlClass, Field } from "./ui";

export const GOVT = "government";

/** Value format: "<groupId>|<company name or empty>", or "government". */
export function parseEmployer(value: string): { groupId: string; company?: string } {
  if (value === GOVT) return { groupId: GOVT };
  const [groupId, company] = value.split("|");
  return { groupId, company: company || undefined };
}

export function EmployerSelect({ value, onChange, allowGovt = true }: { value: string; onChange: (v: string) => void; allowGovt?: boolean }) {
  return (
    <Field label="Where do you work?" hint="Pick your company, or the closest kind of employer">
      {(id) => (
        <select id={id} className={controlClass} value={value} onChange={(e) => onChange(e.target.value)}>
          {bench.groups.map((g) => (
            <optgroup key={g.id} label={g.label}>
              {g.companies
                .filter((c) => !/^(Local|Other|Export|IT-|Tech|Shops|Engineering,|Pharma &|International buying)/.test(c))
                .map((c) => (
                  <option key={c} value={`${g.id}|${c}`}>
                    {c}
                  </option>
                ))}
              <option value={`${g.id}|`}>Other: {g.label.toLowerCase()}</option>
            </optgroup>
          ))}
          {allowGovt && (
            <optgroup label="Government">
              <option value={GOVT}>Government job (National Pay Scale)</option>
            </optgroup>
          )}
        </select>
      )}
    </Field>
  );
}

export function FunctionSelect({ groupId, value, onChange }: { groupId: string; value: string; onChange: (v: string) => void }) {
  const ids = functionsFor(groupId);
  return (
    <Field label="What's your job?" hint={bench.functions[value]?.about}>
      {(id) => (
        <select id={id} className={controlClass} value={value} onChange={(e) => onChange(e.target.value)}>
          {ids.map((f) => (
            <option key={f} value={f}>
              {jobFunction(f).title}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
