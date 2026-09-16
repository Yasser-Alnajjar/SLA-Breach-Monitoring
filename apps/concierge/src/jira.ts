// Deep imports for the same reason as ./zendesk.ts: no Prisma client.
import {
  deriveNormalizedEventsForIssue,
  normalizeJiraStatusCategory,
  type ChangelogRecord,
  type DerivedNormalizedEvent,
} from "@sla/jira/src/normalize";
import type { JiraIssue } from "@sla/jira/src/types";
import type { NormalizedState } from "@sla/core";
import { DropCounter, requireColumns, type CsvTable } from "./csv";
import { parseTimestamp } from "./time";

export const ISSUE_COLUMNS = {
  key: ["issue key", "key", "issue"],
  createdAt: ["created", "created at", "created date"],
  status: ["status"],
  statusCategory: ["status category"],
  summary: ["summary", "title"],
  reporter: ["reporter id", "reporter account id", "reporter"],
  /** Written by Zendesk's Jira integration: ticket ids, or ticket URLs. */
  zendeskTickets: [
    "zendesk ticket ids",
    "zendesk ticket id",
    "zendesk tickets",
    "zendesk ticket",
    "zendesk ticket urls",
    "zendesk ticket url",
    "zendesk",
  ],
  /** Generic link columns: only full Zendesk ticket URLs count here, never bare numbers. */
  links: ["remote link", "remote links", "links", "link", "web link", "web links"],
} as const;

export const CHANGELOG_COLUMNS = {
  key: ["issue key", "key", "issue"],
  createdAt: ["created", "created at", "date", "changed", "changed at", "timestamp", "history created"],
  field: ["field", "field name"],
  from: ["from status", "fromstring", "from string", "from", "old value"],
  to: ["to status", "tostring", "to string", "to", "new value"],
  fromCategory: ["from status category", "from category"],
  toCategory: ["to status category", "to category"],
  author: ["author account id", "author id", "author"],
} as const;

export type JiraCategory = "new" | "indeterminate" | "done";

const CATEGORY_ALIASES: Record<string, JiraCategory> = {
  new: "new",
  todo: "new",
  "to do": "new",
  indeterminate: "indeterminate",
  "in progress": "indeterminate",
  inprogress: "indeterminate",
  done: "done",
  complete: "done",
};

export function parseJiraCategory(value: string | undefined): JiraCategory | null {
  if (!value) return null;
  return CATEGORY_ALIASES[value.trim().toLowerCase()] ?? null;
}

/**
 * Jira's stock workflow names only. A changelog row names a status, not its
 * category, and custom workflows can put any name in any category, so these
 * apply only when neither `--jira-status` nor the export itself says
 * otherwise, and every status mapped this way is listed in the report.
 */
const STOCK_STATUS_CATEGORIES: Record<string, JiraCategory> = {
  "to do": "new",
  open: "new",
  backlog: "new",
  "selected for development": "new",
  "in progress": "indeterminate",
  "in review": "indeterminate",
  done: "done",
  closed: "done",
  resolved: "done",
};

export type StatusCategorySource = "flag" | "export" | "stock default";

export interface JiraIssueRecord {
  issue: JiraIssue;
  /** Every raw value from Zendesk-specific columns. */
  zendeskValues: string[];
  /** Every raw value from generic link columns. */
  linkValues: string[];
  events: DerivedNormalizedEvent[];
}

export interface JiraParseResult {
  issues: Map<string, JiraIssueRecord>;
  statusCategories: Map<string, { name: string; category: JiraCategory; source: StatusCategorySource }>;
  unknownStatuses: Map<string, number>;
  issueDrops: DropCounter;
  changelogDrops: DropCounter;
  changelogRowsUsed: number;
  /** Issues evaluated from their current status alone: their engineering time can't be measured. */
  issuesWithoutChangelog: string[];
}

