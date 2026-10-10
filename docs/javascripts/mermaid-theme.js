/**
 * Перерисовка схем Mermaid при смене цветовой темы (светлая/тёмная).
 *
 * Проблема: схемы рендерятся один раз при загрузке страницы темой,
 * активной в этот момент. При переключении темы уже нарисованные
 * диаграммы сохраняют старые цвета и теряют читаемость.
 *
 * Решение: исходный код каждой схемы сохраняется в data-атрибуте;
 * при смене атрибута data-md-color-scheme на <body> (это делает
 * переключатель темы Material) все схемы восстанавливаются из
 * исходника и рендерятся заново темой, соответствующей новой схеме.
 */
(function () {
  "use strict";

  function currentTheme() {
    var scheme = document.body.getAttribute("data-md-color-scheme");
    return scheme === "slate" ? "dark" : "default";
  }

  function collectNodes() {
    return Array.prototype.slice.call(document.querySelectorAll("pre.mermaid"));
  }

  function saveSources() {
    collectNodes().forEach(function (el) {
      if (!el.dataset.mermaidSource) {
        el.dataset.mermaidSource = el.textContent.trim();
      }
    });
  }

  function rerenderAll() {
    if (!window.mermaid) {
      return; // библиотека ещё не подгружена — схемы ещё не рисовались
    }
    window.mermaid.initialize({ startOnLoad: false, theme: currentTheme() });
    var nodes = collectNodes();
    nodes.forEach(function (el) {
      if (el.dataset.mermaidSource) {
        el.removeAttribute("data-processed");
        el.textContent = el.dataset.mermaidSource;
      }
    });
    if (nodes.length === 0) {
      return;
    }
    try {
      if (typeof window.mermaid.run === "function") {
        window.mermaid.run({ nodes: nodes });
      } else if (typeof window.mermaid.init === "function") {
        window.mermaid.init(undefined, nodes);
      }
    } catch (e) {
      // не роняем страницу из-за ошибки перерисовки
      if (window.console) {
        console.warn("mermaid re-render failed:", e);
      }
    }
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    saveSources();
    if (document.body && typeof MutationObserver !== "undefined") {
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].attributeName === "data-md-color-scheme") {
            rerenderAll();
            break;
          }
        }
      });
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-md-color-scheme"]
      });
    }
  });
})();
