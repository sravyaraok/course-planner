/*
 * Application state, persisted to localStorage.
 *   courses       – shared course catalog (Course objects)
 *   universities  – rosters: { universityId, universityName, courses: [courseId] }
 *   plans         – CoursePlan objects
 *   ui            – current selection and view preferences
 */
const Store = (() => {
  const STORAGE_KEY = 'course-planner:v1';
  const listeners = new Set();
  let state = null;

  function normalizeCourse(c) {
    return {
      id: String(c.id).trim(),
      name: c.name || '',
      description: c.description || '',
      prerequisites: (c.prerequisites || []).map((s) => [...s]),
      corequisites: (c.corequisites || []).map((s) => [...s]),
      credits: Number(c.credits) || 0,
    };
  }

  function normalizePlan(p) {
    return {
      planId: p.planId || Utils.uid('plan'),
      planName: p.planName || 'Untitled plan',
      universityId: p.universityId || null,
      startSemester: p.startSemester || `Fall ${new Date().getFullYear()}`,
      years: Number(p.years) || 4,
      showWinter: !!p.showWinter,
      showSummer: !!p.showSummer,
      areasOfStudy: [...(p.areasOfStudy || DEFAULT_AREAS)],
      courseList: (p.courseList || []).map((e) => ({
        courseId: e.courseId,
        semester: e.semester || PRE_COLLEGE,
        areas: [...new Set(e.areas || [])],
      })),
    };
  }

  function normalizeUniversity(u) {
    return {
      universityId: String(u.universityId).trim(),
      universityName: u.universityName || u.universityId,
      courses: [...new Set((u.courses || []).map((c) => (typeof c === 'string' ? c : c.id)))],
    };
  }

  function emptyState() {
    return { courses: [], universities: [], plans: [], ui: { showNames: false, settingsOpen: false } };
  }

  function fixUi() {
    const ui = state.ui;
    if (!state.universities.some((u) => u.universityId === ui.universityId)) {
      ui.universityId = state.universities[0]?.universityId || null;
    }
    const plans = state.plans.filter((p) => p.universityId === ui.universityId);
    if (!plans.some((p) => p.planId === ui.planId)) ui.planId = plans[0]?.planId || null;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Could not persist state', err);
    }
  }

  function commit() {
    fixUi();
    save();
    listeners.forEach((fn) => fn(state));
  }

  function upsert(list, key, item) {
    const i = list.findIndex((x) => x[key] === item[key]);
    if (i >= 0) list[i] = item; else list.push(item);
  }

  /** Accepts a workspace, a single plan, a university roster, or a course array. */
  function mergeData(data) {
    const counts = { courses: 0, universities: 0, plans: 0 };
    const addCourses = (arr) => (arr || []).forEach((c) => {
      if (c && typeof c === 'object' && c.id) { upsert(state.courses, 'id', normalizeCourse(c)); counts.courses++; }
    });
    const addUniversity = (u) => {
      addCourses(u.courseCatalog);
      addCourses((u.courses || []).filter((c) => typeof c === 'object'));
      upsert(state.universities, 'universityId', normalizeUniversity(u));
      counts.universities++;
    };
    const addPlan = (p) => { upsert(state.plans, 'planId', normalizePlan(p)); counts.plans++; };

    if (Array.isArray(data)) {
      addCourses(data);
    } else if (data && (data.plans || data.universities || Array.isArray(data.courses) && !data.universityId)) {
      addCourses(data.courses);
      (data.universities || []).forEach(addUniversity);
      (data.plans || []).forEach(addPlan);
    } else if (data && data.planId && data.courseList) {
      addPlan(data);
    } else if (data && data.universityId) {
      addUniversity(data);
    } else {
      throw new Error('Unrecognized JSON format');
    }
    return counts;
  }

  function referencedCourseIds() {
    return new Set(state.universities.flatMap((u) => u.courses));
  }

  function pruneOrphanCourses() {
    const used = referencedCourseIds();
    state.courses = state.courses.filter((c) => used.has(c.id));
  }

  function plan() {
    return state.plans.find((p) => p.planId === state.ui.planId) || null;
  }

  function requirePlan() {
    const p = plan();
    if (!p) throw new Error('No plan selected');
    return p;
  }

  const api = {
    load() {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* ignore */ }
      state = emptyState();
      if (saved && Array.isArray(saved.courses)) {
        mergeData({ courses: saved.courses, universities: saved.universities, plans: saved.plans });
        state.ui = { ...state.ui, ...(saved.ui || {}) };
      } else {
        mergeData(Utils.clone(window.SAMPLE_DATA || {}));
      }
      fixUi();
      save();
    },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get state() { return state; },

    course(id) { return state.courses.find((c) => c.id === id) || null; },
    university(id = state.ui.universityId) { return state.universities.find((u) => u.universityId === id) || null; },
    plan,
    plansForUniversity(id = state.ui.universityId) { return state.plans.filter((p) => p.universityId === id); },
    rosterCourses(id = state.ui.universityId) {
      const u = api.university(id);
      return u ? u.courses.map((cid) => api.course(cid)).filter(Boolean) : [];
    },

    /* ---------- UI ---------- */
    setUi(patch) { Object.assign(state.ui, patch); commit(); },
    selectUniversity(id) { state.ui.universityId = id; state.ui.planId = null; commit(); },
    selectPlan(id) { state.ui.planId = id; commit(); },

    /* ---------- Universities ---------- */
    saveUniversity({ universityId, universityName }, originalId = null) {
      const id = String(universityId || '').trim();
      if (!id) throw new Error('University ID is required');
      if (!String(universityName || '').trim()) throw new Error('University name is required');
      const clash = state.universities.find((u) => u.universityId === id);
      if (originalId) {
        const u = api.university(originalId);
        if (!u) throw new Error('University not found');
        if (clash && clash !== u) throw new Error(`University ID "${id}" already exists`);
        u.universityId = id;
        u.universityName = universityName.trim();
        state.plans.forEach((p) => { if (p.universityId === originalId) p.universityId = id; });
        if (state.ui.universityId === originalId) state.ui.universityId = id;
      } else {
        if (clash) throw new Error(`University ID "${id}" already exists`);
        state.universities.push({ universityId: id, universityName: universityName.trim(), courses: [] });
        state.ui.universityId = id;
        state.ui.planId = null;
      }
      commit();
    },

    deleteUniversity(id) {
      state.universities = state.universities.filter((u) => u.universityId !== id);
      state.plans = state.plans.filter((p) => p.universityId !== id);
      pruneOrphanCourses();
      commit();
    },

    /* ---------- Courses ---------- */
    saveCourse(input, originalId = null, universityId = state.ui.universityId) {
      const course = normalizeCourse({ ...input, id: String(input.id || '').trim() });
      if (!course.id) throw new Error('Course ID is required');
      if (!course.name.trim()) throw new Error('Course name is required');
      if (course.credits < 0) throw new Error('Credits cannot be negative');
      const uni = api.university(universityId);
      if (!uni) throw new Error('Select a university first');

      if (originalId && originalId !== course.id) {
        if (api.course(course.id)) throw new Error(`Course ID "${course.id}" already exists`);
        const rename = (x) => (x === originalId ? course.id : x);
        state.universities.forEach((u) => { u.courses = u.courses.map(rename); });
        state.courses.forEach((c) => {
          c.prerequisites = c.prerequisites.map((s) => s.map(rename));
          c.corequisites = c.corequisites.map((s) => s.map(rename));
        });
        state.plans.forEach((p) => p.courseList.forEach((e) => { e.courseId = rename(e.courseId); }));
        state.courses = state.courses.filter((c) => c.id !== originalId);
      } else if (!originalId && uni.courses.includes(course.id)) {
        throw new Error(`Course "${course.id}" is already in this university's roster`);
      }
      upsert(state.courses, 'id', course);
      if (!uni.courses.includes(course.id)) uni.courses.push(course.id);
      commit();
      return course;
    },

    deleteCourse(id, universityId = state.ui.universityId) {
      const uni = api.university(universityId);
      if (uni) uni.courses = uni.courses.filter((c) => c !== id);
      state.plans.forEach((p) => {
        if (p.universityId === universityId) p.courseList = p.courseList.filter((e) => e.courseId !== id);
      });
      pruneOrphanCourses();
      commit();
    },

    /* ---------- Plans ---------- */
    createPlan({ planName, startSemester, areasOfStudy } = {}) {
      if (!state.ui.universityId) throw new Error('Create a university first');
      const p = normalizePlan({
        planName: planName || 'New Plan',
        universityId: state.ui.universityId,
        startSemester,
        areasOfStudy: areasOfStudy || DEFAULT_AREAS,
      });
      state.plans.push(p);
      state.ui.planId = p.planId;
      state.ui.settingsOpen = true;
      commit();
      return p;
    },

    duplicatePlan() {
      const src = requirePlan();
      const copy = normalizePlan({ ...Utils.clone(src), planId: null, planName: `${src.planName} (copy)` });
      state.plans.push(copy);
      state.ui.planId = copy.planId;
      commit();
    },

    deletePlan(id = state.ui.planId) {
      state.plans = state.plans.filter((p) => p.planId !== id);
      commit();
    },

    updatePlan(patch) {
      Object.assign(requirePlan(), patch);
      commit();
    },

    addArea(name) {
      const p = requirePlan();
      const n = String(name || '').trim();
      if (!n) throw new Error('Area name is required');
      if (p.areasOfStudy.includes(n)) throw new Error(`Area "${n}" already exists`);
      p.areasOfStudy.push(n);
      commit();
    },

    renameArea(oldName, newName) {
      const p = requirePlan();
      const n = String(newName || '').trim();
      if (!n || n === oldName) return;
      if (p.areasOfStudy.includes(n)) throw new Error(`Area "${n}" already exists`);
      p.areasOfStudy = p.areasOfStudy.map((a) => (a === oldName ? n : a));
      p.courseList.forEach((e) => { e.areas = e.areas.map((a) => (a === oldName ? n : a)); });
      if (state.ui.highlightArea === oldName) state.ui.highlightArea = n;
      commit();
    },

    deleteArea(name) {
      const p = requirePlan();
      p.areasOfStudy = p.areasOfStudy.filter((a) => a !== name);
      p.courseList.forEach((e) => { e.areas = e.areas.filter((a) => a !== name); });
      if (state.ui.highlightArea === name) state.ui.highlightArea = null;
      commit();
    },

    moveArea(name, delta) {
      const p = requirePlan();
      const i = p.areasOfStudy.indexOf(name);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= p.areasOfStudy.length) return;
      [p.areasOfStudy[i], p.areasOfStudy[j]] = [p.areasOfStudy[j], p.areasOfStudy[i]];
      commit();
    },

    /* ---------- Plan entries ---------- */
    entry(courseId) {
      return plan()?.courseList.find((e) => e.courseId === courseId) || null;
    },

    saveEntry({ courseId, semester, areas, primaryArea = null }) {
      const p = requirePlan();
      if (!api.course(courseId)) throw new Error(`Unknown course "${courseId}"`);
      let cleanAreas = [...new Set(areas || [])].filter((a) => p.areasOfStudy.includes(a));
      const existing = p.courseList.find((e) => e.courseId === courseId);
      if (existing) {
        // Preserve the existing order (the first area is the row the course is shown in).
        const kept = existing.areas.filter((a) => cleanAreas.includes(a));
        cleanAreas = [...kept, ...cleanAreas.filter((a) => !kept.includes(a))];
      }
      if (primaryArea && cleanAreas.includes(primaryArea)) {
        cleanAreas = [primaryArea, ...cleanAreas.filter((a) => a !== primaryArea)];
      }
      if (existing) {
        existing.semester = semester;
        existing.areas = cleanAreas;
      } else {
        p.courseList.push({ courseId, semester, areas: cleanAreas });
      }
      commit();
    },

    removeEntry(courseId) {
      const p = requirePlan();
      p.courseList = p.courseList.filter((e) => e.courseId !== courseId);
      commit();
    },

    /**
     * Drag & drop: move to a semester. Dropping on another row makes that area the
     * primary (displayed) area: kept if already assigned, otherwise it replaces fromArea.
     */
    dropCourse(courseId, semester, toArea, fromArea = null) {
      const p = requirePlan();
      if (!api.course(courseId)) throw new Error(`Unknown course "${courseId}"`);
      let e = p.courseList.find((x) => x.courseId === courseId);
      if (!e) {
        e = { courseId, semester, areas: [] };
        p.courseList.push(e);
      }
      e.semester = semester;
      if (toArea && toArea !== fromArea) {
        if (toArea === UNASSIGNED) {
          e.areas = e.areas.filter((a) => !p.areasOfStudy.includes(a));
        } else {
          const rest = e.areas.filter((a) => a !== toArea && !(a === fromArea && !e.areas.includes(toArea)));
          e.areas = [toArea, ...rest];
        }
      }
      commit();
    },

    /* ---------- Import / export ---------- */
    importData(data) {
      const counts = mergeData(data);
      if (data && data.planId && state.plans.some((p) => p.planId === data.planId)) {
        state.ui.universityId = data.universityId;
        state.ui.planId = data.planId;
      } else if (data && data.universityId && !data.planId) {
        state.ui.universityId = data.universityId;
      }
      commit();
      return counts;
    },

    exportWorkspace() {
      const { courses, universities, plans } = Utils.clone(state);
      return { courses, universities, plans };
    },

    exportUniversity(id = state.ui.universityId) {
      const u = api.university(id);
      if (!u) throw new Error('No university selected');
      return { ...Utils.clone(u), courseCatalog: Utils.clone(api.rosterCourses(id)) };
    },

    exportPlan() {
      return Utils.clone(requirePlan());
    },

    resetToSample() {
      const ui = { showNames: state.ui.showNames };
      state = emptyState();
      Object.assign(state.ui, ui);
      mergeData(Utils.clone(window.SAMPLE_DATA || {}));
      commit();
    },
  };
  return api;
})();
