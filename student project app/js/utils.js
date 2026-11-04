(function (global) {
  var MGI = global.MGI || {};

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  MGI.utils = {
    clone: function (value) {
      return JSON.parse(JSON.stringify(value));
    },

    uuid: function () {
      if (global.crypto && typeof global.crypto.randomUUID === "function") {
        return global.crypto.randomUUID();
      }
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },

    today: function () {
      var d = new Date();
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    },

    nowIso: function () {
      return new Date().toISOString();
    },

    parseDate: function (iso) {
      if (!iso || typeof iso !== "string") return null;
      var parts = iso.split("-");
      if (parts.length !== 3) return null;
      var y = Number(parts[0]);
      var m = Number(parts[1]);
      var d = Number(parts[2]);
      if (!y || !m || !d) return null;
      var dt = new Date(y, m - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
      return dt;
    },

    isValidDate: function (iso) {
      return MGI.utils.parseDate(iso) !== null;
    },

    compareDate: function (a, b) {
      if (a === b) return 0;
      return a < b ? -1 : 1;
    },

    addDays: function (iso, days) {
      var dt = MGI.utils.parseDate(iso);
      if (!dt) return iso;
      dt.setDate(dt.getDate() + days);
      return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
    },

    formatDate: function (iso) {
      var dt = MGI.utils.parseDate(iso);
      if (!dt) return iso || "—";
      return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    },

    formatDateTime: function (iso) {
      if (!iso) return "—";
      var dt = new Date(iso);
      if (isNaN(dt.getTime())) return iso;
      return dt.toLocaleString("en-GB");
    },

    round1: function (n) {
      return Math.round(n * 10) / 10;
    },

    pct: function (n) {
      if (n === null || n === undefined || Number.isNaN(n)) return "N/A";
      return MGI.utils.round1(n).toFixed(1) + "%";
    },

    trim: function (value) {
      return String(value == null ? "" : value).trim();
    },

    normalizeId: function (value) {
      return MGI.utils.trim(value).toLowerCase();
    },

    initials: function (name) {
      var parts = MGI.utils.trim(name).split(/\s+/).filter(Boolean);
      if (!parts.length) return "?";
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },

    el: function (tag, attrs, children) {
      var node = document.createElement(tag);
      attrs = attrs || {};
      Object.keys(attrs).forEach(function (key) {
        var val = attrs[key];
        if (val == null || val === false) return;
        if (key === "text") node.textContent = val;
        else if (key === "html") node.innerHTML = val;
        else if (key === "className") node.className = val;
        else if (key === "dataset") {
          Object.keys(val).forEach(function (d) {
            node.dataset[d] = val[d];
          });
        } else if (key.slice(0, 2) === "on" && typeof val === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (val === true) node.setAttribute(key, key);
        else node.setAttribute(key, String(val));
      });
      (children || []).forEach(function (child) {
        if (child == null) return;
        if (typeof child === "string") node.appendChild(document.createTextNode(child));
        else node.appendChild(child);
      });
      return node;
    },

    clear: function (node) {
      while (node.firstChild) node.removeChild(node.firstChild);
      return node;
    },

    byId: function (id) {
      return document.getElementById(id);
    },

    csvEscape: function (value) {
      var str = value == null ? "" : String(value);
      if (/^[=+\-@]/.test(str)) str = "'" + str;
      if (/[",\n\r]/.test(str)) str = '"' + str.replace(/"/g, '""') + '"';
      return str;
    },

    download: function (filename, text, mime) {
      var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },

    signedPoints: function (type, points) {
      var n = Number(points) || 0;
      return type === "Negative" ? "−" + n : "+" + n;
    }
  };

  global.MGI = MGI;
})(window);
