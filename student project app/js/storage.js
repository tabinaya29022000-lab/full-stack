(function (global) {
  var MGI = global.MGI || {};
  var keys = null;

  function k() {
    keys = keys || MGI.config.storageKeys;
    return keys;
  }

  function backupCorrupt(key, raw) {
    try {
      localStorage.setItem(key + "_corrupt_backup", raw);
    } catch (e) {
      /* ignore secondary quota issues */
    }
  }

  function requiredString(rec, field) {
    return rec && typeof rec[field] === "string" && rec[field].trim() !== "";
  }

  function validateStudent(rec, seen) {
    if (!rec || typeof rec !== "object") return "not an object";
    if (!requiredString(rec, "id")) return "missing id";
    if (seen.ids[rec.id]) return "duplicate id";
    if (!requiredString(rec, "studentCode")) return "missing studentCode";
    if (seen.codes[MGI.utils.normalizeId(rec.studentCode)]) return "duplicate studentCode";
    if (!requiredString(rec, "fullName")) return "missing fullName";
    if (!requiredString(rec, "phone")) return "missing phone";
    if (!requiredString(rec, "course")) return "missing course";
    if (!requiredString(rec, "batch")) return "missing batch";
    if (!MGI.utils.isValidDate(rec.joiningDate)) return "invalid joiningDate";
    if (MGI.config.studentStatuses.indexOf(rec.status) === -1) return "invalid status";
    if (typeof rec.courseProgress !== "number" || rec.courseProgress < 0 || rec.courseProgress > 100) {
      return "invalid courseProgress";
    }
    seen.ids[rec.id] = true;
    seen.codes[MGI.utils.normalizeId(rec.studentCode)] = true;
    return null;
  }

  function validateAttendance(rec, studentIds, seen) {
    if (!rec || typeof rec !== "object") return "not an object";
    if (!requiredString(rec, "id")) return "missing id";
    if (!requiredString(rec, "studentId")) return "missing studentId";
    if (!studentIds[rec.studentId]) return "unknown student";
    if (!MGI.utils.isValidDate(rec.date)) return "invalid date";
    if (MGI.config.attendanceStatuses.indexOf(rec.status) === -1) return "invalid status";
    var pair = rec.studentId + "|" + rec.date;
    if (seen[pair]) return "duplicate student/date";
    seen[pair] = true;
    return null;
  }

  function validateTask(rec, studentIds) {
    if (!rec || typeof rec !== "object") return "not an object";
    if (!requiredString(rec, "id")) return "missing id";
    if (!requiredString(rec, "studentId")) return "missing studentId";
    if (!studentIds[rec.studentId]) return "unknown student";
    if (!requiredString(rec, "title")) return "missing title";
    if (!MGI.utils.isValidDate(rec.assignedDate) || !MGI.utils.isValidDate(rec.dueDate)) return "invalid dates";
    if (MGI.config.taskStatuses.indexOf(rec.status) === -1) return "invalid status";
    return null;
  }

  function validateActivity(rec, studentIds) {
    if (!rec || typeof rec !== "object") return "not an object";
    if (!requiredString(rec, "id")) return "missing id";
    if (!requiredString(rec, "studentId")) return "missing studentId";
    if (!studentIds[rec.studentId]) return "unknown student";
    if (!MGI.utils.isValidDate(rec.date)) return "invalid date";
    if (MGI.config.activityTypes.indexOf(rec.type) === -1) return "invalid type";
    if (!requiredString(rec, "category") || !requiredString(rec, "description")) return "missing fields";
    if (typeof rec.points !== "number" || rec.points < 1 || rec.points > 100 || rec.points % 1 !== 0) {
      return "invalid points";
    }
    return null;
  }

  function readRaw(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function parseArray(key) {
    var raw = readRaw(key);
    if (raw === null) {
      return { ok: true, data: [], skipped: 0, corrupt: false, warning: null };
    }
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return {
          ok: true,
          data: [],
          skipped: 0,
          corrupt: false,
          warning: key + " was valid JSON but not an array. An empty list is being used."
        };
      }
      return { ok: true, data: parsed, skipped: 0, corrupt: false, warning: null };
    } catch (e) {
      backupCorrupt(key, raw);
      return {
        ok: false,
        data: [],
        skipped: 0,
        corrupt: true,
        warning:
          "Stored data for " +
          key +
          " is invalid JSON. The original text was kept under " +
          key +
          "_corrupt_backup. You can start with empty data or load sample data."
      };
    }
  }

  function persistKey(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  MGI.storage = {
    emptyState: function () {
      return {
        students: [],
        attendance: [],
        tasks: [],
        activities: [],
        meta: { schemaVersion: MGI.config.schemaVersion, welcomeShown: false }
      };
    },

    load: function () {
      var warnings = [];
      var recovery = [];
      var studentsRes = parseArray(k().students);
      var attendanceRes = parseArray(k().attendance);
      var tasksRes = parseArray(k().tasks);
      var activitiesRes = parseArray(k().activities);
      [studentsRes, attendanceRes, tasksRes, activitiesRes].forEach(function (res) {
        if (res.warning) warnings.push(res.warning);
        if (res.corrupt) recovery.push(res);
      });

      var meta = { schemaVersion: MGI.config.schemaVersion, welcomeShown: false };
      var metaRaw = readRaw(k().meta);
      if (metaRaw !== null) {
        try {
          var parsedMeta = JSON.parse(metaRaw);
          if (parsedMeta && typeof parsedMeta === "object" && !Array.isArray(parsedMeta)) {
            meta = parsedMeta;
            if (typeof meta.schemaVersion !== "number") meta.schemaVersion = MGI.config.schemaVersion;
          } else {
            warnings.push("Settings data was the wrong type and was reset.");
          }
        } catch (e) {
          backupCorrupt(k().meta, metaRaw);
          warnings.push("Settings JSON was invalid. Defaults are being used. Original text was backed up.");
          recovery.push({ corrupt: true });
        }
      }

      var seen = { ids: {}, codes: {} };
      var students = [];
      var skipped = 0;
      studentsRes.data.forEach(function (rec) {
        var err = validateStudent(rec, seen);
        if (err) skipped += 1;
        else students.push(rec);
      });

      var studentIds = {};
      students.forEach(function (s) {
        studentIds[s.id] = true;
      });

      var attSeen = {};
      var attendance = [];
      attendanceRes.data.forEach(function (rec) {
        var err = validateAttendance(rec, studentIds, attSeen);
        if (err) skipped += 1;
        else attendance.push(rec);
      });

      var tasks = [];
      tasksRes.data.forEach(function (rec) {
        if (validateTask(rec, studentIds)) skipped += 1;
        else tasks.push(rec);
      });

      var activities = [];
      activitiesRes.data.forEach(function (rec) {
        if (validateActivity(rec, studentIds)) skipped += 1;
        else activities.push(rec);
      });

      if (skipped) {
        warnings.push(
          skipped +
            " stored record(s) were skipped because they were invalid or referred to a missing student. Calculations ignore them."
        );
      }

      return {
        state: { students: students, attendance: attendance, tasks: tasks, activities: activities, meta: meta },
        warnings: warnings,
        needsRecovery: recovery.length > 0
      };
    },

    saveState: function (state) {
      persistKey(k().students, state.students);
      persistKey(k().attendance, state.attendance);
      persistKey(k().tasks, state.tasks);
      persistKey(k().activities, state.activities);
      persistKey(k().meta, state.meta || { schemaVersion: MGI.config.schemaVersion });
    },

    commit: function (mutator) {
      var snapshot = MGI.utils.clone(MGI.state);
      try {
        mutator(MGI.state);
        this.saveState(MGI.state);
        return { ok: true };
      } catch (e) {
        MGI.state = snapshot;
        try {
          this.saveState(snapshot);
        } catch (ignore) {
          MGI.state = snapshot;
        }
        var quota = e && (e.name === "QuotaExceededError" || e.code === 22 || /quota/i.test(String(e)));
        return {
          ok: false,
          quota: quota,
          error: e,
          message: quota
            ? "Browser storage is full. The change was not saved. Remove profile photos, delete old records, or export a backup, then try again."
            : "The data could not be saved. Existing records were left unchanged."
        };
      }
    },

    clearAll: function () {
      Object.keys(k()).forEach(function (name) {
        localStorage.removeItem(k()[name]);
      });
      MGI.state = this.emptyState();
      this.saveState(MGI.state);
    },

    exportBackup: function () {
      return {
        schemaVersion: MGI.config.schemaVersion,
        exportedAt: MGI.utils.nowIso(),
        students: MGI.state.students,
        attendance: MGI.state.attendance,
        tasks: MGI.state.tasks,
        activities: MGI.state.activities,
        meta: MGI.state.meta
      };
    },

    validateBackup: function (data) {
      if (!data || typeof data !== "object") return "Backup file is not a JSON object.";
      if (typeof data.schemaVersion !== "number") return "Backup is missing a schema version.";
      ["students", "attendance", "tasks", "activities"].forEach(function (key) {
        if (data[key] && !Array.isArray(data[key])) throw new Error(key + " must be an array.");
      });
      return null;
    },

    estimateUsage: function () {
      var total = 0;
      Object.keys(k()).forEach(function (name) {
        var raw = readRaw(k()[name]);
        if (raw) total += raw.length * 2;
      });
      return { bytes: total, limit: 5 * 1024 * 1024 };
    },

    loadUi: function () {
      try {
        var raw = sessionStorage.getItem(MGI.config.uiSessionKey);
        if (!raw) return {};
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (e) {
        return {};
      }
    },

    saveUi: function (ui) {
      try {
        sessionStorage.setItem(MGI.config.uiSessionKey, JSON.stringify(ui));
      } catch (e) {
        /* ignore */
      }
    }
  };

  global.MGI = MGI;
})(window);
