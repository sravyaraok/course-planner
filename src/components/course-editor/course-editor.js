/* Modal for creating / editing a course in the current university's roster. */
window.Components['course-editor'] = class CourseEditor {
  constructor(host) {
    this.el = Utils.template('course-editor');
    host.replaceWith(this.el);
    this.refs = Utils.refs(this.el);
    this.originalId = null;

    Bus.on('edit-course', ({ courseId, presetId } = {}) => this.open(courseId, presetId));
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="cancel"]')) this.el.close();
    });
    this.refs.form.addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
    ['prerequisites', 'corequisites'].forEach((k) => this.refs[k].addEventListener('input', () => this.checkUnknown()));
  }

  open(courseId = null, presetId = '') {
    if (!Store.university()) { Utils.toast('Create a university first', 'error'); return; }
    const c = courseId ? Store.course(courseId) : null;
    this.originalId = c ? c.id : null;
    const r = this.refs;
    r.title.textContent = c ? `Edit course ${c.id}` : `New course · ${Store.university().universityName}`;
    r.id.value = c?.id || presetId || '';
    r.name.value = c?.name || '';
    r.credits.value = c ? c.credits : 3;
    r.description.value = c?.description || '';
    r.prerequisites.value = Utils.formatReqText(c?.prerequisites);
    r.corequisites.value = Utils.formatReqText(c?.corequisites);
    r.error.textContent = '';
    this.checkUnknown();
    this.el.showModal();
    (c ? r.name : r.id).focus();
  }

  checkUnknown() {
    const ids = [
      ...Utils.parseReqText(this.refs.prerequisites.value),
      ...Utils.parseReqText(this.refs.corequisites.value),
    ].flat();
    const unknown = [...new Set(ids)].filter((id) => !Store.course(id));
    this.refs.unknown.textContent = unknown.length ? `Note: not in catalog yet — ${unknown.join(', ')}` : '';
  }

  save() {
    const r = this.refs;
    try {
      const course = Store.saveCourse({
        id: r.id.value,
        name: r.name.value,
        credits: parseFloat(r.credits.value),
        description: r.description.value.trim(),
        prerequisites: Utils.parseReqText(r.prerequisites.value),
        corequisites: Utils.parseReqText(r.corequisites.value),
      }, this.originalId);
      this.el.close();
      Utils.toast(`Saved ${course.id}`, 'success');
    } catch (err) {
      r.error.textContent = err.message;
    }
  }
};
