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

  function getRatePercent() {
    var m = getMonths();
    var table = getHasDown() ? RATES_WITH : RATES_WITHOUT;
    return table[m] != null ? table[m] : 0;
  }

  // 🔥 25% от итоговой суммы
  function getMinDown(price, ratePercent) {
    var r = ratePercent / 100;
    var total = price * (1 + r);
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

    var min = getMinDown(p, getRatePercent());
    var max50 = getMaxDown(p);

    downEl.min = String(min);
    downEl.max = String(max50);

    var cur = parseFloat(String(downEl.value).replace(",", "."));

    if (!isFinite(cur) || downEl.dataset.userEdited !== "1") {
      downEl.value = String(min <= max50 ? min : max50);
    } else if (cur > max50) {
      downEl.value = String(max50);
    } else if (cur < min) {
      downEl.value = String(min);
    }
  }

  function refreshDownHint() {
    if (!getHasDown()) return;

    var p = getPrice();
    var min = isFinite(p) ? getMinDown(p, getRatePercent()) : 0;
    var max50 = isFinite(p) ? getMaxDown(p) : 0;
    var cur = parseFloat(String(downEl.value).replace(",", "."));

    if (isFinite(p)) {
      downEl.min = String(min);
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
        "Минимум " + formatMoney(min) + " (25% от итоговой суммы)";
      downHint.classList.add("is-error");
    } else {
      downHint.textContent =
        "Кратно 50 ₽, не менее 25% от итоговой суммы";
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
    var rate = getRatePercent();

    if (!isFinite(price)) {
      outDown.textContent = "—";
      outMarkup.textContent = "—";
      outTotal.textContent = "—";
      outMonthly.textContent = "—";
      return;
    }

    var down = 0;

    if (hasDown) {
      down = parseFloat(String(downEl.value).replace(",", ".")) || 0;

      var minDown = getMinDown(price, rate);
      var maxDown = getMaxDown(price);

      if (down > price) {
        outMonthly.textContent = "Взнос не может превышать стоимость";
        return;
      }

      if (!isMultipleOf50Rub(down)) {
        outMonthly.textContent = "Взнос должен быть кратен 50 ₽";
        return;
      }

      if (down > maxDown) {
        outMonthly.textContent = "Максимум: " + formatMoney(maxDown);
        return;
      }

      if (down < minDown) {
        outMonthly.textContent = "Минимальный взнос 25% от итоговой суммы";
        return;
      }
    }

    var markup = roundTo50(price * (rate / 100));
    var total = roundTo50(price + markup);

    var monthly = hasDown
      ? roundTo50((total - down) / months)
      : roundTo50(total / months);

    if (hasDown) {
      rowDown.classList.remove("is-hidden");
      outDown.textContent = formatMoney(down);
    } else {
      rowDown.classList.add("is-hidden");
    }

    outMarkup.textContent = formatMoney(markup);
    outTotal.textContent = formatMoney(total);
    outMonthly.textContent = formatMoney(monthly);
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