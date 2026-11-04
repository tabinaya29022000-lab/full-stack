(function (global) {
  var MGI = global.MGI || {};

  function existing(studentId, date) {
    return MGI.state.attendance.find(function (r) {
      return r.studentId === studentId && r.date === date;
    });
  }

  MGI.attendance = {
    existing: existing,

    create: function (payload) {
      payload = Object.assign({}, payload, { forceNew: true });
      return MGI.attendance.addOrUpdate(payload);
    },

    addOrUpdate: function (payload) {
      if (!MGI.state.students.some(function (s) { return s.id === payload.studentId; })) {
        return { ok: false, message: "Attendance cannot be saved for an unknown student." };
      }
      if (!MGI.utils.isValidDate(payload.date)) return { ok: false, message: "Enter a valid date." };
      if (payload.date > MGI.utils.today()) return { ok: false, message: "Attendance cannot be dated in the future." };
      if (MGI.config.attendanceStatuses.indexOf(payload.status) === -1) return { ok: false, message: "Status must be Present, Absent or Leave." };
      var remarks = MGI.utils.trim(payload.remarks || "");
      if (remarks.length > 200) return { ok: false, message: "Remarks must be 200 characters or fewer." };
      var found = existing(payload.studentId, payload.date);
      if (found && payload.forceNew) {
        MGI.ui.toast("Attendance already exists for this student on this date. You can edit the existing record.", "error", true);
        return { ok: false, duplicate: true, record: found, message: "Attendance already exists for this student on this date. You can edit the existing record." };
      }
      var now = MGI.utils.nowIso();
      return MGI.storage.commit(function (state) {
        var rec = existing(payload.studentId, payload.date);
        if (rec) {
          rec.status = payload.status;
          rec.remarks = remarks;
          rec.updatedAt = now;
        } else {
          state.attendance.push({
            id: MGI.utils.uuid(),
            studentId: payload.studentId,
            date: payload.date,
            status: payload.status,
            remarks: remarks,
            createdAt: now,
            updatedAt: now
          });
        }
      });
    },

    saveSheet: function (date, rows) {
      if (date > MGI.utils.today()) return { ok: false, message: "Future dates are not allowed." };
      var now = MGI.utils.nowIso();
      return MGI.storage.commit(function (state) {
        rows.forEach(function (row) {
          if (!row.status) return;
          var rec = state.attendance.find(function (r) { return r.studentId === row.studentId && r.date === date; });
          var remarks = MGI.utils.trim(row.remarks || "").slice(0, 200);
          if (rec) {
            rec.status = row.status;
            rec.remarks = remarks;
            rec.updatedAt = now;
          } else {
            state.attendance.push({
              id: MGI.utils.uuid(),
              studentId: row.studentId,
              date: date,
              status: row.status,
              remarks: remarks,
              createdAt: now,
              updatedAt: now
            });
          }
        });
      });
    },

    render: function () {
      var root = MGI.utils.byId("attendance-root");
      MGI.utils.clear(root);
      if (!MGI.state.students.length) {
        root.appendChild(MGI.ui.empty("No students are registered. Add a student before recording attendance.", [
          { label: "Add Student", onClick: function () { MGI.app.navigate("students"); MGI.students.openForm(null); } }
        ]));
        return;
      }
      var date = MGI.uiState.attendanceDate || MGI.utils.today();
      var includeAll = !!MGI.uiState.includeInactive;
      var students = MGI.state.students.filter(function (s) {
        return includeAll ? true : s.status === "Active";
      }).sort(function (a, b) { return a.fullName.localeCompare(b.fullName); });

      var controls = MGI.utils.el("div", { className: "card filters" });
      var dateField = MGI.utils.el("div", { className: "field" });
      dateField.appendChild(MGI.utils.el("label", { for: "att-date", html: 'Date <span class="required">(required, today or earlier)</span>' }));
      var dateInput = MGI.utils.el("input", { id: "att-date", type: "date", value: date, max: MGI.utils.today() });
      dateField.appendChild(dateInput);
      controls.appendChild(dateField);
      var include = MGI.utils.el("label");
      var chk = MGI.utils.el("input", { type: "checkbox", id: "att-include" });
      chk.checked = includeAll;
      include.appendChild(chk);
      include.appendChild(document.createTextNode(" Include Inactive and Completed students"));
      controls.appendChild(include);
      var markAll = MGI.utils.el("button", { type: "button", className: "btn secondary", text: "Mark all Present" });
      var save = MGI.utils.el("button", { type: "button", className: "btn", text: "Save attendance" });
      controls.appendChild(markAll);
      controls.appendChild(save);
      root.appendChild(controls);

      if (date > MGI.utils.today()) {
        root.appendChild(MGI.utils.el("p", { className: "field-error", role: "alert", text: "Future dates are not allowed." }));
      }

      var sheet = MGI.utils.el("div", { className: "card" });
      sheet.appendChild(MGI.utils.el("h3", { text: "Daily attendance sheet" }));
      if (!students.length) {
        sheet.appendChild(MGI.utils.el("p", { text: "No Active students to mark. Include Inactive and Completed students, or add a student." }));
      }
      students.forEach(function (s) {
        var rec = existing(s.id, date);
        var row = MGI.utils.el("div", { className: "sheet-row" });
        var who = MGI.utils.el("div");
        who.appendChild(MGI.ui.avatar(s));
        who.appendChild(MGI.utils.el("strong", { text: " " + s.fullName }));
        who.appendChild(MGI.utils.el("div", { className: "muted", text: s.studentCode + " · " + s.status }));
        row.appendChild(who);
        var radios = MGI.utils.el("div", { className: "radio-group" });
        MGI.config.attendanceStatuses.forEach(function (st) {
          var id = "att-" + s.id + "-" + st;
          var lab = MGI.utils.el("label", { for: id });
          var input = MGI.utils.el("input", { type: "radio", name: "att-" + s.id, id: id, value: st });
          if ((rec && rec.status === st) || (!rec && st === "Present" && false)) input.checked = rec && rec.status === st;
          lab.appendChild(input);
          lab.appendChild(document.createTextNode(" " + st));
          radios.appendChild(lab);
        });
        row.appendChild(radios);
        var remark = MGI.utils.el("input", { type: "text", maxlength: "200", placeholder: "Remark (optional)", value: rec ? rec.remarks || "" : "", "aria-label": "Remark for " + s.fullName });
        remark.dataset.studentId = s.id;
        row.appendChild(remark);
        sheet.appendChild(row);
      });
      root.appendChild(sheet);

      markAll.addEventListener("click", function () {
        sheet.querySelectorAll('input[type="radio"][value="Present"]').forEach(function (el) { el.checked = true; });
      });
      dateInput.addEventListener("change", function () {
        if (dateInput.value > MGI.utils.today()) {
          MGI.ui.toast("Attendance cannot be dated in the future.", "error", true);
          dateInput.value = MGI.utils.today();
        }
        MGI.uiState.attendanceDate = dateInput.value;
        MGI.storage.saveUi(MGI.uiState);
        MGI.attendance.render();
      });
      chk.addEventListener("change", function () {
        MGI.uiState.includeInactive = chk.checked;
        MGI.storage.saveUi(MGI.uiState);
        MGI.attendance.render();
      });
      save.addEventListener("click", function () {
        if (dateInput.value > MGI.utils.today()) {
          MGI.ui.toast("Attendance cannot be dated in the future.", "error", true);
          return;
        }
        var rows = students.map(function (s) {
          var selected = sheet.querySelector('input[name="att-' + s.id + '"]:checked');
          var remarkInput = sheet.querySelector('input[data-student-id="' + s.id + '"]');
          return { studentId: s.id, status: selected ? selected.value : "", remarks: remarkInput ? remarkInput.value : "" };
        }).filter(function (r) { return r.status; });
        var result = MGI.attendance.saveSheet(dateInput.value, rows);
        if (!result.ok) MGI.ui.toast(result.message, "error", true);
        else {
          MGI.ui.toast("Attendance saved for " + rows.length + " student(s).", "success");
          MGI.app.refresh();
        }
      });

      root.appendChild(MGI.attendance.reports());
    },

    reports: function () {
      var wrap = MGI.utils.el("section", { className: "card" });
      wrap.appendChild(MGI.utils.el("h3", { text: "Attendance reports" }));
      var studentSel = MGI.utils.el("select", { id: "att-report-student" });
      MGI.ui.fillSelect(studentSel, MGI.ui.studentOptions(false), MGI.uiState.attReportStudent || (MGI.state.students[0] && MGI.state.students[0].id));
      var from = MGI.utils.el("input", { type: "date", id: "att-from", value: MGI.uiState.attFrom || "" });
      var to = MGI.utils.el("input", { type: "date", id: "att-to", value: MGI.uiState.attTo || "" });
      var filters = MGI.utils.el("div", { className: "filters" });
      [["Student", studentSel], ["From", from], ["To", to]].forEach(function (pair, i) {
        var f = MGI.utils.el("div", { className: "field" });
        var id = ["att-report-student", "att-from", "att-to"][i];
        f.appendChild(MGI.utils.el("label", { for: id, text: pair[0] }));
        f.appendChild(pair[1]);
        filters.appendChild(f);
      });
      wrap.appendChild(filters);
      var out = MGI.utils.el("div", { id: "att-report-out" });
      wrap.appendChild(out);
      function draw() {
        MGI.utils.clear(out);
        var sid = studentSel.value;
        var f = from.value || null;
        var t = to.value || null;
        if (f && t && f > t) {
          out.appendChild(MGI.utils.el("p", { className: "field-error", role: "alert", text: "From must not be later than To." }));
          return;
        }
        var student = MGI.state.students.find(function (s) { return s.id === sid; });
        var sum = MGI.analytics.attendanceSummary(MGI.state.attendance, sid, f, t);
        out.appendChild(MGI.utils.el("h4", { text: "Student-wise report" }));
        if (!sum.total) out.appendChild(MGI.utils.el("p", { text: "No attendance was recorded for that period." }));
        else out.appendChild(MGI.utils.el("p", { text: student.fullName + ": Present " + sum.present + ", Absent " + sum.absent + ", Leave " + sum.leave + ", Total " + sum.total + ", Percentage " + MGI.utils.pct(sum.percentage) }));
        var rows = MGI.state.attendance.filter(function (r) {
          return r.studentId === sid && (!f || r.date >= f) && (!t || r.date <= t);
        }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        rows.forEach(function (r) {
          var line = MGI.utils.el("p");
          line.textContent = MGI.utils.formatDate(r.date) + " — " + r.status + (r.remarks ? " · " + r.remarks : "");
          var edit = MGI.utils.el("button", { type: "button", className: "btn ghost", text: "Edit" });
          var del = MGI.utils.el("button", { type: "button", className: "btn danger", text: "Delete" });
          edit.addEventListener("click", function () {
            var next = r.status === "Present" ? "Leave" : r.status === "Leave" ? "Absent" : "Present";
            var result = MGI.attendance.addOrUpdate({ studentId: r.studentId, date: r.date, status: next, remarks: r.remarks });
            if (result.ok) {
              MGI.ui.toast("Attendance updated to " + next + ".", "success");
              MGI.app.refresh();
            }
          });
          del.addEventListener("click", function () {
            MGI.ui.confirm({ title: "Delete attendance?", body: "Delete the " + r.date + " record for this student? This cannot be undone.", okText: "Delete" }).then(function (ok) {
              if (!ok) return;
              var result = MGI.storage.commit(function (state) {
                state.attendance = state.attendance.filter(function (x) { return x.id !== r.id; });
              });
              if (result.ok) { MGI.ui.toast("Attendance record deleted.", "success"); MGI.app.refresh(); }
              else MGI.ui.toast(result.message, "error", true);
            });
          });
          line.appendChild(edit);
          line.appendChild(del);
          out.appendChild(line);
        });

        out.appendChild(MGI.utils.el("h4", { text: "Date-wise report" }));
        var days = {};
        MGI.state.attendance.forEach(function (r) {
          if (f && r.date < f) return;
          if (t && r.date > t) return;
          days[r.date] = days[r.date] || { Present: 0, Absent: 0, Leave: 0 };
          days[r.date][r.status] += 1;
        });
        var dates = Object.keys(days).sort();
        if (!dates.length) out.appendChild(MGI.utils.el("p", { text: "No attendance was recorded for that period." }));
        dates.forEach(function (d) {
          var active = MGI.state.students.filter(function (s) { return s.status === "Active"; }).length;
          var marked = days[d].Present + days[d].Absent + days[d].Leave;
          var p = MGI.utils.el("p");
          p.textContent = MGI.utils.formatDate(d) + ": Present " + days[d].Present + ", Absent " + days[d].Absent + ", Leave " + days[d].Leave + ", Not Marked " + Math.max(0, active - marked);
          out.appendChild(p);
        });
        if (f && t && f === t) {
          out.appendChild(MGI.utils.el("h4", { text: "Every student on " + f }));
          MGI.state.students.forEach(function (s) {
            var rec = existing(s.id, f);
            var p = MGI.utils.el("p");
            p.textContent = s.fullName + " (" + s.studentCode + "): " + (rec ? rec.status : "Not Marked");
            out.appendChild(p);
          });
        }
      }
      [studentSel, from, to].forEach(function (el) {
        el.addEventListener("change", function () {
          MGI.uiState.attReportStudent = studentSel.value;
          MGI.uiState.attFrom = from.value;
          MGI.uiState.attTo = to.value;
          MGI.storage.saveUi(MGI.uiState);
          draw();
        });
      });
      draw();
      return wrap;
    }
  };

  global.MGI = MGI;
})(window);
