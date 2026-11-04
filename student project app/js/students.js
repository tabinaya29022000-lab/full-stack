(function (global) {
  var MGI = global.MGI || {};
  var pendingPhoto = null;
  var removePhoto = false;

  function findByCode(code, exceptId) {
    var n = MGI.utils.normalizeId(code);
    return MGI.state.students.find(function (s) {
      return MGI.utils.normalizeId(s.studentCode) === n && s.id !== exceptId;
    });
  }

  function processImage(file) {
    return new Promise(function (resolve, reject) {
      var ext = (file.name.split(".").pop() || "").toLowerCase();
      var okExt = ["jpg", "jpeg", "png", "webp"];
      var okMime = ["image/jpeg", "image/png", "image/webp"];
      if (okExt.indexOf(ext) === -1 || okMime.indexOf(file.type) === -1) {
        reject(new Error("Please choose a JPEG, PNG or WebP image."));
        return;
      }
      if (file.size > MGI.config.maxImageBytes) {
        reject(new Error("File is " + (file.size / 1024 / 1024).toFixed(1) + " MB. Maximum is 2 MB."));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var max = MGI.config.imageMaxSize;
          var scale = Math.min(1, max / img.width, max / img.height);
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          var dataUrl = canvas.toDataURL("image/jpeg", MGI.config.imageQuality);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(new Error("The file could not be processed as an image."));
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("This file could not be decoded as an image. Accepted formats: JPEG, PNG, WebP."));
      };
      img.src = url;
    });
  }

  function validateStudentForm(data, editingId) {
    var errors = {};
    var code = MGI.utils.trim(data.studentCode);
    var name = MGI.utils.trim(data.fullName);
    var phone = MGI.utils.trim(data.phone).replace(/\s+/g, "");
    var email = MGI.utils.trim(data.email);
    var batch = MGI.utils.trim(data.batch);
    var address = MGI.utils.trim(data.address);
    if (!code) errors.studentCode = "Student ID is required.";
    else if (findByCode(code, editingId)) errors.studentCode = "This Student ID is already in use";
    if (!name) errors.fullName = "Full name is required.";
    else if (name.length < 2 || name.length > 60 || !MGI.config.namePattern.test(name)) {
      errors.fullName = "Name must be 2–60 characters using letters, spaces, apostrophe, hyphen or full stop.";
    }
    if (!phone) errors.phone = "Phone is required.";
    else if (!MGI.config.phonePattern.test(phone)) errors.phone = "Phone must be 10–15 digits with an optional leading +.";
    if (email && !MGI.config.emailPattern.test(email)) errors.email = "Enter a valid email address.";
    if (!data.course) errors.course = "Course is required.";
    if (!batch) errors.batch = "Batch is required.";
    else if (batch.length < 2 || batch.length > 30) errors.batch = "Batch must be 2–30 characters.";
    if (!data.joiningDate) errors.joiningDate = "Joining date is required.";
    else if (!MGI.utils.isValidDate(data.joiningDate)) errors.joiningDate = "Enter a valid calendar date.";
    if (address.length > 200) errors.address = "Address must be 200 characters or fewer.";
    var progress = Number(data.courseProgress);
    if (Number.isNaN(progress) || progress < 0 || progress > 100 || progress % 1 !== 0) {
      errors.courseProgress = "Course progress must be a whole number from 0 to 100.";
    }
    return errors;
  }

  function applyFieldErrors(prefix, errors, order) {
    var first = null;
    order.forEach(function (name) {
      var input = MGI.utils.byId(prefix + name);
      MGI.ui.setFieldError(input, errors[name] || "");
      if (errors[name] && !first) first = input;
    });
    if (first) first.focus();
    return first;
  }

  function relatedCounts(id) {
    return {
      attendance: MGI.state.attendance.filter(function (r) { return r.studentId === id; }).length,
      tasks: MGI.state.tasks.filter(function (r) { return r.studentId === id; }).length,
      activities: MGI.state.activities.filter(function (r) { return r.studentId === id; }).length
    };
  }

  function saveStudent(record, isNew, withoutPhoto) {
    var result = MGI.storage.commit(function (state) {
      if (withoutPhoto) record.photo = null;
      if (isNew) state.students.push(record);
      else {
        var idx = state.students.findIndex(function (s) { return s.id === record.id; });
        if (idx !== -1) state.students[idx] = record;
      }
    });
    if (!result.ok && result.quota && record.photo && !withoutPhoto) {
      return { ok: false, quotaPhoto: true, message: result.message };
    }
    return result;
  }

  function filteredStudents() {
    var ui = MGI.uiState;
    var q = MGI.utils.trim(ui.studentSearch || "").toLowerCase();
    return MGI.state.students.filter(function (s) {
      if (ui.courseFilter && s.course !== ui.courseFilter) return false;
      if (ui.batchFilter && s.batch !== ui.batchFilter) return false;
      if (ui.statusFilter && s.status !== ui.statusFilter) return false;
      if (!q) return true;
      return s.fullName.toLowerCase().indexOf(q) !== -1 || s.studentCode.toLowerCase().indexOf(q) !== -1;
    });
  }

  function sortStudents(list) {
    var key = MGI.uiState.studentSort || "fullName";
    var dir = MGI.uiState.studentDir === "desc" ? -1 : 1;
    return list.slice().sort(function (a, b) {
      var av = a[key] || "";
      var bv = b[key] || "";
      return av < bv ? -1 * dir : av > bv ? dir : 0;
    });
  }

  MGI.students = {
    processImage: processImage,
    findByCode: findByCode,
    relatedCounts: relatedCounts,

    setPendingPhoto: function (dataUrl) {
      pendingPhoto = dataUrl;
      removePhoto = dataUrl === null;
      MGI.students.refreshPreview();
    },

    openForm: function (student) {
      var form = MGI.utils.byId("student-form");
      MGI.ui.clearFormErrors(form);
      pendingPhoto = student && student.photo ? student.photo : null;
      removePhoto = false;
      form.reset();
      MGI.utils.byId("save-without-photo").hidden = true;
      MGI.utils.byId("stu-photo-error").textContent = "";
      MGI.utils.byId("student-editing-id").value = student ? student.id : "";
      MGI.utils.byId("student-form-title").textContent = student ? "Edit student" : "Add student";
      MGI.ui.fillSelect(
        MGI.utils.byId("stu-course"),
        MGI.config.courses.map(function (c) { return { value: c, label: c }; }),
        student ? student.course : MGI.config.courses[0]
      );
      MGI.ui.fillSelect(
        MGI.utils.byId("stu-status"),
        MGI.config.studentStatuses.map(function (c) { return { value: c, label: c }; }),
        student ? student.status : "Active"
      );
      ["studentCode", "fullName", "phone", "email", "address", "batch", "joiningDate", "courseProgress"].forEach(function (f) {
        var map = {
          studentCode: "stu-code",
          fullName: "stu-name",
          phone: "stu-phone",
          email: "stu-email",
          address: "stu-address",
          batch: "stu-batch",
          joiningDate: "stu-join",
          courseProgress: "stu-progress"
        };
        if (student) MGI.utils.byId(map[f]).value = student[f] == null ? "" : student[f];
      });
      if (!student) {
        MGI.utils.byId("stu-join").value = MGI.utils.today();
        MGI.utils.byId("stu-progress").value = "0";
      }
      MGI.students.refreshPreview(student);
      MGI.ui.openDialog("student-dialog");
    },

    refreshPreview: function (student) {
      var box = MGI.utils.byId("photo-preview");
      MGI.utils.clear(box);
      var rec = { fullName: MGI.utils.byId("stu-name").value || (student && student.fullName) || "Student", photo: removePhoto ? null : pendingPhoto };
      box.appendChild(MGI.ui.avatar(rec, "lg"));
    },

    submitForm: function () {
      var editingId = MGI.utils.byId("student-editing-id").value || null;
      var existing = editingId ? MGI.state.students.find(function (s) { return s.id === editingId; }) : null;
      var data = {
        studentCode: MGI.utils.byId("stu-code").value,
        fullName: MGI.utils.byId("stu-name").value,
        phone: MGI.utils.byId("stu-phone").value,
        email: MGI.utils.byId("stu-email").value,
        address: MGI.utils.byId("stu-address").value,
        course: MGI.utils.byId("stu-course").value,
        batch: MGI.utils.byId("stu-batch").value,
        joiningDate: MGI.utils.byId("stu-join").value,
        status: MGI.utils.byId("stu-status").value,
        courseProgress: MGI.utils.byId("stu-progress").value
      };
      var errors = validateStudentForm(data, editingId);
      var first = applyFieldErrors("stu-", {
        studentCode: errors.studentCode,
        fullName: errors.fullName,
        phone: errors.phone,
        email: errors.email,
        course: errors.course,
        batch: errors.batch,
        joiningDate: errors.joiningDate,
        address: errors.address,
        courseProgress: errors.courseProgress
      }, ["code", "name", "phone", "email", "course", "batch", "join", "address", "progress"].map(function () { return ""; }));
      var map = {
        studentCode: "code",
        fullName: "name",
        phone: "phone",
        email: "email",
        course: "course",
        batch: "batch",
        joiningDate: "join",
        address: "address",
        courseProgress: "progress"
      };
      MGI.ui.clearFormErrors(MGI.utils.byId("student-form"));
      first = null;
      Object.keys(map).forEach(function (field) {
        var input = MGI.utils.byId("stu-" + map[field]);
        MGI.ui.setFieldError(input, errors[field] || "");
        if (errors[field] && !first) first = input;
      });
      if (first) {
        first.focus();
        return;
      }
      var now = MGI.utils.nowIso();
      var record = {
        id: existing ? existing.id : MGI.utils.uuid(),
        studentCode: MGI.utils.trim(data.studentCode),
        fullName: MGI.utils.trim(data.fullName),
        phone: MGI.utils.trim(data.phone).replace(/\s+/g, ""),
        email: MGI.utils.trim(data.email),
        address: MGI.utils.trim(data.address),
        course: data.course,
        batch: MGI.utils.trim(data.batch),
        joiningDate: data.joiningDate,
        status: data.status,
        courseProgress: Number(data.courseProgress),
        photo: removePhoto ? null : (pendingPhoto || (existing ? existing.photo : null)),
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now
      };
      var result = saveStudent(record, !existing, false);
      if (result.quotaPhoto) {
        MGI.ui.toast(result.message + " You can save this student without a photo.", "error", true);
        MGI.utils.byId("save-without-photo").hidden = false;
        return;
      }
      if (!result.ok) {
        MGI.ui.toast(result.message, "error", true);
        return;
      }
      MGI.ui.closeDialog("student-dialog");
      MGI.ui.toast(existing ? "Student updated." : "Student added.", "success");
      MGI.app.refresh();
    },

    saveWithoutPhoto: function () {
      pendingPhoto = null;
      removePhoto = true;
      MGI.utils.byId("save-without-photo").hidden = true;
      MGI.students.submitForm();
    },

    remove: function (id) {
      var student = MGI.state.students.find(function (s) { return s.id === id; });
      if (!student) return;
      var counts = relatedCounts(id);
      MGI.ui.confirm({
        title: "Delete student?",
        body:
          "Delete " + student.fullName + " (" + student.studentCode + ")? This will also delete " +
          counts.attendance + " attendance, " + counts.tasks + " task and " + counts.activities +
          " activity record(s). This cannot be undone. To keep history, set status to Inactive or Completed instead.",
        okText: "Delete student"
      }).then(function (ok) {
        if (!ok) return;
        var result = MGI.storage.commit(function (state) {
          state.students = state.students.filter(function (s) { return s.id !== id; });
          state.attendance = state.attendance.filter(function (r) { return r.studentId !== id; });
          state.tasks = state.tasks.filter(function (r) { return r.studentId !== id; });
          state.activities = state.activities.filter(function (r) { return r.studentId !== id; });
        });
        if (!result.ok) MGI.ui.toast(result.message, "error", true);
        else {
          MGI.ui.toast("Student and related records deleted.", "success");
          if (MGI.uiState.page === "profile") MGI.app.navigate("students");
          else MGI.app.refresh();
        }
      });
    },

    renderList: function () {
      var root = MGI.utils.byId("students-root");
      MGI.utils.clear(root);
      if (!MGI.state.students.length) {
        root.appendChild(MGI.ui.empty("No students yet", [
          { label: "Add Student", onClick: function () { MGI.students.openForm(null); } },
          { label: "Load Sample Data", className: "btn secondary", onClick: function () { MGI.app.loadSample(); } }
        ]));
        return;
      }
      var batches = Array.from(new Set(MGI.state.students.map(function (s) { return s.batch; }))).sort();
      var filters = MGI.utils.el("div", { className: "filters card" });
      var search = MGI.utils.el("div", { className: "field" }, [
        MGI.utils.el("label", { for: "student-search", text: "Search by name or Student ID" }),
        MGI.utils.el("input", { id: "student-search", type: "search", value: MGI.uiState.studentSearch || "", placeholder: "Type to filter" })
      ]);
      var course = MGI.utils.el("div", { className: "field" }, [
        MGI.utils.el("label", { for: "filter-course", text: "Course" }),
        MGI.utils.el("select", { id: "filter-course" })
      ]);
      var batch = MGI.utils.el("div", { className: "field" }, [
        MGI.utils.el("label", { for: "filter-batch", text: "Batch" }),
        MGI.utils.el("select", { id: "filter-batch" })
      ]);
      var status = MGI.utils.el("div", { className: "field" }, [
        MGI.utils.el("label", { for: "filter-status", text: "Status" }),
        MGI.utils.el("select", { id: "filter-status" })
      ]);
      filters.appendChild(search);
      filters.appendChild(course);
      filters.appendChild(batch);
      filters.appendChild(status);
      var clear = MGI.utils.el("button", { type: "button", className: "btn ghost", text: "Clear filters" });
      filters.appendChild(clear);
      root.appendChild(filters);
      MGI.ui.fillSelect(course.querySelector("select"), [{ value: "", label: "All courses" }].concat(MGI.config.courses.map(function (c) { return { value: c, label: c }; })), MGI.uiState.courseFilter || "");
      MGI.ui.fillSelect(batch.querySelector("select"), [{ value: "", label: "All batches" }].concat(batches.map(function (b) { return { value: b, label: b }; })), MGI.uiState.batchFilter || "");
      MGI.ui.fillSelect(status.querySelector("select"), [{ value: "", label: "All statuses" }].concat(MGI.config.studentStatuses.map(function (s) { return { value: s, label: s }; })), MGI.uiState.statusFilter || "");

      function bindFilter(id, prop) {
        MGI.utils.byId(id).addEventListener("input", function (e) {
          MGI.uiState[prop] = e.target.value;
          MGI.uiState.studentPage = 1;
          MGI.storage.saveUi(MGI.uiState);
          MGI.students.renderList();
        });
      }
      bindFilter("student-search", "studentSearch");
      bindFilter("filter-course", "courseFilter");
      bindFilter("filter-batch", "batchFilter");
      bindFilter("filter-status", "statusFilter");
      clear.addEventListener("click", function () {
        MGI.uiState.studentSearch = "";
        MGI.uiState.courseFilter = "";
        MGI.uiState.batchFilter = "";
        MGI.uiState.statusFilter = "";
        MGI.uiState.studentPage = 1;
        MGI.storage.saveUi(MGI.uiState);
        MGI.students.renderList();
      });

      var list = sortStudents(filteredStudents());
      var count = MGI.utils.el("p", { className: "muted", text: list.length + " student(s) match the current search and filters." });
      root.appendChild(count);
      if (!list.length) {
        root.appendChild(MGI.ui.empty("No students match your search", [
          { label: "Clear filters", className: "btn ghost", onClick: function () { clear.click(); } }
        ]));
        return;
      }
      var pageSize = MGI.config.pageSize;
      var page = MGI.uiState.studentPage || 1;
      var pages = Math.max(1, Math.ceil(list.length / pageSize));
      if (page > pages) page = pages;
      var slice = list.slice((page - 1) * pageSize, page * pageSize);
      var table = MGI.utils.el("table");
      var thead = document.createElement("thead");
      var hr = document.createElement("tr");
      [["photo", "Photo", false], ["studentCode", "Student ID", true], ["fullName", "Name", true], ["course", "Course", false], ["batch", "Batch", false], ["status", "Status", false], ["joiningDate", "Joining date", true], ["actions", "Actions", false]].forEach(function (col) {
        var th = document.createElement("th");
        th.scope = "col";
        if (col[2]) {
          var btn = MGI.utils.el("button", { type: "button", className: "sort", text: col[1] });
          btn.addEventListener("click", function () {
            if (MGI.uiState.studentSort === col[0]) MGI.uiState.studentDir = MGI.uiState.studentDir === "asc" ? "desc" : "asc";
            else { MGI.uiState.studentSort = col[0]; MGI.uiState.studentDir = "asc"; }
            MGI.storage.saveUi(MGI.uiState);
            MGI.students.renderList();
          });
          th.appendChild(btn);
        } else th.textContent = col[1];
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tb = document.createElement("tbody");
      slice.forEach(function (s) {
        var tr = document.createElement("tr");
        var tdPhoto = document.createElement("td");
        tdPhoto.appendChild(MGI.ui.avatar(s));
        tr.appendChild(tdPhoto);
        [s.studentCode, s.fullName, s.course, s.batch].forEach(function (v) {
          var td = document.createElement("td");
          td.textContent = v;
          tr.appendChild(td);
        });
        var tdStatus = document.createElement("td");
        tdStatus.appendChild(MGI.ui.statusPill(s.status, s.status === "Active" ? "success" : s.status === "Completed" ? "info" : "neutral"));
        tr.appendChild(tdStatus);
        var tdJoin = document.createElement("td");
        tdJoin.textContent = MGI.utils.formatDate(s.joiningDate);
        tr.appendChild(tdJoin);
        var tdAct = document.createElement("td");
        [["Profile", function () { MGI.app.navigate("profile", { id: s.id }); }], ["Edit", function () { MGI.students.openForm(s); }], ["Delete", function () { MGI.students.remove(s.id); }]].forEach(function (a) {
          var b = MGI.utils.el("button", { type: "button", className: a[0] === "Delete" ? "btn danger" : "btn ghost", text: a[0] });
          b.addEventListener("click", a[1]);
          tdAct.appendChild(b);
        });
        tr.appendChild(tdAct);
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      var wrap = MGI.utils.el("div", { className: "card table-wrap" });
      wrap.appendChild(table);
      root.appendChild(wrap);
      if (list.length > pageSize) {
        var pager = MGI.utils.el("div", { className: "inline-actions" });
        var prev = MGI.utils.el("button", { type: "button", className: "btn ghost", text: "Previous" });
        var next = MGI.utils.el("button", { type: "button", className: "btn ghost", text: "Next" });
        prev.disabled = page <= 1;
        next.disabled = page >= pages;
        pager.appendChild(MGI.utils.el("span", { text: "Page " + page + " of " + pages }));
        pager.appendChild(prev);
        pager.appendChild(next);
        prev.addEventListener("click", function () { MGI.uiState.studentPage = page - 1; MGI.students.renderList(); });
        next.addEventListener("click", function () { MGI.uiState.studentPage = page + 1; MGI.students.renderList(); });
        root.appendChild(pager);
      }
    },

    renderProfile: function (id) {
      var root = MGI.utils.byId("profile-root");
      MGI.utils.clear(root);
      var student = MGI.state.students.find(function (s) { return s.id === id; });
      if (!student) {
        root.appendChild(MGI.ui.empty("Student not found", [{ label: "Back to students", onClick: function () { MGI.app.navigate("students"); } }]));
        return;
      }
      var metrics = MGI.analytics.studentMetrics(MGI.state, student);
      var head = MGI.utils.el("div", { className: "card profile-head" });
      head.appendChild(MGI.ui.avatar(student, "lg"));
      var info = MGI.utils.el("div");
      info.appendChild(MGI.utils.el("h2", { text: student.fullName }));
      info.appendChild(MGI.utils.el("p", { text: student.studentCode + " · " + student.course + " · " + student.batch }));
      info.appendChild(MGI.ui.statusPill(student.status, student.status === "Active" ? "success" : "neutral"));
      info.appendChild(MGI.utils.el("p", { className: "muted", text: "Phone " + student.phone + (student.email ? " · " + student.email : "") }));
      if (student.address) info.appendChild(MGI.utils.el("p", { text: student.address }));
      info.appendChild(MGI.utils.el("p", { className: "muted", text: "Joined " + MGI.utils.formatDate(student.joiningDate) + " · Created " + MGI.utils.formatDateTime(student.createdAt) + " · Updated " + MGI.utils.formatDateTime(student.updatedAt) }));
      head.appendChild(info);
      root.appendChild(head);

      var quick = MGI.utils.el("div", { className: "card" });
      quick.appendChild(MGI.utils.el("h3", { text: "Course, batch and status" }));
      var courseSel = MGI.utils.el("select", { id: "profile-course" });
      var batchInp = MGI.utils.el("input", { id: "profile-batch", value: student.batch });
      var statusSel = MGI.utils.el("select", { id: "profile-status" });
      var progressInp = MGI.utils.el("input", { id: "profile-progress", type: "number", min: "0", max: "100", value: String(student.courseProgress) });
      var grid = MGI.utils.el("div", { className: "filters" });
      [["Course", courseSel], ["Batch", batchInp], ["Status", statusSel], ["Course progress (0–100)", progressInp]].forEach(function (pair) {
        var f = MGI.utils.el("div", { className: "field" });
        var lab = MGI.utils.el("label", { text: pair[0] });
        pair[1].id = pair[1].id;
        lab.setAttribute("for", pair[1].id);
        f.appendChild(lab);
        f.appendChild(pair[1]);
        grid.appendChild(f);
      });
      MGI.ui.fillSelect(courseSel, MGI.config.courses.map(function (c) { return { value: c, label: c }; }), student.course);
      MGI.ui.fillSelect(statusSel, MGI.config.studentStatuses.map(function (c) { return { value: c, label: c }; }), student.status);
      var saveQuick = MGI.utils.el("button", { type: "button", className: "btn", text: "Save profile details" });
      saveQuick.addEventListener("click", function () {
        var batch = MGI.utils.trim(batchInp.value);
        var progress = Number(progressInp.value);
        if (batch.length < 2 || batch.length > 30) {
          MGI.ui.toast("Batch must be 2–30 characters.", "error", true);
          batchInp.focus();
          return;
        }
        if (Number.isNaN(progress) || progress < 0 || progress > 100 || progress % 1 !== 0) {
          MGI.ui.toast("Course progress must be a whole number from 0 to 100.", "error", true);
          progressInp.focus();
          return;
        }
        var result = MGI.storage.commit(function (state) {
          var s = state.students.find(function (x) { return x.id === student.id; });
          s.course = courseSel.value;
          s.batch = batch;
          s.status = statusSel.value;
          s.courseProgress = progress;
          s.updatedAt = MGI.utils.nowIso();
        });
        if (!result.ok) MGI.ui.toast(result.message, "error", true);
        else {
          MGI.ui.toast("Profile updated.", "success");
          MGI.app.refresh();
        }
      });
      quick.appendChild(grid);
      quick.appendChild(MGI.charts.progress("Course progress", student.courseProgress));
      quick.appendChild(saveQuick);
      var shortcuts = MGI.utils.el("div", { className: "inline-actions" });
      [["Mark today's attendance", function () { MGI.app.navigate("attendance", { studentId: student.id }); }], ["Add task", function () { MGI.app.navigate("tasks", { studentId: student.id, open: true }); }], ["Add activity", function () { MGI.app.navigate("activities", { studentId: student.id, open: true }); }]].forEach(function (a) {
        var b = MGI.utils.el("button", { type: "button", className: "btn secondary", text: a[0] });
        b.addEventListener("click", a[1]);
        shortcuts.appendChild(b);
      });
      var edit = MGI.utils.el("button", { type: "button", className: "btn ghost", text: "Edit full record" });
      edit.addEventListener("click", function () { MGI.students.openForm(student); });
      shortcuts.appendChild(edit);
      quick.appendChild(shortcuts);
      root.appendChild(quick);

      root.appendChild(MGI.students.performanceCard(metrics));

      var attCard = MGI.utils.el("section", { className: "card" });
      attCard.appendChild(MGI.utils.el("h3", { text: "Attendance history" }));
      attCard.appendChild(MGI.utils.el("p", { text: "Present " + metrics.attendance.present + ", Absent " + metrics.attendance.absent + ", Leave " + metrics.attendance.leave + ", Percentage " + MGI.utils.pct(metrics.attendance.percentage) }));
      var attRows = MGI.state.attendance.filter(function (r) { return r.studentId === student.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      if (!attRows.length) attCard.appendChild(MGI.utils.el("p", { className: "muted", text: "No attendance recorded yet" }));
      else attCard.appendChild(simpleTable(["Date", "Status", "Remarks"], attRows.map(function (r) { return [MGI.utils.formatDate(r.date), r.status, r.remarks || ""]; })));
      root.appendChild(attCard);

      var tCard = MGI.utils.el("section", { className: "card" });
      tCard.appendChild(MGI.utils.el("h3", { text: "Tasks" }));
      tCard.appendChild(MGI.utils.el("p", { text: "Completion " + MGI.utils.pct(metrics.tasks.percentage) + " · Overdue " + metrics.tasks.overdue }));
      var tRows = MGI.state.tasks.filter(function (r) { return r.studentId === student.id; });
      if (!tRows.length) tCard.appendChild(MGI.utils.el("p", { className: "muted", text: "No tasks assigned yet" }));
      else tCard.appendChild(simpleTable(["Title", "Due", "Status", "Overdue"], tRows.map(function (t) {
        return [t.title, MGI.utils.formatDate(t.dueDate), t.status, MGI.analytics.isOverdue(t) ? "Overdue" : ""];
      })));
      root.appendChild(tCard);

      var aCard = MGI.utils.el("section", { className: "card" });
      aCard.appendChild(MGI.utils.el("h3", { text: "Activity history" }));
      aCard.appendChild(MGI.utils.el("p", { text: "Positive " + metrics.activities.positive + " · Negative " + metrics.activities.negative + " · Net " + metrics.activities.net }));
      var aRows = MGI.state.activities.filter(function (r) { return r.studentId === student.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      if (!aRows.length) aCard.appendChild(MGI.utils.el("p", { className: "muted", text: "No activities recorded yet" }));
      else aCard.appendChild(simpleTable(["Date", "Type", "Category", "Points", "Description"], aRows.map(function (a) {
        return [MGI.utils.formatDate(a.date), a.type, a.category, MGI.utils.signedPoints(a.type, a.points), a.description];
      })));
      root.appendChild(aCard);
    },

    performanceCard: function (metrics) {
      var card = MGI.utils.el("section", { className: "card" });
      card.appendChild(MGI.utils.el("h3", { text: "Performance summary" }));
      card.appendChild(MGI.ui.statusPill("Overall status: " + metrics.overall, metrics.overall === "At Risk" ? "danger" : metrics.overall === "Excellent" ? "success" : "warning"));
      var list = MGI.utils.el("ul");
      [
        ["Attendance", metrics.ratings.attendance, "Attendance " + metrics.ratings.attendance.value + " — " + metrics.ratings.attendance.rating + ": " + metrics.ratings.attendance.rule],
        ["Task completion", metrics.ratings.tasks, "Task completion " + metrics.ratings.tasks.value + " — " + metrics.ratings.tasks.rating + ": " + metrics.ratings.tasks.rule],
        ["Overdue tasks", metrics.ratings.overdue, "Overdue " + metrics.ratings.overdue.value + " — " + metrics.ratings.overdue.rating + ": " + metrics.ratings.overdue.rule],
        ["Net points", metrics.ratings.net, "Net points " + metrics.ratings.net.value + " — " + metrics.ratings.net.rating + ": " + metrics.ratings.net.rule]
      ].forEach(function (row) {
        var li = document.createElement("li");
        li.appendChild(MGI.ui.rating(row[1]));
        li.appendChild(document.createTextNode(" " + row[2]));
        list.appendChild(li);
      });
      card.appendChild(list);
      return card;
    }
  };

  function simpleTable(headers, rows) {
    var table = MGI.utils.el("table");
    var thead = document.createElement("thead");
    var tr = document.createElement("tr");
    headers.forEach(function (h) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = h;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);
    var tb = document.createElement("tbody");
    rows.forEach(function (row) {
      var r = document.createElement("tr");
      row.forEach(function (cell) {
        var td = document.createElement("td");
        td.textContent = cell;
        r.appendChild(td);
      });
      tb.appendChild(r);
    });
    table.appendChild(tb);
    var wrap = MGI.utils.el("div", { className: "table-wrap" });
    wrap.appendChild(table);
    return wrap;
  }

  global.MGI = MGI;
})(window);
