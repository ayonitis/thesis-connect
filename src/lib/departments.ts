export const DEPARTMENTS = [
  { value: "CSE", label: "CSE" },
  { value: "CS", label: "CS" },
  { value: "EEE", label: "EEE" },
  { value: "ESS", label: "ESS" },
  { value: "ARCH", label: "ARCH (Architecture)" },
  { value: "PHARMACY", label: "PHARMACY" },
  { value: "BBS", label: "BBS" },
] as const;

export type DepartmentValue = (typeof DEPARTMENTS)[number]["value"];
