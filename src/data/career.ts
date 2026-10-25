export interface Role {
    title: string;
    org: string;
    orgUrl?: string;
    start: string;
    end?: string;
}

export const ROLES: Role[] = [
    { title: "Senior Product Manager", org: "Octane11", orgUrl: "https://octane11.com", start: "2025-09" },
    { title: "Product Manager", org: "Octane11", orgUrl: "https://octane11.com", start: "2022-05", end: "2025-09" },
    { title: "Product Operations", org: "Octane11", orgUrl: "https://octane11.com", start: "2021-08", end: "2022-05" },
    { title: "Marketing Segmentation & Business Analyst", org: "Financial Center First Credit Union", start: "2019-08", end: "2021-08" },
    { title: "Program Manager", org: "Loyalty Research Center", start: "2018-06", end: "2019-08" },
];

export const EDUCATION = {
    school: "Ball State University",
    schoolUrl: "https://www.bsu.edu",
    college: "Miller College of Business",
    degree: "Bachelor of Science (B.S.), Marketing",
};

export const SKILLS: string[] = [
    "AI product management",
    "AI agents",
    "Agentic workflows",
    "Model Context Protocol (MCP)",
    "Conversational AI",
    "LLM products",
    "B2B data products",
    "B2B marketing analytics",
    "Data architecture",
    "Data pipelines",
    "API integrations",
    "SQL",
    "Google BigQuery",
    "Python",
    "Tableau",
    "Looker Studio",
    "Figma",
    "AI prototyping",
    "Agile product management",
    "Market research",
];
