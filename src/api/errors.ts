export type RouterErrorKind =
  | 'login_required'
  | 'bad_token'
  | 'wrong_password'
  | 'too_many_attempts'
  | 'already_logged_in'
  | 'not_supported'
  | 'unreachable'
  | 'timeout'
  | 'invalid_response'
  | 'invalid_address'
  | 'identity_mismatch'
  | 'router';

// HiLink error codes seen on B31x firmware.
const CODE_KINDS: Record<string, RouterErrorKind> = {
  '100002': 'not_supported',
  '100003': 'login_required',
  '108001': 'wrong_password',
  '108002': 'wrong_password',
  '108003': 'already_logged_in',
  '108006': 'wrong_password',
  '108007': 'too_many_attempts',
  '125001': 'bad_token',
  '125002': 'bad_token',
  '125003': 'bad_token',
};

export class RouterError extends Error {
  readonly kind: RouterErrorKind;
  readonly code?: string;
  /** Seconds until the account unlocks, when kind is too_many_attempts. */
  readonly waitSeconds?: number;

  constructor(kind: RouterErrorKind, code?: string, waitSeconds?: number) {
    super(code ? `${kind} (${code})` : kind);
    this.name = 'RouterError';
    this.kind = kind;
    this.code = code;
    this.waitSeconds = waitSeconds;
  }

  static fromCode(code: string): RouterError {
    return new RouterError(CODE_KINDS[code] ?? 'router', code);
  }
}

export function isRouterError(e: unknown, kind?: RouterErrorKind): e is RouterError {
  return e instanceof RouterError && (kind === undefined || e.kind === kind);
}

/** Short, plain-language messages (DESIGN.md §10, §14). No raw XML or tokens. */
export function userMessage(e: unknown): string {
  if (!(e instanceof RouterError)) return 'Something went wrong. Please try again.';
  switch (e.kind) {
    case 'login_required':
      return 'Please log in to your router.';
    case 'wrong_password':
      return 'Wrong username or password.';
    case 'too_many_attempts':
      return 'Too many attempts. Please wait and try again.';
    case 'unreachable':
      return "Can't reach your router.";
    case 'timeout':
      return 'The router took too long to answer.';
    case 'not_supported':
      return "Your router doesn't support this.";
    case 'identity_mismatch':
      return "This doesn't look like your router.";
    case 'invalid_address':
      return 'Router address must be a local network address.';
    case 'bad_token':
    case 'already_logged_in':
    case 'invalid_response':
    case 'router':
      return 'The router returned an error. Please try again.';
  }
}