/** `"Waiting for Support=indeterminate, Won't Do=done"` → overrides keyed by lowercased name. */
export function parseStatusOverrides(spec: string | undefined): Map<string, { name: string; category: JiraCategory }> {
  const overrides = new Map<string, { name: string; category: JiraCategory }>();
  if (!spec) return overrides;
  for (const part of spec.split(/[,;]/).map((p) => p.trim()).filter(Boolean)) {
    const eq = part.lastIndexOf("=");
    const name = eq > 0 ? part.slice(0, eq).trim() : "";
    const category = parseJiraCategory(eq > 0 ? part.slice(eq + 1) : undefined);
    if (!name || !category) {
      throw new Error(`Can't read --jira-status "${part}". Expected "Status name=new|indeterminate|done".`);
    }
    overrides.set(name.toLowerCase(), { name, category });
  }
  return overrides;
}

/**
 * Issues CSV (one row per issue) plus changelog CSV (one row per status
 * transition) → `JiraIssue`/`JiraChangelogHistory` shapes, then through the
 * product's own `deriveNormalizedEventsForIssue`. The API supplies status
 * ids and a site-wide status list; a CSV has only names, so each name is
 * its own "id" and its category comes from flags, export columns, or Jira's
 * stock workflow, in that order. A row whose status resolves through none of
 * them is dropped and the name reported.
 */
