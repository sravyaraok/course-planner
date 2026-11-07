/* Shared constants and helpers. */
window.Components = window.Components || {};

const TERMS = ['Winter', 'Spring', 'Summer', 'Fall'];
const MAIN_TERMS = ['Fall', 'Spring'];
const PRE_COLLEGE = 'PRE';
const UNASSIGNED = '__unassigned__';
const DEFAULT_AREAS = ['Major', 'Minor', 'Liberal Studies', 'Electives'];

const Utils = {
  esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },

  uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  },

  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  parseSemester(key) {
    const m = /^(Winter|Spring|Summer|Fall)\s+(\d{4})$/.exec(String(key || '').trim());
    return m ? { term: m[1], year: Number(m[2]) } : null;
  },

  /** Sortable index: Winter < Spring < Summer < Fall within a calendar year. */
  semesterOrder(key) {
    if (key === PRE_COLLEGE) return -Infinity;
    const p = Utils.parseSemester(key);
    return p ? p.year * 4 + TERMS.indexOf(p.term) : Infinity;
  },

  semesterFromOrder(order) {
    return `${TERMS[((order % 4) + 4) % 4]} ${Math.floor(order / 4)}`;
  },

  semesterLabel(key) {
    return key === PRE_COLLEGE ? 'Pre-College / AP' : key;
  },

  /**
   * Columns for a plan: pre-college column, then Fall/Spring (plus Winter/Summer
   * if enabled) for plan.years years. Semesters that hold courses but fall outside
   * the configured range (or a hidden term) are appended so nothing is lost.
   */
  planSemesters(plan) {
    const cols = [{ key: PRE_COLLEGE, label: Utils.semesterLabel(PRE_COLLEGE) }];
    const start = Utils.semesterOrder(plan.startSemester);
    if (Number.isFinite(start)) {
      const totalMain = Math.max(1, Number(plan.years) || 4) * 2;
      let main = 0;
      for (let o = start; main < totalMain; o++) {
        const term = TERMS[((o % 4) + 4) % 4];
        const isMain = MAIN_TERMS.includes(term);
        if (isMain) main++;
        const enabled = isMain || o === start
          || (term === 'Winter' && plan.showWinter)
          || (term === 'Summer' && plan.showSummer);
        if (enabled) {
          const key = Utils.semesterFromOrder(o);
          cols.push({ key, label: key, term });
        }
      }
    }
    const known = new Set(cols.map((c) => c.key));
    const extras = [...new Set(plan.courseList.map((e) => e.semester))]
      .filter((k) => !known.has(k))
      .sort((a, b) => Utils.semesterOrder(a) - Utils.semesterOrder(b));
    for (const key of extras) {
      cols.push({ key, label: key, term: Utils.parseSemester(key)?.term, extra: true });
    }
    return cols;
  },

  /** "A, B\nC" -> [["A","B"],["C"]]. Lines (or ';') separate sets; ',', '|' or ' or ' separate alternatives. */
  parseReqText(text) {
    return String(text || '')
      .split(/\n|;/)
      .map((line) => line.split(/,|\||\s+or\s+/i).map((s) => s.trim()).filter(Boolean))
      .filter((set) => set.length);
  },

  formatReqText(reqs) {
    return (reqs || []).map((set) => set.join(', ')).join('\n');
  },

  formatReqInline(reqs) {
    return (reqs || []).map((set) => (set.length > 1 ? `(${set.join(' or ')})` : set[0])).join(' and ');
  },

  formatCredits(n) {
    const v = Number(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  },

  download(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  },

  slug(s) {
    return String(s || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';
  },

  /** Event target as an Element (drag events can target Text nodes). */
  targetEl(e) {
    const t = e.target;
    return t && t.nodeType === 1 ? t : t?.parentElement || document.body;
  },

  /** Clone a <template id="tpl-NAME"> into a fresh element. */
  template(name) {
    const tpl = document.getElementById(`tpl-${name}`);
    if (!tpl) throw new Error(`Missing template tpl-${name}`);
    return tpl.content.firstElementChild.cloneNode(true);
  },

  refs(root) {
    const out = {};
    root.querySelectorAll('[data-ref]').forEach((el) => { out[el.dataset.ref] = el; });
    return out;
  },

  toast(message, kind = 'info') {
    let host = document.querySelector('.toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => el.classList.add('hide'), 2600);
    setTimeout(() => el.remove(), 3000);
  },
};
