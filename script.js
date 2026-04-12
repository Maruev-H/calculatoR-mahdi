(function () {
  "use strict";

  // С взносом
  var RATES_WITH = {
    3: 9, 4: 12, 5: 15, 6: 18, 7: 21, 8: 24, 9: 27, 10: 30, 11: 33, 12: 35
  };

  // Без взноса
  var RATES_WITHOUT = {
    3: 12, 4: 16, 5: 20, 6: 24,
    7: 28, 8: 32, 9: 36, 10: 40, 11: 44, 12: 45
  };

  var form = document.getElementById("calc-form");
  var priceEl = document.getElementById("price");
  var downEl = document.getElementById("down");
  var monthsEl = document.getElementById("months");
  var downBlock = document.getElementById("down-block");
  var downHint = document.getElementById("down-hint");
  var rowDown = document.getElementById("row-down");
  var outDown = document.getElementById("out-down");
  var outMarkup = document.getElementById("out-markup");
  var outTotal = document.getElementById("out-total");
  var outMonthly = document.getElementById("out-monthly");
  var waLink = document.getElementById("wa-link");

  function formatMoney(n) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0
    }).format(Math.round(n));
  }

  function roundTo50(n) {
    if (!isFinite(n)) return n;
    var sign = n < 0 ? -1 : 1;
    var x = Math.abs(n);
    var low = Math.floor(x / 50) * 50;
    var r = x - low;
    if (r > 25) return sign * (low + 50);
    return sign * low;
  }

  function getHasDown() {
    var r = form.querySelector('input[name="hasDown"]:checked');
    return r && r.value === "yes";
  }

  function getPrice() {
    var v = parseFloat(String(priceEl.value).replace(",", "."));
    return isFinite(v) && v > 0 ? v : NaN;
  }

  function getMonths() {
    return parseInt(monthsEl.value, 10) || 3;
  }

  /** Ниже минимального взноса — ставка как «без взноса». */
  function getEffectiveRatePercent(price, down, hasDown) {
    var m = getMonths();
    if (!hasDown) {
      return RATES_WITHOUT[m] != null ? RATES_WITHOUT[m] : 0;
    }
    if (!isFinite(price)) {
      return RATES_WITH[m] != null ? RATES_WITH[m] : 0;
    }
    var rateWith = RATES_WITH[m] != null ? RATES_WITH[m] : 0;
    var minFav = getMinDown(price, rateWith);
    var d = isFinite(down) ? down : 0;
    if (d >= minFav) {
      return rateWith;
    }
    return RATES_WITHOUT[m] != null ? RATES_WITHOUT[m] : 0;
  }

  /**
   * Итого: ближайшее к rawTotal, кратное (months + (первый взнос?1:0))×50,
   * и (итого − взнос) / months кратно 50 без округления платежа.
   */
  function alignTotalForEqualMonthly(rawTotal, months, hasDown, down) {
    var m50 = months * 50;
    var t = Math.round(rawTotal);
    if (m50 <= 0) return t;

    if (!hasDown) {
      return Math.round(t / m50) * m50;
    }

    var d = Math.round(down);
    var r = ((d % m50) + m50) % m50;
    var r50 = r / 50;
    var L = (months + 1) * 50;
    var T0 = r50 * L;
    var step = months * L;

    var tCenter = Math.round((t - T0) / step);
    var best = NaN;
    var bestDist = Infinity;
    for (var dt = -8; dt <= 8; dt++) {
      var T = T0 + (tCenter + dt) * step;
      if (T <= d) continue;
      var dist = Math.abs(T - t);
      if (dist < bestDist) {
        bestDist = dist;
        best = T;
      }
    }

    if (!isFinite(best)) {
      var kMin = Math.ceil((d - r + 1) / m50);
      var kIdeal = Math.round((t - r) / m50);
      var k0 = kIdeal < kMin ? kMin : kIdeal;
      for (var k = k0 - 2; k <= k0 + 8; k++) {
        if (k < kMin) continue;
        var c = r + k * m50;
        if (c <= d) continue;
        var dist2 = Math.abs(c - t);
        if (dist2 < bestDist) {
          bestDist = dist2;
          best = c;
        }
      }
    }

    return isFinite(best) ? best : t;
  }

  // 🔥 25% от итоговой суммы
  function getMinDown(price) {
    var total = price;
    var exact = total * 0.25;
    return Math.ceil(exact / 50) * 50;
  }

  function getMaxDown(price) {
    return Math.floor(price / 50) * 50;
  }

  function isMultipleOf50Rub(n) {
    if (!isFinite(n) || n < 0) return false;
    var x = Math.round(n);
    if (Math.abs(n - x) > 1e-6) return false;
    return x % 50 === 0;
  }

  function fillMonths() {
    var html = "";
    for (var i = 3; i <= 12; i++) {
      html += '<option value="' + i + '">' + i + " мес.</option>";
    }
    monthsEl.innerHTML = html;
    monthsEl.value = "6";
  }

  function syncDownFromPrice() {
    if (!getHasDown()) return;

    var p = getPrice();
    if (!isFinite(p)) return;

    var m = getMonths();
    var min = getMinDown(p, RATES_WITH[m] != null ? RATES_WITH[m] : 0);
    var max50 = getMaxDown(p);

    downEl.min = "0";
    downEl.max = String(max50);

    var cur = parseFloat(String(downEl.value).replace(",", "."));

    if (!isFinite(cur) || downEl.dataset.userEdited !== "1") {
      downEl.value = String(min <= max50 ? min : max50);
    } else if (cur > max50) {
      downEl.value = String(max50);
    }
  }

  function refreshDownHint() {
    if (!getHasDown()) return;

    var p = getPrice();
    var m = getMonths();
    var min = isFinite(p)
      ? getMinDown(p, RATES_WITH[m] != null ? RATES_WITH[m] : 0)
      : 0;
    var max50 = isFinite(p) ? getMaxDown(p) : 0;
    var cur = parseFloat(String(downEl.value).replace(",", "."));

    if (isFinite(p)) {
      downEl.min = "0";
      downEl.max = String(max50);
    }

    if (!isFinite(p)) {
      downHint.textContent = "";
      downHint.classList.remove("is-error");
      return;
    }

    if (isFinite(cur) && cur > p) {
      downHint.textContent = "Взнос не может быть больше стоимости товара";
      downHint.classList.add("is-error");
    } else if (isFinite(cur) && !isMultipleOf50Rub(cur)) {
      downHint.textContent = "Взнос должен быть кратен 50 ₽";
      downHint.classList.add("is-error");
    } else if (isFinite(cur) && cur < min) {
      downHint.textContent =
        "Ниже " +
        formatMoney(min) +
        " — ставка как без взноса (минимум для ставки «с взносом»: 25% от итоговой с ней)";
      downHint.classList.remove("is-error");
    } else {
      downHint.textContent =
        "Кратно 50 ₽, от " + formatMoney(min) + " — ставка «с взносом»";
      downHint.classList.remove("is-error");
    }
  }

  function onPriceInput() {
    syncDownFromPrice();
    refreshDownHint();
    recalc();
  }

  function onDownInput() {
    downEl.dataset.userEdited = "1";
    refreshDownHint();
    recalc();
  }

  function recalc() {
    var price = getPrice();
    var months = getMonths();
    var hasDown = getHasDown();

    if (!isFinite(price)) {
      outDown.textContent = "—";
      outMarkup.textContent = "—";
      outTotal.textContent = "—";
      outMonthly.textContent = "—";
      updateWhatsApp(null);
      return;
    }

    var down = 0;

    if (hasDown) {
      down = parseFloat(String(downEl.value).replace(",", ".")) || 0;

      var maxDown = getMaxDown(price);

      if (down > price) {
        outMonthly.textContent = "Взнос не может превышать стоимость";
        updateWhatsApp(null);
        return;
      }

      if (!isMultipleOf50Rub(down)) {
        outMonthly.textContent = "Взнос должен быть кратен 50 ₽";
        updateWhatsApp(null);
        return;
      }

      if (down > maxDown) {
        outMonthly.textContent = "Максимум: " + formatMoney(maxDown);
        updateWhatsApp(null);
        return;
      }
    }

    var rateWith = RATES_WITH[months] != null ? RATES_WITH[months] : 0;
    var minFav = getMinDown(price, rateWith);

    var markup = 0;
    var total = 0;
    var monthly = 0;
    var markupShown = 0;

    // 🔥 SPECIAL BOOST (крупный взнос — наценка со ставки «без взноса» на остаток)
    var specialBoost = hasDown && down >= minFav + 5000;

    if (specialBoost) {
      var rateWithout = RATES_WITHOUT[months] || 0;

      markup = roundTo50((price - down) * (rateWithout / 100));
      var rawTotalSb = roundTo50(price + markup);
      total = alignTotalForEqualMonthly(rawTotalSb, months, hasDown, down);
      markupShown = total - price;
      monthly = (total - down) / months;
    } else {
      var rate = getEffectiveRatePercent(price, down, hasDown);
      markup = roundTo50(price * (rate / 100));
      var rawTotal = roundTo50(price + markup);
      total = alignTotalForEqualMonthly(rawTotal, months, hasDown, down);
      markupShown = total - price;
      monthly = hasDown ? (total - down) / months : total / months;
    }

    if (hasDown) {
      rowDown.classList.remove("is-hidden");
      outDown.textContent = formatMoney(down);
    } else {
      rowDown.classList.add("is-hidden");
    }

    outMarkup.textContent = formatMoney(markupShown);
    outTotal.textContent = formatMoney(total);
    outMonthly.textContent = formatMoney(monthly);

    updateWhatsApp({
      price: price,
      months: months,
      hasDown: hasDown,
      down: down,
      monthly: monthly,
      total: total
    });
  }

  function onHasDownChange() {
    if (getHasDown()) {
      downBlock.classList.remove("is-hidden");
      downEl.dataset.userEdited = "";
      syncDownFromPrice();
      refreshDownHint();
    } else {
      downBlock.classList.add("is-hidden");
      downHint.textContent = "";
      downHint.classList.remove("is-error");
    }
    recalc();
  }

  fillMonths();

  form.querySelectorAll('input[name="hasDown"]').forEach(function (el) {
    el.addEventListener("change", onHasDownChange);
  });

  function updateWhatsApp(data) {
    if (!waLink) return;

    if (!data) {
      waLink.href =
        "https://wa.me/?text=" +
        encodeURIComponent("Заполните форму для расчёта рассрочки");
      return;
    }

    var lines = [
      "Стоимость товара: " + formatMoney(data.price),
      "Срок: " + data.months + " мес.",
      "Взнос: " + (data.hasDown ? "Да" : "Нет")
    ];

    if (data.hasDown) {
      lines.push("Первый взнос: " + formatMoney(data.down));
    }

    lines.push(
      "Ежемесячный платёж: " + formatMoney(data.monthly),
      "Итоговая стоимость: " + formatMoney(data.total)
    );

    waLink.href =
      "https://wa.me/?text=" + encodeURIComponent(lines.join("\n"));
  }

  priceEl.addEventListener("input", onPriceInput);
  priceEl.addEventListener("change", onPriceInput);

  downEl.addEventListener("input", onDownInput);
  downEl.addEventListener("change", onDownInput);

  monthsEl.addEventListener("change", function () {
    syncDownFromPrice();
    refreshDownHint();
    recalc();
  });

  onHasDownChange();
  recalc();
})();