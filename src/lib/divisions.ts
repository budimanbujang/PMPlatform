// =============================================================================
// JCorp HoldCo divisions + their departments.
// Sourced from the canonical staff directory; deduplicated and typo-
// normalised (e.g. "BUISNESS" → "BUSINESS", "TRANSFORMANTION" → "TRANSFORMATION").
// Used to populate the division/department selectors when creating a
// portfolio (or anywhere else we need the canonical list).
// =============================================================================

export interface Division {
  name: string;
  departments: string[];
}

export const DIVISIONS: Division[] = [
  {
    name: "CORPORATE SERVICES DIVISION",
    departments: [
      "OFFICE OF CHIEF CORPORATE SERVICES OFFICER",
      "GROUP COMPANY SECRETARIAL DEPARTMENT",
      "GROUP LEGAL DEPARTMENT",
      "ADMINISTRATION DEPARTMENT",
      "BUSINESS ADMINISTRATION DEPARTMENT",
    ],
  },
  {
    name: "DIGITAL DIVISION",
    departments: [
      "OFFICE OF CHIEF DIGITAL OFFICER",
      "ENTERPRISE ARCHITECTURE & DIGITAL GOVERNANCE",
      "AI OFFICE",
    ],
  },
  {
    name: "GROUP FINANCE DIVISION",
    departments: [
      "OFFICE OF CHIEF FINANCIAL OFFICER",
      "CORPORATE FINANCE & TREASURY DEPARTMENT",
      "FINANCIAL MANAGEMENT & REPORTING DEPARTMENT",
      "FINANCE OPERATIONS DEPARTMENT",
      "TAX DEPARTMENT",
      "GROUP SUPPLY CHAIN DEPARTMENT",
    ],
  },
  {
    name: "GROUP GOVERNANCE & RISK DIVISION",
    departments: [
      "OFFICE OF CHIEF GOVERNANCE OFFICER",
      "GOVERNANCE & RISK DEPARTMENT",
      "INTERNAL AUDIT DEPARTMENT",
      "GROUP INTEGRITY UNIT",
    ],
  },
  {
    name: "INFRASTRUCTURE TECHNOLOGY DIVISION",
    departments: [],
  },
  {
    name: "JOHOR CORPORATION CHAIRMAN OFFICE",
    departments: [
      "JOHOR CORPORATION CHAIRMAN OFFICE",
    ],
  },
  {
    name: "OFFICE OF THE PRESIDENT AND CHIEF EXECUTIVE",
    departments: [
      "OFFICE OF THE PRESIDENT AND CHIEF EXECUTIVE",
      "GROUP CORPORATE COMMUNICATIONS DEPARTMENT",
      "SUSTAINABILITY DEPARTMENT",
      "STAKEHOLDERS MANAGEMENT & SPECIAL PROJECTS",
      "PEGAWAI KERAJAAN / STAKEHOLDERS MANAGEMENT & SPECIAL PROJECTS",
      "KOPERASI KUMPULAN JCORP BHD",
    ],
  },
  {
    name: "REAL ESTATE & INFRASTRUCTURE DIVISION",
    departments: [
      "LAND MANAGEMENT & SERVICES DEPARTMENT",
    ],
  },
  {
    name: "STRATEGY & INVESTMENT DIVISION",
    departments: [
      "OFFICE OF CHIEF INVESTMENT OFFICER",
      "STRATEGY & BUSINESS PLANNING DEPARTMENT",
      "INVESTMENT MANAGEMENT DEPARTMENT",
      "PORTFOLIO MANAGEMENT DEPARTMENT",
      "PORTFOLIO MANAGEMENT & MONITORING",
      "VENTURE BUILDER DEPARTMENT",
      "CORPORATE ADVISORY UNIT",
    ],
  },
  {
    name: "TALENT DIVISION",
    departments: [
      "OFFICE OF CHIEF TALENT OFFICER",
      "TALENT DEVELOPMENT",
      "TALENT MANAGEMENT",
      "TALENT OPERATIONS & TECHNOLOGY",
      "TALENT INTELLIGENCE, GOVERNANCE & SATISFACTION",
      "TRANSFORMATION, INNOVATION & ECOSYSTEM",
    ],
  },
];

export const DIVISION_NAMES: string[] = DIVISIONS.map((d) => d.name);

/** Departments for a given division name; empty array if unknown. */
export function departmentsFor(divisionName: string): string[] {
  return DIVISIONS.find((d) => d.name === divisionName)?.departments ?? [];
}
