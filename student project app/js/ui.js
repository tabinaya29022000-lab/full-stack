(function (global) {
  var MGI = global.MGI || {};
  var lastFocus = null;

  function toastRegion() {
    return MGI.utils.byId("toast-region");
  }

  MGI.ui = {
    toast: function (message, type, persist) {
      var region = toastRegion();
      var item = MGI.utils.el("div", {
        className: "toast toast-" + (type || "info"),
        role: type === "error" || type === "warning" ? "alert" : "status"
      });
      item.appendChild(MGI.utils.el("p", { text: message }));
      var close = MGI.utils.el("button", { type: "button", className: "toast-close", text: "Dismiss" });
      close.addEventListener("click", function () {
        item.remove();
      });
      item.appendChild(close);
      region.appendChild(item);
      if (!persist && type !== "error" && type !== "warning") {
        setTimeout(function () {
          if (item.parentNode) item.remove();
        }, 4000);
      }
    },

    avatar: function (student, sizeClass) {
      var wrap = MGI.utils.el("span", { className: "avatar " + (sizeClass || "") });
      if (student && student.photo) {
        wrap.appendChild(MGI.utils.el("img", {
          src: student.photo,
          alt: (student.fullName || "Student") + " profile photo"
        }));
      } else {
        wrap.appendChild(MGI.utils.el("span", {
          className: "avatar-fallback",
          text: MGI.utils.initials(student && student.fullName)
        }));
      }
      return wrap;
    },

    statusPill: function (text, tone) {
      return MGI.utils.el("span", { className: "pill tone-" + (tone || "neutral"), text: text });
    },

    rating: function (rating) {
      var tone = rating.rating === "Green" ? "success" : rating.rating === "Amber" ? "warning" : rating.rating === "Red" ? "danger" : "neutral";
      return MGI.utils.el("span", {
        className: "pill tone-" + tone,
        text: rating.label + (rating.value ? " (" + rating.value + ")" : "")
      });
    },

    confirm: function (options) {
      return new Promise(function (resolve) {
        var dialog = MGI.utils.byId("confirm-dialog");
        MGI.utils.byId("confirm-title").textContent = options.title || "Please confirm";
        MGI.utils.byId("confirm-body").textContent = options.body || "";
        var extra = MGI.utils.byId("confirm-extra");
        MGI.utils.clear(extra);
        if (options.extra) extra.appendChild(MGI.utils.el("p", { text: options.extra }));
        var okBtn = MGI.utils.byId("confirm-ok");
        okBtn.textContent = options.okText || "Confirm";
        lastFocus = document.activeElement;
        function cleanup(result) {
          okBtn.removeEventListener("click", onOk);
          cancelBtn.removeEventListener("click", onCancel);
          dialog.removeEventListener("cancel", onCancel);
          dialog.close();
          if (lastFocus && lastFocus.focus) lastFocus.focus();
          resolve(result);
        }
        function onOk() { cleanup(true); }
        function onCancel(e) {
          if (e) e.preventDefault();
          cleanup(false);
        }
        var cancelBtn = MGI.utils.byId("confirm-cancel");
        okBtn.addEventListener("click", onOk);
        cancelBtn.addEventListener("click", onCancel);
        dialog.addEventListener("cancel", onCancel);
        dialog.showModal();
        cancelBtn.focus();
      });
    },

    openDialog: function (id) {
      lastFocus = document.activeElement;
      var dialog = MGI.utils.byId(id);
      dialog.showModal();
      var focusable = dialog.querySelector("button, [href], input, select, textarea");
      if (focusable) focusable.focus();
    },

    closeDialog: function (id) {
      var dialog = MGI.utils.byId(id);
      if (dialog.open) dialog.close();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    },

    setFieldError: function (input, message) {
      var id = input.id + "-error";
      var err = MGI.utils.byId(id);
      if (!err) return;
      err.textContent = message || "";
      if (message) {
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-describedby", id);
      } else {
        input.removeAttribute("aria-invalid");
      }
    },

    clearFormErrors: function (form) {
      form.querySelectorAll(".field-error").forEach(function (el) {
        el.textContent = "";
      });
      form.querySelectorAll("[aria-invalid]").forEach(function (el) {
        el.removeAttribute("aria-invalid");
      });
    },

    fillSelect: function (select, items, selected) {
      MGI.utils.clear(select);
      items.forEach(function (item) {
        var opt = document.createElement("option");
        opt.value = item.value;
        opt.textContent = item.label;
        if (String(item.value) === String(selected)) opt.selected = true;
        select.appendChild(opt);
      });
    },

    studentOptions: function (includeAll) {
      var list = MGI.state.students.slice().sort(function (a, b) {
        return a.fullName.localeCompare(b.fullName);
      });
      var items = includeAll ? [{ value: "", label: "All students" }] : [];
      list.forEach(function (s) {
        items.push({ value: s.id, label: s.fullName + " (" + s.studentCode + ")" });
      });
      return items;
    },

    empty: function (message, actions) {
      var box = MGI.utils.el("div", { className: "empty-state" });
      box.appendChild(MGI.utils.el("p", { text: message }));
      (actions || []).forEach(function (action) {
        var btn = MGI.utils.el("button", { type: "button", className: action.className || "btn", text: action.label });
        btn.addEventListener("click", action.onClick);
        box.appendChild(btn);
      });
      return box;
    },

    metric: function (label, value, hint) {
      var card = MGI.utils.el("article", { className: "metric-card" });
      card.appendChild(MGI.utils.el("p", { className: "metric-label", text: label }));
      card.appendChild(MGI.utils.el("p", { className: "metric-value", text: value == null ? "N/A" : String(value) }));
      if (hint) card.appendChild(MGI.utils.el("p", { className: "metric-hint", text: hint }));
      return card;
    }
  };

  global.MGI = MGI;
})(window);
