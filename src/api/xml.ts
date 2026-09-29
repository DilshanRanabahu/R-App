import { XMLParser } from 'fast-xml-parser';

import { RouterError } from './errors';

const MAX_RESPONSE_BYTES = 1_000_000;
const TAG_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export type XmlValue = string | number | boolean | XmlObject | XmlValue[];
export interface XmlObject {
  [key: string]: XmlValue | undefined;
}

/** Escape text placed inside an XML element (AGENTS.md §8.4). */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * The escaping the router's own web UI applies (its `xss()` helper). Used where we
 * must send byte-for-byte what the web UI sends, e.g. the admin password change,
 * so a password with ( ) / ' etc. ends up exactly as typed. Still XML-safe.
 */
export function escapeLikeWebUi(value: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    "'": '&#39;',
    '"': '&quot;',
    '<': '&lt;',
    '>': '&gt;',
    '/': '&#x2F;',
    '(': '&#40;',
    ')': '&#41;',
  };
  return value.replace(/[&'"<>/()]/g, (c) => map[c] ?? c);
}

/**
 * The Wi-Fi pages' own escaping (wificommon.js wifiEncode): like escapeLikeWebUi but
 * with &apos; for '. Used for the Wi-Fi name / password so they arrive exactly as typed.
 */
export function escapeLikeWifiUi(value: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
    '<': '&lt;',
    '>': '&gt;',
    '/': '&#x2F;',
    '(': '&#40;',
    ')': '&#41;',
  };
  return value.replace(/[&'"<>/()]/g, (c) => map[c] ?? c);
}

type Escape = (value: string) => string;

function element(name: string, value: XmlValue | undefined, escape: Escape): string {
  if (value === undefined) return '';
  if (!TAG_NAME.test(name)) throw new Error(`Invalid XML tag name: ${name}`);
  if (Array.isArray(value)) return value.map((v) => element(name, v, escape)).join('');
  if (typeof value === 'object') return `<${name}>${children(value, escape)}</${name}>`;
  return `<${name}>${escape(String(value))}</${name}>`;
}

function children(obj: XmlObject, escape: Escape): string {
  return Object.entries(obj)
    .map(([k, v]) => element(k, v, escape))
    .join('');
}

export function buildRequest(body: XmlObject, escape: Escape = escapeXml): string {
  return `<?xml version="1.0" encoding="UTF-8"?><request>${children(body, escape)}</request>`;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  parseTagValue: false, // keep strings; endpoints convert explicitly
  trimValues: true,
  processEntities: true, // only the 5 predefined entities; DOCTYPE is rejected below
  htmlEntities: false,
});

/**
 * Parse a HiLink response. Returns the <response> content, or throws a
 * RouterError for <error> bodies and anything unexpected.
 */
export function parseResponse<T = unknown>(text: string): T {
  if (text.length > MAX_RESPONSE_BYTES) throw new RouterError('invalid_response');
  // No custom entities / DTDs: blocks entity-expansion tricks from a fake router.
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new RouterError('invalid_response');

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(text) as Record<string, unknown>;
  } catch {
    throw new RouterError('invalid_response');
  }

  if ('error' in parsed) {
    const err = parsed.error as { code?: unknown } | undefined;
    throw RouterError.fromCode(String(err?.code ?? ''));
  }
  if ('response' in parsed) return parsed.response as T;
  throw new RouterError('invalid_response');
}

/** HiLink returns one child as an object and several as an array. */
export function toArray<T>(value: T | T[] | undefined | ''): T[] {
  if (value === undefined || value === '') return [];
  return Array.isArray(value) ? value : [value];
}