export function parseJiraExport(
  issuesTable: CsvTable,
  changelogTable: CsvTable,
  timeZone: string,
  statusOverrides: Map<string, { name: string; category: JiraCategory }> = new Map(),
): JiraParseResult {
  const ic = requireColumns("jira issues", issuesTable, {
    "issue key": ISSUE_COLUMNS.key,
    created: ISSUE_COLUMNS.createdAt,
    status: ISSUE_COLUMNS.status,
  });
  const cc = requireColumns("jira changelog", changelogTable, {
    "issue key": CHANGELOG_COLUMNS.key,
    created: CHANGELOG_COLUMNS.createdAt,
    "from status": CHANGELOG_COLUMNS.from,
    "to status": CHANGELOG_COLUMNS.to,
  });

  const fromExport = new Map<string, { name: string; category: JiraCategory }>();
  const noteExportCategory = (name: string | undefined, category: string | undefined) => {
    const parsed = parseJiraCategory(category);
    if (name && parsed && !fromExport.has(name.toLowerCase())) {
      fromExport.set(name.toLowerCase(), { name, category: parsed });
    }
  };
  for (const row of issuesTable.rows) {
    noteExportCategory(ic.get(row, ISSUE_COLUMNS.status), ic.get(row, ISSUE_COLUMNS.statusCategory));
  }
  for (const row of changelogTable.rows) {
    noteExportCategory(cc.get(row, CHANGELOG_COLUMNS.from), cc.get(row, CHANGELOG_COLUMNS.fromCategory));
    noteExportCategory(cc.get(row, CHANGELOG_COLUMNS.to), cc.get(row, CHANGELOG_COLUMNS.toCategory));
  }

  const statusCategories: JiraParseResult["statusCategories"] = new Map();
  const unknownStatuses = new Map<string, number>();
  const resolveStatus = (name: string | undefined): string | null => {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    if (statusCategories.has(key)) return key;
    const override = statusOverrides.get(key);
    const exported = fromExport.get(key);
    const stock = STOCK_STATUS_CATEGORIES[key];
    if (override) statusCategories.set(key, { ...override, source: "flag" });
    else if (exported) statusCategories.set(key, { ...exported, source: "export" });
    else if (stock) statusCategories.set(key, { name: name.trim(), category: stock, source: "stock default" });
    else {
      unknownStatuses.set(name.trim(), (unknownStatuses.get(name.trim()) ?? 0) + 1);
      return null;
    }
    return key;
  };

  const issueDrops = new DropCounter();
  const changelogDrops = new DropCounter();
  const parsed = new Map<string, Omit<JiraIssueRecord, "events">>();

  for (const row of issuesTable.rows) {
    const key = ic.get(row, ISSUE_COLUMNS.key)?.toUpperCase();
    if (!key || !/^[A-Z][A-Z0-9_]+-\d+$/.test(key)) {
      issueDrops.add("missing or malformed issue key");
      continue;
    }
    if (parsed.has(key)) {
      issueDrops.add("duplicate issue key (first row kept)");
      continue;
    }
    const created = parseTimestamp(ic.get(row, ISSUE_COLUMNS.createdAt) ?? "", timeZone);
    if (!created) {
      issueDrops.add("unreadable created date");
      continue;
    }
    const statusName = ic.get(row, ISSUE_COLUMNS.status) ?? "";
    const reporter = ic.get(row, ISSUE_COLUMNS.reporter);
    parsed.set(key, {
      issue: {
        id: key,
        key,
        self: "",
        fields: {
          summary: ic.get(row, ISSUE_COLUMNS.summary) ?? "",
          // Resolved lazily below: only needed when the issue has no changelog.
          status: { id: statusName.trim().toLowerCase(), name: statusName },
          priority: null,
          project: { id: key.split("-")[0]!, key: key.split("-")[0]!, name: key.split("-")[0]! },
          created,
          updated: created,
          reporter: reporter ? { accountId: reporter } : null,
          assignee: null,
        },
      },
      zendeskValues: ic.getAll(row, ISSUE_COLUMNS.zendeskTickets),
      linkValues: ic.getAll(row, ISSUE_COLUMNS.links),
    });
  }

  const historiesByKey = new Map<string, ChangelogRecord[]>();
  let changelogRowsUsed = 0;
  changelogTable.rows.forEach((row, index) => {
    const field = cc.get(row, CHANGELOG_COLUMNS.field);
    if (field && field.toLowerCase() !== "status") {
      changelogDrops.add("not a status change (ignored)");
      return;
    }
    const key = cc.get(row, CHANGELOG_COLUMNS.key)?.toUpperCase();
    if (!key || !parsed.has(key)) {
      changelogDrops.add(key ? "issue not in issues export" : "missing issue key");
      return;
    }
    const created = parseTimestamp(cc.get(row, CHANGELOG_COLUMNS.createdAt) ?? "", timeZone);
    if (!created) {
      changelogDrops.add("unreadable change date");
      return;
    }
    const from = resolveStatus(cc.get(row, CHANGELOG_COLUMNS.from));
    const to = resolveStatus(cc.get(row, CHANGELOG_COLUMNS.to));
    if (!from || !to) {
      changelogDrops.add("status with unknown category");
      return;
    }
    const author = cc.get(row, CHANGELOG_COLUMNS.author);
    const record: ChangelogRecord = {
      rawEventId: `jira-changelog-row:${index + 2}`,
      history: {
        // Numeric so the normalizer's id tie-break follows file order.
        id: String(index + 1),
        author: author ? { accountId: author } : null,
        created,
        items: [{ field: "status", fieldtype: "jira", from, fromString: null, to, toString: null }],
      },
    };
    const group = historiesByKey.get(key);
    if (group) group.push(record);
    else historiesByKey.set(key, [record]);
    changelogRowsUsed += 1;
  });

  const withoutChangelog = new Set<string>();
  for (const [key, entry] of parsed) {
    if (historiesByKey.has(key)) continue;
    if (resolveStatus(entry.issue.fields.status.name)) withoutChangelog.add(key);
    else issueDrops.add("status with unknown category and no changelog");
  }

  const statusById = new Map<string, NormalizedState>();
  for (const [id, { category }] of statusCategories) statusById.set(id, normalizeJiraStatusCategory(category));

  const issues = new Map<string, JiraIssueRecord>();
  for (const [key, entry] of parsed) {
    const histories = historiesByKey.get(key);
    if (!histories && !withoutChangelog.has(key)) continue;
    const events = deriveNormalizedEventsForIssue(entry.issue, histories ?? [], `jira-issue:${key}`, statusById);
    issues.set(key, { ...entry, events });
  }

  return {
    issues,
    statusCategories,
    unknownStatuses,
    issueDrops,
    changelogDrops,
    changelogRowsUsed,
    issuesWithoutChangelog: [...withoutChangelog],
  };
}
