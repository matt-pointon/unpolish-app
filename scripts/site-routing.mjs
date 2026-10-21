/** Convert a Vercel `source` pattern to a RegExp for the request pathname. */
export function sourceToRegExp(source) {
  let out = '^';
  let i = 0;
  while (i < source.length) {
    if (source[i] === ':') {
      i++;
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i++;
      if (source[i] === '*') {
        out += '.*';
        i++;
      } else if (source[i] === '(') {
        let depth = 0;
        const start = i;
        do {
          if (source[i] === '(') depth++;
          else if (source[i] === ')') depth--;
          i++;
        } while (i < source.length && depth > 0);
        out += source.slice(start, i);
      } else {
        out += '[^/]+';
      }
    } else {
      const next = source.indexOf(':', i);
      const end = next === -1 ? source.length : next;
      out += escapeRegex(source.slice(i, end));
      i = end;
    }
  }
  return new RegExp(out + '$');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function compileVercel(vercel) {
  return {
    trailingSlash: vercel.trailingSlash === true,
    rewrites: (vercel.rewrites || []).map((r) => ({ ...r, re: sourceToRegExp(r.source) })),
    headers: (vercel.headers || []).map((r) => ({ ...r, re: sourceToRegExp(r.source) })),
  };
}

export function spaDestination(rules, pathname) {
  for (const rule of rules) {
    if (rule.re.test(pathname)) return rule.destination;
  }
  return null;
}

export function cacheControl(rules, pathname) {
  let value;
  for (const rule of rules) {
    if (rule.re.test(pathname)) {
      const h = (rule.headers || []).find((x) => x.key.toLowerCase() === 'cache-control');
      if (h) value = h.value;
    }
  }
  return value || 'no-cache';
}
