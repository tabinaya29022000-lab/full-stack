(function (global) {
  var MGI = global.MGI || {};

  function validate(data) {
    var errors = {};
    var title = MGI.utils.trim(data.title);
    var desc = MGI.utils.trim(data.description);
    if (!data.studentId) errors.studentId = "Select a student.";
    if (!title) errors.title = "Title is required.";
    else if (title.length < 3 || title.length > 100) errors.title = "Title must be 3–100 characters.";
    if (desc.length > 500) errors.description = "Description must be 500 characters or fewer.";
    if (!data.assignedDate || !MGI.utils.isValidDate(data.assignedDate)) errors.assignedDate = "Enter a valid assigned date.";
    if (!data.dueDate || !MGI.utils.isValidDate(data.dueDate)) errors.dueDate = "Enter a valid due date.";
    else if (data.assignedDate && data.dueDate < data.assignedDate) errors.dueDate = "Due date cannot be earlier than the assigned date.";
    if (MGI.config.taskStatuses.indexOf(data.status) === -1) errors.status = "Select a valid status.";
    return errors;
  }

  MGI.tasks = {
    save: function (data, id) {
      var errors = validate(data);
      if (Object.keys(errors).length) return { ok: false, errors: errors };
      if (!MGI.state.students.some(function (s) { return s.id === data.studentId; })) {
        return { ok: false, errors: { studentId: "Unknown student." } };
      }
      var now = MGI.utils.nowIso();
      return MGI.storage.commit(function (state) {
        if (id) {
          var rec = state.tasks.find(function (t) { return t.id === id; });
          rec.title = MGI.utils.trim(data.title);
          rec.description = MGI.utils.trim(data.description);
          rec.assignedDate = data.assignedDate;
          rec.dueDate = data.dueDate;
          rec.studentId = data.studentId;
          if (data.status === "Completed" && rec.status !== "Completed") rec.completedDate = MGI.utils.today();
          if (data.status !== "Completed") rec.completedDate = null;
          rec.status = data.status;
          rec.updatedAt = now;
        } else {
          state.tasks.push({
            id: MGI.utils.uuid(),
            studentId: data.studentId,
            title: MGI.utils.trim(data.title),
            description: MGI.utils.trim(data.description),
            assignedDate: data.assignedDate,
            dueDate: data.dueDate,
            status: data.status,
            completedDate: data.status === "Completed" ? MGI.utils.today() : null,
            createdAt: now,
            updatedAt: now
          });
        }
      });
    },

    setStatus: function (id, status) {
      return MGI.storage.commit(function (state) {
        var rec = state.tasks.find(function (t) { return t.id === id; });
        if (!rec) return;
        rec.status = status;
        rec.completedDate = status === "Completed" ? MGI.utils.today() : null;
        rec.updatedAt = MGI.utils.nowIso();
      });
    },

    render: function () {
      var root = MGI.utils.byId("tasks-root");
      MGI.utils.clear(root);
      if (!MGI.state.students.length) {
        root.appendChild(MGI.ui.empty("No students are registered. Add a student before creating tasks.", [
          { label: "Add Student", onClick: function () { MGI.app.navigate("students"); } }
        ]));
        return;
      }
      var inst = MGI.analytics.taskSummary(MGI.state.tasks);
      var metrics = MGI.utils.el("div", { className: "grid grid-4" });
      [["Completed", inst.completed], ["Pending", inst.pending], ["In Progress", inst.inProgress], ["Overdue", inst.overdue]].forEach(function (m) {
        metrics.appendChild(MGI.ui.metric(m[0], m[1]));
      });
      metrics.appendChild(MGI.ui.metric("Completion rate", MGI.utils.pct(inst.percentage)));
      root.appendChild(metrics);

      var form = MGI.utils.el("form", { className: "card", id: "task-form" });
      form.appendChild(MGI.utils.el("h3", { text: MGI.uiState.editingTask ? "Edit task" : "Create task" }));
      form.innerHTML += "";
      var fields = MGI.utils.el("div", { className: "filters" });
      var studentSel = MGI.utils.el("select", { id: "tsk-student" });
      MGI.ui.fillSelect(studentSel, MGI.ui.studentOptions(false), (MGI.uiState.params && MGI.uiState.params.studentId) || "");
      var title = MGI.utils.el("input", { id: "tsk-title" });
      var desc = MGI.utils.el("textarea", { id: "tsk-desc" });
      var assigned = MGI.utils.el("input", { id: "tsk-assigned", type: "date", value: MGI.utils.today() });
      var due = MGI.utils.el("input", { id: "tsk-due", type: "date", value: MGI.utils.today() });
      var status = MGI.utils.el("select", { id: "tsk-status" });
      MGI.ui.fillSelect(status, MGI.config.taskStatuses.map(function (s) { return { value: s, label: s }; }), "Pending");
      [["Student (required)", studentSel, "tsk-student"], ["Title (required)", title, "tsk-title"], ["Assigned date", assigned, "tsk-assigned"], ["Due date (required)", due, "tsk-due"], ["Status", status, "tsk-status"]].forEach(function (row) {
        var f = MGI.utils.el("div", { className: "field" });
        var lab = MGI.utils.el("label", { for: row[2], text: row[0] });
        f.appendChild(lab);
        f.appendChild(row[1]);
        f.appendChild(MGI.utils.el("p", { className: "field-error", id: row[2] + "-error" }));
        fields.appendChild(f);
      });
      var df = MGI.utils.el("div", { className: "field" });
      df.appendChild(MGI.utils.el("label", { for: "tsk-desc", text: "Description (optional)" }));
      df.appendChild(desc);
      df.appendChild(MGI.utils.el("p", { className: "field-error", id: "tsk-desc-error" }));
      form.appendChild(fields);
      form.appendChild(df);
      var submit = MGI.utils.el("button", { type: "submit", className: "btn", text: "Save task" });
      form.appendChild(submit);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var data = {
          studentId: studentSel.value,
          title: title.value,
          description: desc.value,
          assignedDate: assigned.value,
          dueDate: due.value,
          status: status.value
        };
        var result = MGI.tasks.save(data, MGI.uiState.editingTask || null);
        if (!result.ok && result.errors) {
          ["student", "title", "desc", "assigned", "due", "status"].forEach(function (key) {});
          var map = { studentId: "tsk-student", title: "tsk-title", description: "tsk-desc", assignedDate: "tsk-assigned", dueDate: "tsk-due", status: "tsk-status" };
          var first = null;
          Object.keys(map).forEach(function (k) {
            var input = MGI.utils.byId(map[k]);
            MGI.ui.setFieldError(input, result.errors[k] || "");
            if (result.errors[k] && !first) first = input;
          });
          if (first) first.focus();
          return;
        }
        if (!result.ok) {
          MGI.ui.toast(result.message, "error", true);
          return;
        }
        MGI.uiState.editingTask = null;
        MGI.ui.toast("Task saved.", "success");
        MGI.app.refresh();
      });
      root.appendChild(form);
      if (MGI.uiState.params && MGI.uiState.params.open) title.focus();

      var listWrap = MGI.utils.el("section", { className: "card" });
      listWrap.appendChild(MGI.utils.el("h3", { text: "Task list" }));
      var fStudent = MGI.utils.el("select", { id: "tsk-filter-student" });
      MGI.ui.fillSelect(fStudent, MGI.ui.studentOptions(true), MGI.uiState.taskStudent || "");
      var fStatus = MGI.utils.el("select", { id: "tsk-filter-status" });
      MGI.ui.fillSelect(fStatus, [{ value: "", label: "All statuses" }].concat(MGI.config.taskStatuses.map(function (s) { return { value: s, label: s }; })), MGI.uiState.taskStatus || "");
      var fOverdue = MGI.utils.el("input", { type: "checkbox", id: "tsk-overdue-only" });
      fOverdue.checked = !!MGI.uiState.taskOverdueOnly;
      var search = MGI.utils.el("input", { id: "tsk-search", type: "search", value: MGI.uiState.taskSearch || "", placeholder: "Search title" });
      var filters = MGI.utils.el("div", { className: "filters" });
      [["Student", fStudent], ["Status", fStatus], ["Search title", search]].forEach(function (row) {
        var f = MGI.utils.el("div", { className: "field" });
        f.appendChild(MGI.utils.el("label", { text: row[0] }));
        f.appendChild(row[1]);
        filters.appendChild(f);
      });
      var of = MGI.utils.el("label");
      of.appendChild(fOverdue);
      of.appendChild(document.createTextNode(" Overdue only"));
      filters.appendChild(of);
      listWrap.appendChild(filters);
      var tableHost = MGI.utils.el("div");
      listWrap.appendChild(tableHost);
      root.appendChild(listWrap);

      function drawList() {
        MGI.uiState.taskStudent = fStudent.value;
        MGI.uiState.taskStatus = fStatus.value;
        MGI.uiState.taskSearch = search.value;
        MGI.uiState.taskOverdueOnly = fOverdue.checked;
        MGI.storage.saveUi(MGI.uiState);
        var q = MGI.utils.trim(search.value).toLowerCase();
        var rows = MGI.state.tasks.filter(function (t) {
          if (fStudent.value && t.studentId !== fStudent.value) return false;
          if (fStatus.value && t.status !== fStatus.value) return false;
          if (fOverdue.checked && !MGI.analytics.isOverdue(t)) return false;
          if (q && t.title.toLowerCase().indexOf(q) === -1) return false;
          return true;
        }).sort(function (a, b) {
          return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
        });
        MGI.utils.clear(tableHost);
        if (!rows.length) {
          tableHost.appendChild(MGI.utils.el("p", { className: "muted", text: "No tasks match the current filters." }));
          return;
        }
        var table = MGI.utils.el("table");
        var thead = document.createElement("thead");
        var hr = document.createElement("tr");
        ["Title", "Student", "Due date", "Status", "Overdue", "Actions"].forEach(function (h) {
          var th = document.createElement("th");
          th.scope = "col";
          th.textContent = h;
          hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        var tb = document.createElement("tbody");
        rows.forEach(function (t) {
          var student = MGI.state.students.find(function (s) { return s.id === t.studentId; });
          var tr = document.createElement("tr");
          [t.title, student ? student.fullName + " (" + student.studentCode + ")" : "Unknown", MGI.utils.formatDate(t.dueDate)].forEach(function (c) {
            var td = document.createElement("td");
            td.textContent = c;
            tr.appendChild(td);
          });
          var st = document.createElement("td");
          var sel = MGI.utils.el("select");
          MGI.ui.fillSelect(sel, MGI.config.taskStatuses.map(function (s) { return { value: s, label: s }; }), t.status);
          sel.addEventListener("change", function () {
            var result = MGI.tasks.setStatus(t.id, sel.value);
            if (result.ok) { MGI.ui.toast("Task status updated.", "success"); MGI.app.refresh(); }
            else MGI.ui.toast(result.message, "error", true);
          });
          st.appendChild(sel);
          tr.appendChild(st);
          var od = document.createElement("td");
          if (MGI.analytics.isOverdue(t)) {
            od.appendChild(MGI.utils.el("span", { className: "pill tone-danger overdue", text: "Overdue" }));
          } else od.textContent = "No";
          tr.appendChild(od);
          var act = document.createElement("td");
          var edit = MGI.utils.el("button", { type: "button", className: "btn ghost", text: "Edit" });
          edit.addEventListener("click", function () {
            MGI.uiState.editingTask = t.id;
            studentSel.value = t.studentId;
            title.value = t.title;
            desc.value = t.description || "";
            assigned.value = t.assignedDate;
            due.value = t.dueDate;
            status.value = t.status;
            title.focus();
          });
          var del = MGI.utils.el("button", { type: "button", className: "btn danger", text: "Delete" });
          del.addEventListener("click", function () {
            MGI.ui.confirm({ title: "Delete task?", body: "Delete “" + t.title + "”? This cannot be undone.", okText: "Delete task" }).then(function (ok) {
              if (!ok) return;
              var result = MGI.storage.commit(function (state) {
                state.tasks = state.tasks.filter(function (x) { return x.id !== t.id; });
              });
              if (result.ok) { MGI.ui.toast("Task deleted.", "success"); MGI.app.refresh(); }
              else MGI.ui.toast(result.message, "error", true);
            });
          });
          act.appendChild(edit);
          act.appendChild(del);
          tr.appendChild(act);
          tb.appendChild(tr);
        });
        table.appendChild(tb);
        var wrap = MGI.utils.el("div", { className: "table-wrap" });
        wrap.appendChild(table);
        tableHost.appendChild(wrap);
      }
      [fStudent, fStatus, search, fOverdue].forEach(function (el) {
        el.addEventListener("input", drawList);
        el.addEventListener("change", drawList);
      });
      drawList();
    }
  };

  global.MGI = MGI;
})(window);
