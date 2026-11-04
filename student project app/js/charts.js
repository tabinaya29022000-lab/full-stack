(function (global) {
  var MGI = global.MGI || {};

  function svgEl(name, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach(function (k) {
      node.setAttribute(k, attrs[k]);
    });
    return node;
  }

  MGI.charts = {
    bars: function (title, items) {
      var wrap = MGI.utils.el("figure", { className: "chart-card" });
      wrap.appendChild(MGI.utils.el("figcaption", { text: title }));
      var max = items.reduce(function (m, i) { return Math.max(m, Number(i.value) || 0); }, 0) || 1;
      var list = MGI.utils.el("div", { className: "bar-chart" });
      items.forEach(function (item) {
        var row = MGI.utils.el("div", { className: "bar-row" });
        row.appendChild(MGI.utils.el("span", { className: "bar-label", text: item.label }));
        var track = MGI.utils.el("div", { className: "bar-track", role: "img", "aria-label": item.label + " " + item.value });
        var fill = MGI.utils.el("span", { className: "bar-fill" });
        fill.style.width = ((Number(item.value) || 0) / max) * 100 + "%";
        if (item.tone) fill.classList.add("tone-" + item.tone);
        track.appendChild(fill);
        row.appendChild(track);
        row.appendChild(MGI.utils.el("span", { className: "bar-value", text: String(item.value) }));
        list.appendChild(row);
      });
      wrap.appendChild(list);
      return wrap;
    },

    donut: function (title, items) {
      var wrap = MGI.utils.el("figure", { className: "chart-card" });
      wrap.appendChild(MGI.utils.el("figcaption", { text: title }));
      var total = items.reduce(function (s, i) { return s + (Number(i.value) || 0); }, 0);
      var svg = svgEl("svg", { viewBox: "0 0 42 42", class: "donut", role: "img", "aria-label": title });
      svg.appendChild(svgEl("circle", { cx: "21", cy: "21", r: "15.915", fill: "transparent", stroke: "#d5dde5", "stroke-width": "4" }));
      var offset = 25;
      if (total === 0) {
        wrap.appendChild(MGI.utils.el("p", { className: "empty-inline", text: "No data to chart" }));
        return wrap;
      }
      items.forEach(function (item, idx) {
        var pct = ((Number(item.value) || 0) / total) * 100;
        var circle = svgEl("circle", {
          cx: "21",
          cy: "21",
          r: "15.915",
          fill: "transparent",
          "stroke-width": "4",
          stroke: ["#0f6e7a", "#c62828", "#b86e00", "#1b7a4e", "#1565c0"][idx % 5],
          "stroke-dasharray": pct + " " + (100 - pct),
          "stroke-dashoffset": String(offset)
        });
        offset -= pct;
        svg.appendChild(circle);
      });
      wrap.appendChild(svg);
      var legend = MGI.utils.el("ul", { className: "chart-legend" });
      items.forEach(function (item) {
        var li = MGI.utils.el("li");
        li.appendChild(document.createTextNode(item.label + " — " + item.value));
        legend.appendChild(li);
      });
      wrap.appendChild(legend);
      return wrap;
    },

    progress: function (label, pct) {
      var wrap = MGI.utils.el("div", { className: "progress-block" });
      var shown = pct === null || pct === undefined ? "N/A" : MGI.utils.pct(pct);
      wrap.appendChild(MGI.utils.el("div", { className: "progress-label", text: label + " — " + shown }));
      var track = MGI.utils.el("div", { className: "progress-track", role: "progressbar", "aria-valuetext": shown });
      var fill = MGI.utils.el("span");
      fill.style.width = pct == null ? "0%" : Math.max(0, Math.min(100, pct)) + "%";
      track.appendChild(fill);
      wrap.appendChild(track);
      return wrap;
    }
  };

  global.MGI = MGI;
})(window);
