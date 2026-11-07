/* Semester (columns) × area-of-study (rows) grid with live totals and drag & drop. */
window.Components['plan-grid'] = class PlanGrid {
  constructor(host) {
    this.el = Utils.template('plan-grid');
    host.replaceWith(this.el);
    this.refs = Utils.refs(this.el);
    this.empty = document.createElement('div');
    this.empty.className = 'empty';
    this.el.before(this.empty);

    this.refs.showNames.addEventListener('change', (e) => Store.setUi({ showNames: e.target.checked }));
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.empty.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'manage-universities') Bus.emit('manage-universities');
      if (action === 'new-plan') this.safe(() => Store.createPlan({ planName: 'New Plan' }));
    });
    this.bindDragAndDrop();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && Store.state.ui.highlightArea && !document.querySelector('dialog[open]')) {
        Store.setUi({ highlightArea: null });
      }
    });
  }

  safe(fn) {
    try { fn(); } catch (err) { Utils.toast(err.message, 'error'); }
  }

  onClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const chip = e.target.closest('.chip');
    const cell = e.target.closest('td.pg-cell');
    switch (target.dataset.action) {
      case 'add-course': Bus.emit('edit-plan-entry', {}); break;
      case 'remove-chip':
        e.stopPropagation();
        this.safe(() => Store.removeEntry(chip.dataset.course));
        break;
      case 'highlight-area': {
        const area = target.dataset.area;
        Store.setUi({ highlightArea: Store.state.ui.highlightArea === area ? null : area });
        break;
      }
      case 'clear-highlight': Store.setUi({ highlightArea: null }); break;
      case 'edit-chip': Bus.emit('edit-plan-entry', { courseId: chip.dataset.course }); break;
      case 'add-in-cell':
        Bus.emit('edit-plan-entry', { semester: cell.dataset.sem, area: cell.dataset.area === UNASSIGNED ? null : cell.dataset.area });
        break;
      default: break;
    }
  }

  bindDragAndDrop() {
    const table = this.refs.table;
    table.addEventListener('dragstart', (e) => {
      const chip = Utils.targetEl(e).closest('.chip');
      if (!chip) return;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ courseId: chip.dataset.course, fromArea: chip.dataset.area }));
      chip.classList.add('dragging');
      document.body.classList.add('is-dragging');
    });
    table.addEventListener('dragend', (e) => {
      Utils.targetEl(e).closest('.chip')?.classList.remove('dragging');
      document.body.classList.remove('is-dragging');
      table.querySelectorAll('.drop-over').forEach((c) => c.classList.remove('drop-over'));
    });
    table.addEventListener('dragover', (e) => {
      const cell = Utils.targetEl(e).closest('td.pg-cell');
      if (!cell) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!cell.classList.contains('drop-over')) {
        table.querySelectorAll('.drop-over').forEach((c) => c.classList.remove('drop-over'));
        cell.classList.add('drop-over');
      }
    });
    table.addEventListener('dragleave', (e) => {
      const cell = Utils.targetEl(e).closest('td.pg-cell');
      if (cell && !cell.contains(e.relatedTarget)) cell.classList.remove('drop-over');
    });
    table.addEventListener('drop', (e) => {
      const cell = Utils.targetEl(e).closest('td.pg-cell');
      if (!cell) return;
      e.preventDefault();
      document.body.classList.remove('is-dragging');
      cell.classList.remove('drop-over');
      let payload;
      try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
      if (!payload?.courseId) return;
      this.safe(() => Store.dropCourse(payload.courseId, cell.dataset.sem, cell.dataset.area, payload.fromArea || null));
    });
  }

  renderEmpty() {
    if (!Store.university()) {
      this.empty.innerHTML = 'No university yet. <button data-action="manage-universities" class="primary">Add a university</button>';
    } else {
      this.empty.innerHTML = `No course plan for ${Utils.esc(Store.university().universityName)}. <button data-action="new-plan" class="primary">Create a plan</button>`;
    }
  }

  render() {
    const plan = Store.plan();
    this.el.hidden = !plan;
    this.empty.hidden = !!plan;
    if (!plan) { this.renderEmpty(); return; }

    const showNames = !!Store.state.ui.showNames;
    this.refs.showNames.checked = showNames;
    const cols = Utils.planSemesters(plan);
    const issues = Validation.validate(plan);
    const credits = (e) => Store.course(e.courseId)?.credits || 0;

    const hue = (area) => (plan.areasOfStudy.indexOf(area) * 47) % 360;
    const rows = plan.areasOfStudy.map((a) => ({ key: a, label: a, hue: hue(a) }));
    const validAreas = (e) => e.areas.filter((a) => plan.areasOfStudy.includes(a));
    // Each course is displayed once, in the row of its primary (first) area.
    const displayRow = (e) => validAreas(e)[0] || UNASSIGNED;
    if (plan.courseList.some((e) => displayRow(e) === UNASSIGNED)) {
      rows.push({ key: UNASSIGNED, label: 'Unassigned', special: true, hue: 0 });
    }
    const countsToward = (e, key) => (key === UNASSIGNED ? displayRow(e) === UNASSIGNED : e.areas.includes(key));

    let highlight = Store.state.ui.highlightArea || null;
    if (highlight && !rows.some((r) => r.key === highlight)) highlight = null;

    const semTotal = (sem) => plan.courseList.filter((e) => e.semester === sem).reduce((s, e) => s + credits(e), 0);
    const rowTotal = (key) => plan.courseList.filter((e) => countsToward(e, key)).reduce((s, e) => s + credits(e), 0);
    const sharedIn = (key) => plan.courseList.filter((e) => countsToward(e, key) && displayRow(e) !== key).length;
    const grand = plan.courseList.reduce((s, e) => s + credits(e), 0);
    const fc = Utils.formatCredits;

    const chip = (e) => {
      const c = Store.course(e.courseId);
      const msgs = issues.get(e.courseId) || [];
      const areas = validAreas(e);
      const others = areas.slice(1);
      const tip = [
        `${e.courseId}${c ? ` — ${c.name}` : ''}`,
        c ? `${fc(c.credits)} credits` : '',
        areas.length ? `Areas: ${areas.join(', ')}` : 'No area of study assigned',
        c?.prerequisites?.length ? `Prereqs: ${Utils.formatReqInline(c.prerequisites)}` : '',
        c?.corequisites?.length ? `Coreqs: ${Utils.formatReqInline(c.corequisites)}` : '',
        ...msgs.map((m) => `⚠ ${m}`),
      ].filter(Boolean).join('\n');
      return `
        <div class="chip ${msgs.length ? 'chip-warn' : ''} ${c ? '' : 'chip-unknown'}" draggable="true"
             data-action="edit-chip" data-course="${Utils.esc(e.courseId)}" data-area="${Utils.esc(displayRow(e))}" title="${Utils.esc(tip)}">
          <span class="chip-main">
            ${msgs.length ? '<span class="chip-icon">⚠</span>' : ''}
            <span class="chip-id">${Utils.esc(e.courseId)}</span>
            <span class="chip-cr">${c ? fc(c.credits) : '?'}</span>
          </span>
          ${others.length ? `<span class="chip-areas">${others.map((a) => `<span class="chip-area" style="--area-hue:${hue(a)}">${Utils.esc(a)}</span>`).join('')}</span>` : ''}
          ${showNames && c ? `<span class="chip-name">${Utils.esc(c.name)}</span>` : ''}
          <button class="chip-x" data-action="remove-chip" title="Remove from plan">×</button>
        </div>`;
    };

    const issueCount = issues.size;
    this.refs.stats.innerHTML = `
      <span class="pg-stat"><b>${fc(grand)}</b> total credits</span>
      <span class="pg-stat"><b>${plan.courseList.length}</b> courses</span>
      ${issueCount ? `<span class="pg-stat pg-stat-warn">⚠ <b>${issueCount}</b> requisite issue${issueCount > 1 ? 's' : ''}</span>` : '<span class="pg-stat pg-stat-ok">✓ requisites satisfied</span>'}`;

    const head = `
      <thead><tr>
        <th class="pg-corner"><div>Area of study</div><div class="pg-grand">${fc(grand)} cr</div></th>
        ${cols.map((c) => `
          <th class="pg-sem ${c.key === PRE_COLLEGE ? 'pg-pre' : ''} ${c.term ? `term-${c.term.toLowerCase()}` : ''} ${c.extra ? 'pg-extra' : ''}"
              ${c.extra ? 'title="Outside the configured semesters (or hidden term) but contains courses"' : ''}>
            <div class="pg-sem-label">${Utils.esc(c.label)}</div>
            <div class="pg-sem-total">${fc(semTotal(c.key))} cr</div>
          </th>`).join('')}
      </tr></thead>`;

    const body = rows.map((r) => {
      const shared = sharedIn(r.key);
      return `
      <tr class="${r.special ? 'pg-row-special' : ''}" style="--row-hue:${r.hue}">
        <th class="pg-area">
          <button class="pg-area-btn" data-action="highlight-area" data-area="${Utils.esc(r.key)}" aria-pressed="false">
            <span class="pg-area-icon">○</span>
            <span class="pg-area-name">${Utils.esc(r.label)}</span>
          </button>
          <span class="pg-area-total" title="${shared ? `Includes ${shared} course(s) displayed in another row` : ''}">${fc(rowTotal(r.key))}${shared ? '<sup>*</sup>' : ''}</span>
        </th>
        ${cols.map((c) => {
          const entries = plan.courseList.filter((e) => e.semester === c.key && displayRow(e) === r.key);
          return `<td class="pg-cell ${c.key === PRE_COLLEGE ? 'pg-pre' : ''}" data-sem="${Utils.esc(c.key)}" data-area="${Utils.esc(r.key)}">
            ${entries.map((e) => chip(e)).join('')}
            <button class="pg-cell-add" data-action="add-in-cell" title="Add a course to ${Utils.esc(r.label)} · ${Utils.esc(c.label)}">+</button>
          </td>`;
        }).join('')}
      </tr>`;
    }).join('');

    const hlCount = highlight ? plan.courseList.filter((e) => countsToward(e, highlight)).length : 0;
    this.refs.highlight.hidden = !highlight;
    this.refs.highlight.innerHTML = highlight
      ? `Highlighting <b>${Utils.esc(highlight === UNASSIGNED ? 'Unassigned' : highlight)}</b>: ${hlCount} course(s), ${fc(rowTotal(highlight))} cr
         <button class="icon" data-action="clear-highlight" title="Clear highlight (Esc)">✕</button>`
      : '';

    const markup = head + `<tbody>${body || `<tr><td class="muted" colspan="${cols.length + 1}">Add areas of study in Plan settings.</td></tr>`}</tbody>`;
    // Keep the existing cells when only the selected area changes.
    if (this.tableMarkup !== markup) {
      this.refs.table.innerHTML = markup;
      this.tableMarkup = markup;
    }

    const entries = new Map(plan.courseList.map((e) => [e.courseId, e]));
    this.refs.table.querySelectorAll('.chip').forEach((el) => {
      const matches = !!highlight && countsToward(entries.get(el.dataset.course), highlight);
      el.classList.toggle('chip-hl', matches);
      el.classList.toggle('chip-dim', !!highlight && !matches);
    });
    this.refs.table.querySelectorAll('.pg-area-btn').forEach((button) => {
      const active = button.dataset.area === highlight;
      const label = button.querySelector('.pg-area-name').textContent;
      button.setAttribute('aria-pressed', String(active));
      button.title = active ? 'Clear highlight' : `Highlight all courses counting toward ${label}`;
      button.querySelector('.pg-area-icon').textContent = active ? '◉' : '○';
      button.closest('tr').classList.toggle('pg-row-hl', active);
    });
  }
};
