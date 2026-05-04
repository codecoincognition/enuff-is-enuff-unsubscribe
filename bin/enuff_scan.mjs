#!/usr/bin/env node
// Local scanner for enuff-is-enuff-unsubscribe.
// Node.js stdlib only. Parses exported mail (mbox / .eml folder) and emits a
// read-only HTML report plus JSON state for the review/act workflow.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = 'enuff-is-enuff-report';

const EMAIL_RE = /[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+/;

const PROMO_WORDS = new Set([
  'sale', 'deal', 'discount', 'off', 'coupon', 'promo', 'offer', 'limited',
  'save', 'clearance', 'exclusive', 'newsletter', 'digest', 'weekly',
]);
const SECURITY_WORDS = new Set([
  'password', 'login', 'sign-in', 'signin', 'verification', 'security',
  '2fa', 'code', 'alert',
]);
const RECEIPT_WORDS = new Set([
  'receipt', 'invoice', 'order', 'shipped', 'delivered', 'refund',
  'return', 'payment', 'billing', 'statement',
]);
const HIGH_RISK_DOMAINS = new Set([
  'bank', 'chase', 'wellsfargo', 'citi', 'capitalone', 'americanexpress',
  'amex', 'irs', 'ssa', 'medicare', 'health', 'insurance', 'payroll',
]);
const SAAS_LIFECYCLE_WORDS = new Set([
  'trial', 'onboarding', 'welcome', 'getting started',
]);
const SOCIAL_WORDS = new Set([
  'notification', 'commented', 'mentioned', 'follower',
]);

// ---------- helpers ----------

function localIsoSeconds(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

function normalizeDomain(emailAddress) {
  if (!emailAddress.includes('@')) return 'unknown';
  const domain = emailAddress.split('@', 2)[1].toLowerCase().trim();
  const parts = domain.split('.');
  if (parts.length > 2 && ['co', 'com', 'net', 'org'].includes(parts[parts.length - 2])) {
    return parts.slice(-3).join('.');
  }
  if (parts.length > 2) return parts.slice(-2).join('.');
  return domain;
}

function companyFromDomain(domain) {
  const base = domain ? domain.split('.')[0] : 'unknown';
  // Replace runs of - or _ with a single space, then title-case each word.
  const cleaned = base.replace(/[-_]+/g, ' ');
  return cleaned.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function parseDateHeader(value) {
  if (!value) return ['', ''];
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return ['', ''];
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const ym = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  return [iso, ym];
}

function inLast60Days(dateValue, now) {
  if (!dateValue) return false;
  const ms = Date.parse(dateValue);
  if (Number.isNaN(ms)) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff = new Date(today.getTime() - 60 * 86400000);
  const messageDate = new Date(ms);
  const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
  return messageDay >= cutoff;
}

function inferUnread(headers) {
  const labels = ['X-Gmail-Labels', 'X-GM-LABELS', 'Status', 'X-Status']
    .map((name) => headers[name.toLowerCase()] ?? '')
    .join(' ')
    .toLowerCase();
  if (labels.includes('unread')) return true;
  if (labels.includes('\\seen') || labels.includes('ro') || labels.includes('read')) return false;
  return null;
}

// Parse an RFC 5322 address list. Returns array of {name, addr}.
function parseAddressList(raw) {
  if (!raw) return [];
  const results = [];
  // Tokenize, respecting double-quoted strings and angle brackets.
  let depth = 0;
  let inQuote = false;
  let buf = '';
  const parts = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"' && raw[i - 1] !== '\\') inQuote = !inQuote;
    else if (!inQuote && ch === '<') depth++;
    else if (!inQuote && ch === '>') depth = Math.max(0, depth - 1);
    if (!inQuote && depth === 0 && ch === ',') {
      parts.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const angle = trimmed.match(/^(.*)<([^>]+)>\s*$/);
    if (angle) {
      let name = angle[1].trim();
      if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
      const addr = angle[2].trim();
      results.push({ name, addr });
      continue;
    }
    const bare = trimmed.match(EMAIL_RE);
    if (bare) results.push({ name: '', addr: bare[0] });
  }
  return results;
}

function firstSender(headers) {
  const raw = headers['from'] ?? '';
  for (const { name, addr } of parseAddressList(raw)) {
    if (addr && EMAIL_RE.test(addr)) {
      const lower = addr.toLowerCase();
      return [name || lower.split('@')[0], lower];
    }
  }
  const m = raw.match(EMAIL_RE);
  if (m) {
    const addr = m[0].toLowerCase();
    return [addr.split('@')[0], addr];
  }
  return ['Unknown', 'unknown@unknown'];
}

function messageMeta(headers) {
  const [senderName, senderEmail] = firstSender(headers);
  const domain = normalizeDomain(senderEmail);
  const [date, yearMonth] = parseDateHeader(headers['date']);
  const subject = String(headers['subject'] ?? '').replaceAll('\n', ' ').trim();
  return {
    sender_name: senderName,
    sender_email: senderEmail,
    domain,
    subject,
    date,
    year_month: yearMonth,
    unread: inferUnread(headers),
    list_unsubscribe: String(headers['list-unsubscribe'] ?? '').trim(),
    list_id: String(headers['list-id'] ?? '').trim(),
  };
}

// ---------- header parsing ----------

// Parse a header block into a lowercase-keyed object. Handles RFC 5322
// continuation lines (lines starting with whitespace fold into the previous header).
function parseHeaders(block) {
  const headers = {};
  const lines = block.split(/\r?\n/);
  let currentName = null;
  let currentValue = '';
  const flush = () => {
    if (currentName !== null) {
      const key = currentName.toLowerCase();
      // If header repeats (e.g. multiple Received), keep the first — matches
      // the Python email parser's `msg.get(name)` which returns the first.
      if (!(key in headers)) headers[key] = currentValue.trim();
    }
    currentName = null;
    currentValue = '';
  };
  for (const line of lines) {
    if (line === '') break;
    if (/^[ \t]/.test(line) && currentName !== null) {
      currentValue += ' ' + line.trim();
      continue;
    }
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    flush();
    currentName = line.slice(0, colon);
    currentValue = line.slice(colon + 1).trim();
  }
  flush();
  return headers;
}

// ---------- iterate messages ----------

async function* iterEmlFolder(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true, recursive: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.eml'))
    .map((e) => path.join(e.parentPath ?? e.path ?? dir, e.name))
    .sort();
  for (const file of files) {
    try {
      const raw = await fsp.readFile(file, 'utf8');
      // Header block ends at first blank line.
      const blank = raw.search(/\r?\n\r?\n/);
      const headerBlock = blank === -1 ? raw : raw.slice(0, blank);
      yield messageMeta(parseHeaders(headerBlock));
    } catch (exc) {
      process.stderr.write(`Skipping ${file}: ${exc.message}\n`);
    }
  }
}

async function* iterMbox(file) {
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let inHeaders = false;
  let headerLines = [];
  let started = false;
  for await (const line of rl) {
    if (/^From /.test(line)) {
      // mbox separator. Flush previous message headers.
      if (started && headerLines.length) {
        yield messageMeta(parseHeaders(headerLines.join('\n')));
      }
      started = true;
      inHeaders = true;
      headerLines = [];
      continue;
    }
    if (!started) {
      // File doesn't start with `From ` — treat the whole file as a single
      // message (some exports omit the leading separator).
      started = true;
      inHeaders = true;
      headerLines = [];
    }
    if (inHeaders) {
      if (line === '') {
        inHeaders = false;
        continue;
      }
      headerLines.push(line);
    }
    // Body lines are ignored.
  }
  if (headerLines.length) {
    yield messageMeta(parseHeaders(headerLines.join('\n')));
  }
}

async function* iterMessages(source) {
  const stat = await fsp.stat(source);
  if (stat.isDirectory()) {
    yield* iterEmlFolder(source);
    return;
  }
  yield* iterMbox(source);
}

// ---------- classification ----------

function classifyStream(meta) {
  const text = `${meta.sender_email} ${meta.subject} ${meta.list_id}`.toLowerCase();
  const domain = meta.domain.toLowerCase();
  const containsAny = (set) => {
    for (const w of set) if (text.includes(w)) return true;
    return false;
  };
  if ([...HIGH_RISK_DOMAINS].some((w) => text.includes(w) || domain.includes(w))) {
    return 'protected_high_risk';
  }
  if (containsAny(SECURITY_WORDS)) return 'account_security';
  if (containsAny(RECEIPT_WORDS)) return 'orders_receipts';
  if (containsAny(PROMO_WORDS)) return 'marketing_promos';
  if (meta.list_unsubscribe || meta.list_id) return 'newsletter';
  if (containsAny(SAAS_LIFECYCLE_WORDS)) return 'saas_lifecycle';
  if (containsAny(SOCIAL_WORDS)) return 'social_notification';
  return 'unknown';
}

function recommendedAction(stream, total, unreadRate, hasUnsub) {
  if (stream === 'protected_high_risk' || stream === 'account_security') {
    return ['protected', 'high', 'Security, financial, healthcare, or account-critical signal.'];
  }
  if (stream === 'orders_receipts') {
    return ['keep', 'high', 'Receipts, orders, billing, returns, or transaction-like messages.'];
  }
  if (stream === 'marketing_promos' || stream === 'newsletter') {
    if (hasUnsub && (unreadRate >= 0.8 || total >= 10)) {
      return ['unsubscribe', 'low', 'Recurring promotional/list email with low-risk unsubscribe signal.'];
    }
    return ['review_manually', 'medium', 'Likely optional, but volume or unread signal is not decisive.'];
  }
  if (stream === 'saas_lifecycle') {
    return ['review_manually', 'medium', 'Possible old account or trial relationship.'];
  }
  if (stream === 'social_notification') {
    return ['review_manually', 'medium', 'High-volume notifications require manual review before unsubscribe.'];
  }
  if (hasUnsub && total >= 5) {
    return ['review_manually', 'medium', 'Recurring sender with unsubscribe metadata, but category is unclear.'];
  }
  return ['keep', 'medium', 'Not enough evidence for automated cleanup.'];
}

// Per-provider URL classification. Determines what the act phase will need
// to do — provider-specific recipes live in skills/safe-action/SKILL.md
// (the Provider Playbook). The scanner labels are surface guidance; act-phase
// behavior is driven by the Playbook at runtime.
function unsubscribeStatus(value) {
  if (!value) return ['No unsubscribe path found', 'manual'];
  const lowered = value.toLowerCase();
  if (lowered.includes('mailto:')) return ['Mailto unsubscribe address found', 'draft_email'];

  // Substack `/action/disable_email?token=…` is a deep-link to email-preferences,
  // NOT a one-click GET unsubscribe. The path pattern is the Substack signature
  // regardless of domain (substack.com, custom domains like lennysnewsletter.com,
  // and per-writer subdomains all use it).
  if (/\/action\/disable_email\?token=/i.test(value)) {
    return ['Substack settings page (multi-step)', 'multi_step_settings'];
  }
  // Mailchimp tracking domains usually require a confirmation click after the page loads.
  if (/list-manage\.com\/unsubscribe|list-manage\d+\.com\/unsubscribe/i.test(value)) {
    return ['Mailchimp unsubscribe page (confirm click)', 'multi_step_confirm'];
  }
  // ConvertKit / Kit pages also confirm-button gated.
  if (/convertkit-mail\.com\/subscribers\/unsubscribe|kit\.com\/.*unsubscribe/i.test(value)) {
    return ['ConvertKit unsubscribe page (confirm click)', 'multi_step_confirm'];
  }

  if (lowered.includes('http://') || lowered.includes('https://')) {
    return ['Direct unsubscribe link found', 'open_link'];
  }
  return ['Unsubscribe header found', 'review'];
}

// ---------- summary aggregation ----------

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

// Extract top-N entries from a counter Map by descending count.
function topKeys(counter, n) {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, n)
    .map(([k]) => k);
}

async function buildSummary(messageIter, top) {
  const companies = new Map();
  const now = new Date();
  for await (const meta of messageIter) {
    const key = meta.domain;
    let company = companies.get(key);
    if (!company) {
      company = {
        company: companyFromDomain(meta.domain),
        domain: meta.domain,
        total: 0,
        read: 0,
        unread: 0,
        last_60_days: 0,
        latest_seen: '',
        streams: new Map(),
        unsubscribe_values: new Map(),
      };
      companies.set(key, company);
    }
    company.total += 1;
    if (meta.unread) company.unread += 1;
    else company.read += 1;
    if (inLast60Days(meta.date, now)) company.last_60_days += 1;
    if (meta.date && meta.date > company.latest_seen) company.latest_seen = meta.date;
    if (meta.list_unsubscribe) {
      company.unsubscribe_values.set(
        meta.list_unsubscribe,
        (company.unsubscribe_values.get(meta.list_unsubscribe) ?? 0) + 1,
      );
    }

    const streamName = classifyStream(meta);
    let stream = company.streams.get(streamName);
    if (!stream) {
      stream = {
        stream: streamName,
        count: 0,
        unread: 0,
        read: 0,
        last_60_days: 0,
        subjects: new Map(),
        senders: new Map(),
        unsubscribe_values: new Map(),
      };
      company.streams.set(streamName, stream);
    }
    stream.count += 1;
    if (meta.unread) stream.unread += 1;
    else stream.read += 1;
    if (inLast60Days(meta.date, now)) stream.last_60_days += 1;
    const subjectKey = (meta.subject || '').slice(0, 160) || '(no subject)';
    stream.subjects.set(subjectKey, (stream.subjects.get(subjectKey) ?? 0) + 1);
    stream.senders.set(meta.sender_email, (stream.senders.get(meta.sender_email) ?? 0) + 1);
    if (meta.list_unsubscribe) {
      stream.unsubscribe_values.set(
        meta.list_unsubscribe,
        (stream.unsubscribe_values.get(meta.list_unsubscribe) ?? 0) + 1,
      );
    }
  }

  const ranked = [...companies.values()].sort((a, b) => b.total - a.total).slice(0, top);
  const rows = [];
  for (const company of ranked) {
    const streams = [];
    const sortedStreams = [...company.streams.values()].sort((a, b) => b.count - a.count);
    for (const stream of sortedStreams) {
      const unreadRate = stream.count ? stream.unread / stream.count : 0;
      const hasUnsub = stream.unsubscribe_values.size > 0;
      const [action, risk, reason] = recommendedAction(stream.stream, stream.count, unreadRate, hasUnsub);
      const unsubscribeValue = hasUnsub
        ? [...stream.unsubscribe_values.entries()].sort((a, b) => b[1] - a[1])[0][0]
        : '';
      const [methodLabel, methodType] = unsubscribeStatus(unsubscribeValue);
      streams.push({
        stream: stream.stream,
        count: stream.count,
        read: stream.read,
        unread: stream.unread,
        unread_rate: round3(unreadRate),
        last_60_days: stream.last_60_days,
        senders: topKeys(stream.senders, 5),
        subjects: topKeys(stream.subjects, 5),
        unsubscribe: unsubscribeValue,
        unsubscribe_method: methodLabel,
        unsubscribe_method_type: methodType,
        recommended_action: action,
        risk,
        reason,
      });
    }
    rows.push({
      company: company.company,
      domain: company.domain,
      total: company.total,
      read: company.read,
      unread: company.unread,
      unread_rate: company.total ? round3(company.unread / company.total) : 0,
      last_60_days: company.last_60_days,
      latest_seen: company.latest_seen,
      streams,
    });
  }
  return rows;
}

function makeApprovedActions(companies) {
  const actions = [];
  for (const company of companies) {
    for (const stream of company.streams) {
      actions.push({
        id: `${company.domain}::${stream.stream}`,
        company: company.company,
        domain: company.domain,
        stream: stream.stream,
        action: stream.recommended_action,
        approved: false,
        risk: stream.risk,
        count: stream.count,
        read: stream.read,
        unread: stream.unread,
        last_60_days: stream.last_60_days,
        unread_rate: stream.unread_rate,
        unsubscribe: stream.unsubscribe,
        unsubscribe_method: stream.unsubscribe_method,
        unsubscribe_method_type: stream.unsubscribe_method_type,
        reason: stream.reason,
      });
    }
  }
  return actions;
}

// ---------- output writers ----------

async function writeCsv(outputDir, companies) {
  const rows = [['company', 'domain', 'total', 'read', 'unread', 'last_60_days', 'latest_seen',
    'stream', 'stream_count', 'stream_read', 'stream_unread', 'stream_last_60_days',
    'action', 'risk']];
  for (const company of companies) {
    for (const stream of company.streams) {
      rows.push([
        company.company, company.domain, company.total, company.read, company.unread,
        company.last_60_days, company.latest_seen, stream.stream, stream.count,
        stream.read, stream.unread, stream.last_60_days,
        stream.recommended_action, stream.risk,
      ]);
    }
  }
  const csvEscape = (cell) => {
    const s = String(cell ?? '');
    if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
  await fsp.writeFile(path.join(outputDir, 'sender-ranking.csv'), body, 'utf8');
}

async function writeMarkdown(outputDir, companies) {
  const lines = ['# Recommended Actions', ''];
  for (const company of companies.slice(0, 100)) {
    lines.push(`## ${company.company} (${company.domain})`);
    lines.push(`- Total: ${company.total}`);
    lines.push(`- Read: ${company.read}`);
    lines.push(`- Unread: ${company.unread}`);
    lines.push(`- Last 60 days: ${company.last_60_days}`);
    for (const stream of company.streams) {
      lines.push(
        `- \`${stream.stream}\`: ${stream.recommended_action} ` +
        `(${stream.risk}, ${stream.count} emails, ${stream.read} read, ` +
        `${stream.unread} unread, ${stream.last_60_days} in last 60 days, ` +
        `${Math.trunc(stream.unread_rate * 100)}% unread)`
      );
    }
    lines.push('');
  }
  await fsp.writeFile(path.join(outputDir, 'recommended-actions.md'), lines.join('\n'), 'utf8');
}

// ---------- HTML render ----------

const REPORT_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Enuff Is Enuff Unsubscribe Report</title>
  <style>
    :root { color-scheme: light; --ink:#17201a; --muted:#637067; --line:#d7ded8; --bg:#f7f8f4; --panel:#fff; --accent:#166534; --warn:#a16207; --danger:#991b1b; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--bg); }
    header { padding:28px 36px 22px; border-bottom:1px solid var(--line); background:#eef5ef; }
    h1 { margin:0 0 8px; font-size:32px; letter-spacing:0; }
    h2 { margin:0; font-size:20px; letter-spacing:0; }
    p { margin:6px 0; color:var(--muted); }
    main { padding:22px 36px 42px; max-width:1240px; margin:0 auto; }
    .source { word-break: break-word; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-top:18px; }
    .stat { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:13px; }
    .stat b { display:block; font-size:24px; }
    .disclaimer { border:1px solid #fca5a5; background:#fff5f5; color:#991b1b; border-radius:8px; padding:9px 11px; margin:0 0 14px; font-size:12px; font-weight:700; }
    .next-step { border:1px solid #bbf7d0; background:#f0fdf4; color:#14532d; border-radius:8px; padding:13px; margin:14px 0; font-weight:700; }
    .company { background:#fff; border:1px solid var(--line); border-radius:8px; margin:16px 0; overflow:hidden; }
    .company-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; padding:16px; border-bottom:1px solid var(--line); background:#fbfcf9; }
    .company-action { border:1px solid #bbf7d0; background:#f0fdf4; color:#14532d; border-radius:999px; padding:5px 10px; font-size:12px; font-weight:800; white-space:nowrap; }
    .metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:8px; padding:12px 16px; border-bottom:1px solid var(--line); }
    .metrics div { border:1px solid #edf0ed; border-radius:7px; padding:10px; }
    .metrics b { display:block; font-size:22px; }
    .metrics span, .muted { color:var(--muted); font-size:12px; }
    table { width:100%; border-collapse:collapse; }
    th, td { text-align:left; vertical-align:top; padding:11px 12px; border-top:1px solid #edf0ed; }
    th { color:#435247; font-size:12px; background:#f7f9f6; }
    td { font-size:13px; }
    details { margin-top:6px; }
    summary { cursor:pointer; color:var(--muted); font-size:12px; }
    ul { margin:6px 0 0 18px; padding:0; color:var(--muted); }
    .badge { display:inline-block; border-radius:999px; padding:2px 8px; border:1px solid var(--line); font-size:12px; color:var(--muted); }
    .risk-low { color:var(--accent); border-color:#86efac; }
    .risk-medium { color:var(--warn); border-color:#facc15; }
    .risk-high { color:var(--danger); border-color:#fecaca; }
    tr.approved { background:#dcfce7; }
    tr.approved td { border-top:2px solid #16a34a; }
    .badge-approved { display:inline-block; background:#16a34a; color:#fff; padding:6px 12px; border-radius:8px; font-weight:800; font-size:13px; letter-spacing:.4px; box-shadow:0 1px 0 rgba(0,0,0,.1); }
    .company-approved-pill { display:inline-block; background:#16a34a; color:#fff; padding:5px 10px; border-radius:999px; font-size:12px; font-weight:800; margin-left:8px; }
    .approved-summary { border:2px solid #16a34a; background:#f0fdf4; border-radius:10px; padding:16px 18px; margin:14px 0 22px; }
    .approved-summary h2 { color:#14532d; margin:0 0 10px; font-size:18px; }
    .approved-summary ol { margin:0; padding-left:22px; color:#14532d; }
    .approved-summary li { margin:6px 0; }
    .approved-summary code { background:#bbf7d0; color:#14532d; }
    .approved-empty { border:1px dashed #d7ded8; background:#fbfcf9; color:#637067; border-radius:10px; padding:14px 18px; margin:14px 0 22px; font-size:13px; }
    .stat.stat-approved b { color:#14532d; }
    .stat.stat-approved { background:#f0fdf4; border-color:#86efac; }
    .path { max-width:340px; overflow-wrap:anywhere; margin-top:4px; }
    code { background:#eef0ec; padding:2px 4px; border-radius:4px; }
    @media (max-width: 820px) {
      header, main { padding-left:18px; padding-right:18px; }
      .company-head { display:block; }
      .company-action { display:inline-block; margin-top:8px; }
      table, thead, tbody, th, td, tr { display:block; }
      thead { display:none; }
      tr { border-top:1px solid var(--line); padding:8px 0; }
      td { border:0; padding:6px 12px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Enuff Is Enuff Unsubscribe Report</h1>
    <p>This is a read-only confirmation report generated after scanning an email export. It shows company-wise unsubscribe evidence and recommendations.</p>
    <p class="source">Source: __SOURCE__</p>
    <p>Generated: __GENERATED_AT__</p>
    <div class="stats">
      <div class="stat stat-approved"><b>__APPROVED__</b><span>You approved</span></div>
      <div class="stat"><b>__TOTAL__</b><span>Total emails</span></div>
      <div class="stat"><b>__READ__</b><span>Read / likely read</span></div>
      <div class="stat"><b>__UNREAD__</b><span>Unread</span></div>
      <div class="stat"><b>__LAST_60__</b><span>Last 60 days</span></div>
      <div class="stat"><b>__COMPANIES__</b><span>Companies</span></div>
      <div class="stat"><b>__UNSUBSCRIBE__</b><span>Unsubscribe candidates</span></div>
      <div class="stat"><b>__PROTECTED__</b><span>Protected streams</span></div>
    </div>
  </header>
  <main>
    <div class="disclaimer">
      Disclaimer: Automated suggestions only. Review every selected action before approving; you are responsible for final unsubscribe decisions.
    </div>
    <div class="next-step">
      Next step: return to Claude and run <code>/enuff-is-enuff-unsubscribe:act</code>. Claude should ask, "Have you reviewed the report? Are you okay with everything?" before opening unsubscribe links or drafting unsubscribe emails.
    </div>
    __APPROVED_SUMMARY__
    __COMPANY_SECTIONS__
  </main>
</body>
</html>
`;

function fmtStreamName(value) {
  return value.replaceAll('_', ' ').replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function actionLabel(action) {
  const labels = {
    unsubscribe: 'Unsubscribe',
    keep: 'Keep',
    protected: 'Protected',
    review_manually: 'Review manually',
  };
  return labels[action] ?? fmtStreamName(action);
}

function decisionCell(stream) {
  if (stream.approved) {
    return `<span class="badge-approved">✓ APPROVED · ${htmlEscape(actionLabel(stream.recommended_action))}</span>`;
  }
  if (stream.recommended_action === 'unsubscribe') return htmlEscape('Not selected');
  return htmlEscape(actionLabel(stream.recommended_action));
}

function renderStream(stream) {
  const subjects = stream.subjects.slice(0, 3).map((s) => `<li>${htmlEscape(s)}</li>`).join('');
  const unsub = stream.unsubscribe ? htmlEscape(stream.unsubscribe) : 'None found';
  const rowClass = stream.approved ? ' class="approved"' : '';
  return `
      <tr${rowClass}>
        <td>
          <strong>${htmlEscape(fmtStreamName(stream.stream))}</strong>
          <div class="muted">${htmlEscape(stream.reason)}</div>
          <details>
            <summary>Sample subjects</summary>
            <ul>${subjects}</ul>
          </details>
        </td>
        <td>${stream.count}</td>
        <td>${stream.read}</td>
        <td>${stream.unread}</td>
        <td>${stream.last_60_days}</td>
        <td><span class="badge risk-${htmlEscape(stream.risk)}">${htmlEscape(stream.risk)}</span></td>
        <td>${decisionCell(stream)}</td>
        <td>
          ${htmlEscape(stream.unsubscribe_method)}
          <div class="muted path">${unsub}</div>
        </td>
      </tr>
    `;
}

function companyStatus(company) {
  if (company.streams.some((s) => s.recommended_action === 'unsubscribe')) return 'Unsubscribe candidate';
  if (company.streams.some((s) => s.recommended_action === 'protected')) return 'Protected / no action';
  return 'Review only';
}

function renderCompany(company) {
  const streams = company.streams.map(renderStream).join('\n');
  const approvedCount = company.streams.filter((s) => s.approved).length;
  const approvedPill = approvedCount
    ? `<span class="company-approved-pill">✓ ${approvedCount} APPROVED</span>`
    : '';
  return `
      <section class="company">
        <div class="company-head">
          <div>
            <h2>${htmlEscape(company.company)}${approvedPill}</h2>
            <p>${htmlEscape(company.domain)} · latest seen ${htmlEscape(company.latest_seen || 'unknown')}</p>
          </div>
          <div class="company-action">${htmlEscape(companyStatus(company))}</div>
        </div>
        <div class="metrics">
          <div><b>${company.total}</b><span>Total emails</span></div>
          <div><b>${company.read}</b><span>Read / likely read</span></div>
          <div><b>${company.unread}</b><span>Unread</span></div>
          <div><b>${company.last_60_days}</b><span>Last 60 days</span></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Stream</th>
              <th>Total</th>
              <th>Read</th>
              <th>Unread</th>
              <th>Last 60 days</th>
              <th>Risk</th>
              <th>Recommendation</th>
              <th>Unsubscribe path</th>
            </tr>
          </thead>
          <tbody>${streams}</tbody>
        </table>
      </section>
    `;
}

function renderApprovedSummary(approvedActions) {
  const approved = approvedActions.filter((a) => a.approved);
  if (approved.length === 0) {
    return `<div class="approved-empty">You haven't approved any actions yet. Tell Claude which brands/streams to flag, then re-render this report. Nothing will be acted on until you do.</div>`;
  }
  const items = approved.map((a) => {
    const unsub = a.unsubscribe ? `<div class="muted path"><code>${htmlEscape(a.unsubscribe)}</code></div>` : '';
    return `<li><strong>${htmlEscape(a.company)}</strong> (${htmlEscape(a.domain)}) — <em>${htmlEscape(fmtStreamName(a.stream))}</em>: ${htmlEscape(actionLabel(a.action))} · ${a.count} email${a.count === 1 ? '' : 's'} · ${htmlEscape(a.unsubscribe_method)}${unsub}</li>`;
  }).join('\n');
  return `
    <div class="approved-summary">
      <h2>✓ Your approved actions (${approved.length})</h2>
      <p style="color:#14532d;margin:0 0 8px;">These are the items Claude will act on when you run <code>/enuff-is-enuff-unsubscribe:act</code>. Claude must ask before each one.</p>
      <ol>${items}</ol>
    </div>`;
}

function applyApprovals(companies, approvedActions) {
  const approvedById = new Map(approvedActions.map((item) => [item.id, item]));
  const copied = JSON.parse(JSON.stringify(companies));
  for (const company of copied) {
    for (const stream of company.streams) {
      const item = approvedById.get(`${company.domain}::${stream.stream}`);
      stream.approved = !!(item && item.approved);
    }
  }
  return copied;
}

async function renderReport(outputDir, companies, source, approvedActions) {
  const actions = approvedActions ?? makeApprovedActions(companies);
  const reportCompanies = applyApprovals(companies, actions);
  const state = {
    source,
    generated_at: localIsoSeconds(),
    companies,
    approved_actions: actions,
  };
  await fsp.writeFile(path.join(outputDir, 'report-state.json'), JSON.stringify(state, null, 2), 'utf8');
  await fsp.writeFile(path.join(outputDir, 'approved-actions.json'), JSON.stringify(actions, null, 2), 'utf8');

  const stats = {
    companies: companies.length,
    streams: actions.length,
    approved: actions.filter((i) => i.approved).length,
    unsubscribe: actions.filter((i) => i.action === 'unsubscribe' && i.approved).length,
    protected: actions.filter((i) => i.action === 'protected').length,
    review: actions.filter((i) => i.action === 'review_manually').length,
    total: companies.reduce((acc, c) => acc + c.total, 0),
    read: companies.reduce((acc, c) => acc + c.read, 0),
    unread: companies.reduce((acc, c) => acc + c.unread, 0),
    last_60_days: companies.reduce((acc, c) => acc + c.last_60_days, 0),
  };
  const approvedSummaryHtml = renderApprovedSummary(actions);
  const companyHtml = reportCompanies.map(renderCompany).join('\n');
  const html = REPORT_HTML
    .replaceAll('__GENERATED_AT__', htmlEscape(state.generated_at))
    .replaceAll('__SOURCE__', htmlEscape(source))
    .replaceAll('__COMPANIES__', String(stats.companies))
    .replaceAll('__TOTAL__', String(stats.total))
    .replaceAll('__READ__', String(stats.read))
    .replaceAll('__UNREAD__', String(stats.unread))
    .replaceAll('__LAST_60__', String(stats.last_60_days))
    .replaceAll('__APPROVED__', String(stats.approved))
    .replaceAll('__UNSUBSCRIBE__', String(stats.unsubscribe))
    .replaceAll('__PROTECTED__', String(stats.protected))
    .replaceAll('__APPROVED_SUMMARY__', approvedSummaryHtml)
    .replaceAll('__COMPANY_SECTIONS__', companyHtml);
  await fsp.writeFile(path.join(outputDir, 'report.html'), html, 'utf8');
}

async function writeScanState(outputDir, companies, source) {
  const approvedActions = makeApprovedActions(companies);
  const state = {
    source,
    generated_at: localIsoSeconds(),
    companies,
    approved_actions: approvedActions,
  };
  await fsp.writeFile(path.join(outputDir, 'report-state.json'), JSON.stringify(state, null, 2), 'utf8');
  await fsp.writeFile(path.join(outputDir, 'approved-actions.json'), JSON.stringify(approvedActions, null, 2), 'utf8');
  return approvedActions;
}

async function loadScanState(reportDir) {
  const statePath = path.join(reportDir, 'report-state.json');
  if (!fs.existsSync(statePath)) {
    throw new Error(`Scan state not found: ${statePath}. Run scan first.`);
  }
  return JSON.parse(await fsp.readFile(statePath, 'utf8'));
}

function printScanSummary(companies, approvedActions) {
  const total = companies.reduce((a, c) => a + c.total, 0);
  const read = companies.reduce((a, c) => a + c.read, 0);
  const unread = companies.reduce((a, c) => a + c.unread, 0);
  const last60 = companies.reduce((a, c) => a + c.last_60_days, 0);
  const unsubscribeCandidates = approvedActions.filter((i) => i.action === 'unsubscribe').length;
  const protectedCount = approvedActions.filter((i) => i.action === 'protected').length;
  console.log('Scan complete.');
  console.log(`Emails scanned: ${total}`);
  console.log(`Read / likely read: ${read}`);
  console.log(`Unread: ${unread}`);
  console.log(`Emails in last 60 days: ${last60}`);
  console.log(`Companies found: ${companies.length}`);
  console.log(`Unsubscribe candidates: ${unsubscribeCandidates}`);
  console.log(`Protected streams: ${protectedCount}`);
  console.log('');
  console.log('Next: review companies in Claude, then generate the read-only report.');
  console.log('Local prototype command:');
  console.log('  node bin/enuff_scan.mjs review enuff-is-enuff-report');
}

function approveUnsubscribeCandidates(actions) {
  for (const item of actions) {
    item.approved = item.action === 'unsubscribe' && item.risk === 'low';
  }
  return actions;
}

async function reviewLineMode(companies, actions) {
  const actionById = new Map(actions.map((i) => [i.id, i]));
  console.log('Company-wise review. Type y to approve unsubscribe candidates, n to skip.');
  console.log('Press Enter to keep the default shown in brackets.');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
  try {
    for (const company of companies) {
      console.log('');
      console.log(`${company.company} (${company.domain})`);
      console.log(`  total=${company.total} read=${company.read} unread=${company.unread} last_60_days=${company.last_60_days}`);
      for (const stream of company.streams) {
        const item = actionById.get(`${company.domain}::${stream.stream}`);
        if (item.action !== 'unsubscribe' || item.risk !== 'low') {
          console.log(`  - ${fmtStreamName(stream.stream)}: ${actionLabel(item.action)} (${item.reason})`);
          continue;
        }
        const current = item.approved ? 'y' : 'n';
        const prompt =
          `  Approve unsubscribe for ${fmtStreamName(stream.stream)} ` +
          `(${stream.count} emails, ${stream.unread} unread, ${stream.last_60_days} in last 60 days)? [${current}] `;
        const answer = (await ask(prompt)).trim().toLowerCase();
        // Empty input keeps the existing approval state; never silently flip y → n.
        if (answer === 'y' || answer === 'yes') item.approved = true;
        else if (answer === 'n' || answer === 'no') item.approved = false;
      }
    }
  } finally {
    rl.close();
  }
  return actions;
}

// ---------- HTTP serve ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function serveReport(reportDir, port) {
  const root = path.resolve(reportDir);
  if (!fs.existsSync(path.join(root, 'report.html'))) {
    throw new Error(`report.html not found in ${root}`);
  }
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/save') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        await fsp.writeFile(path.join(root, 'approved-actions.json'),
          JSON.stringify(payload.approved_actions, null, 2), 'utf8');
        await fsp.writeFile(path.join(root, 'report-state.json'),
          JSON.stringify(payload.report_state, null, 2), 'utf8');
        res.statusCode = 204;
        res.end();
      } catch (exc) {
        res.statusCode = 400;
        res.end(String(exc && exc.message || exc));
      }
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.end('Method not allowed');
      return;
    }
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/report.html';
    const filePath = path.normalize(path.join(root, urlPath));
    if (!filePath.startsWith(root)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    try {
      const data = await fsp.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('content-type', MIME[ext] ?? 'application/octet-stream');
      res.setHeader('cache-control', 'no-store');
      res.statusCode = 200;
      if (req.method === 'HEAD') res.end();
      else res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Serving report at http://127.0.0.1:${port}/report.html`);
  });
  return server;
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v.startsWith('--')) {
      const eq = v.indexOf('=');
      if (eq !== -1) {
        args.flags[v.slice(2, eq)] = v.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
          args.flags[v.slice(2)] = true;
        } else {
          args.flags[v.slice(2)] = next;
          i++;
        }
      }
    } else {
      args._.push(v);
    }
  }
  return args;
}

function usage() {
  console.error('Usage:');
  console.error('  node bin/enuff_scan.mjs scan <source> [--output DIR] [--top N]');
  console.error('  node bin/enuff_scan.mjs review [report_dir] [--approve-candidates] [--line-mode]');
  console.error('  node bin/enuff_scan.mjs serve [report_dir] [--port N]');
}

async function cmdScan(parsed) {
  const sourceArg = parsed._[0];
  if (!sourceArg) { usage(); process.exit(2); }
  const source = path.resolve(sourceArg);
  if (!fs.existsSync(source)) throw new Error(`Input not found: ${source}`);
  const outputDir = path.resolve(parsed.flags.output ?? OUTPUT_DIR);
  await fsp.mkdir(outputDir, { recursive: true });
  const top = parsed.flags.top ? Number(parsed.flags.top) : 200;
  const companies = await buildSummary(iterMessages(source), top);
  await writeCsv(outputDir, companies);
  await writeMarkdown(outputDir, companies);
  const approvedActions = await writeScanState(outputDir, companies, source);
  printScanSummary(companies, approvedActions);
}

async function cmdReview(parsed) {
  const reportDir = path.resolve(parsed._[0] ?? OUTPUT_DIR);
  const state = await loadScanState(reportDir);
  const companies = state.companies;
  // approved-actions.json is the canonical source of truth for approvals — the
  // skill instructs Claude to edit it directly. Fall back to the snapshot
  // inside report-state.json only if approved-actions.json is missing.
  const approvedPath = path.join(reportDir, 'approved-actions.json');
  let actions;
  if (fs.existsSync(approvedPath)) {
    actions = JSON.parse(await fsp.readFile(approvedPath, 'utf8'));
  } else {
    actions = state.approved_actions;
  }
  if (parsed.flags['approve-candidates']) {
    actions = approveUnsubscribeCandidates(actions);
  } else if (parsed.flags['line-mode']) {
    actions = await reviewLineMode(companies, actions);
  }
  // Default (no flags): render the report from the current approvals in
  // approved-actions.json without prompting. The canonical approval flow is
  // Claude editing approved-actions.json conversationally, then running
  // `review` to re-render. Interactive y/n prompting is opt-in via --line-mode.
  state.approved_actions = actions;
  state.reviewed_at = localIsoSeconds();
  await fsp.writeFile(path.join(reportDir, 'report-state.json'), JSON.stringify(state, null, 2), 'utf8');
  await fsp.writeFile(path.join(reportDir, 'approved-actions.json'), JSON.stringify(actions, null, 2), 'utf8');
  await renderReport(reportDir, companies, state.source, actions);
  const approvedCount = actions.filter((i) => i.approved).length;
  console.log(`Approved unsubscribe actions: ${approvedCount}`);
  console.log(`Read-only report written: ${path.join(reportDir, 'report.html')}`);
}

function cmdServe(parsed) {
  const reportDir = path.resolve(parsed._[0] ?? OUTPUT_DIR);
  const port = parsed.flags.port ? Number(parsed.flags.port) : 8765;
  serveReport(reportDir, port);
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || command === '-h' || command === '--help') {
    usage();
    process.exit(command ? 0 : 2);
  }
  const parsed = parseArgs(argv.slice(1));
  try {
    if (command === 'scan') await cmdScan(parsed);
    else if (command === 'review') await cmdReview(parsed);
    else if (command === 'serve') cmdServe(parsed);
    else { usage(); process.exit(2); }
  } catch (exc) {
    console.error(exc.message ?? exc);
    process.exit(1);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
