import { useCallback, useMemo, useState } from 'react'
import {
  MONTH_OPTIONS,
  buildWhatsAppHref,
  calculate,
  formatMoney,
  getDownHint,
  getMaxDown,
  getRecommendedDown,
  isCalcError,
  parseDown,
  parsePrice,
  type CalcSuccess,
} from './lib/calculator'
import './App.css'

function App() {
  const [hasDown, setHasDown] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const [downInput, setDownInput] = useState('0')
  const [months, setMonths] = useState(6)
  const [downUserEdited, setDownUserEdited] = useState(false)

  const price = useMemo(() => parsePrice(priceInput), [priceInput])
  const down = useMemo(() => parseDown(downInput), [downInput])

  const syncRecommendedDown = useCallback(
    (p: number, userEdited: boolean, currentDown: number) => {
      if (!isFinite(p)) return
      const max50 = getMaxDown(p)
      if (!userEdited) {
        const rec = getRecommendedDown(p)
        setDownInput(String(Math.min(rec, max50)))
      } else if (isFinite(currentDown) && currentDown > max50) {
        setDownInput(String(max50))
      }
    },
    [],
  )

  const handleHasDownChange = (value: boolean) => {
    setHasDown(value)
    if (value) {
      setDownUserEdited(false)
      if (isFinite(price)) {
        syncRecommendedDown(price, false, down)
      }
    } else {
      setDownInput('0')
      setDownUserEdited(false)
    }
  }

  const handlePriceChange = (value: string) => {
    setPriceInput(value)
    const p = parsePrice(value)
    if (hasDown && isFinite(p)) {
      syncRecommendedDown(p, downUserEdited, parseDown(downInput))
    }
  }

  const handleDownChange = (value: string) => {
    setDownUserEdited(true)
    setDownInput(value)
  }

  const handleMonthsChange = (value: number) => {
    setMonths(value)
    if (hasDown && isFinite(price)) {
      syncRecommendedDown(price, downUserEdited, down)
    }
  }

  const applyRecommendedDown = () => {
    if (!hasDown || !isFinite(price)) return
    setDownUserEdited(false)
    const rec = getRecommendedDown(price)
    const max50 = getMaxDown(price)
    setDownInput(String(Math.min(rec, max50)))
  }

  const result = useMemo(
    () => calculate(price, months, hasDown, down),
    [price, months, hasDown, down],
  )

  const calcData: CalcSuccess | null = result.ok ? result : null
  const waHref = useMemo(() => buildWhatsAppHref(calcData), [calcData])

  const downHint = hasDown ? getDownHint(price, down) : null
  const maxDown = isFinite(price) ? getMaxDown(price) : 0

  const displayDown = result.ok && result.hasDown ? formatMoney(result.down) : '—'
  const displayMarkup = result.ok ? formatMoney(result.markupAmount) : '—'
  const displayTotal = result.ok ? formatMoney(result.totalPay) : '—'
  const displayMonthly = isCalcError(result)
    ? (result.monthlyMessage ?? '—')
    : formatMoney(result.monthly)

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Darul Finance</h1>
        <p className="subtitle">Калькулятор рассрочки</p>
      </header>

      <main className="main">
        <form className="card form" id="calc-form" noValidate onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <span className="label">Первый взнос</span>
            <div className="toggle" role="group" aria-label="Первый взнос">
              <label className="toggle__opt">
                <input
                  type="radio"
                  name="hasDown"
                  value="no"
                  checked={!hasDown}
                  onChange={() => handleHasDownChange(false)}
                />
                <span>Без взноса</span>
              </label>
              <label className="toggle__opt">
                <input
                  type="radio"
                  name="hasDown"
                  value="yes"
                  checked={hasDown}
                  onChange={() => handleHasDownChange(true)}
                />
                <span>Со взносом</span>
              </label>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="price">
              Стоимость товара, ₽
            </label>
            <input
              className="input"
              type="number"
              id="price"
              name="price"
              inputMode="decimal"
              min={1}
              step={1}
              placeholder="Например, 45000"
              required
              value={priceInput}
              onChange={(e) => handlePriceChange(e.target.value)}
            />
          </div>

          <div className={`field field--down${hasDown ? '' : ' is-hidden'}`}>
            <label className="label" htmlFor="down">
              Первый взнос, ₽
            </label>
            <input
              className="input"
              type="number"
              id="down"
              name="down"
              inputMode="numeric"
              min={0}
              max={maxDown || undefined}
              step={50}
              value={downInput}
              onChange={(e) => handleDownChange(e.target.value)}
            />
            {downHint && downHint.kind === 'error' && (
              <p className="hint is-error">{downHint.message}</p>
            )}
            {downHint && downHint.kind === 'recommend' && (
              <p className="hint">
                Рекомендованный первый взнос —{' '}
                <button
                  type="button"
                  className="hint-rec"
                  aria-label="Подставить рекомендованную сумму в поле"
                  onClick={applyRecommendedDown}
                >
                  {formatMoney(downHint.recommended)}
                </button>
                . Кратно 50 ₽, не больше цены товара.
              </p>
            )}
            {downHint && downHint.kind === 'empty' && <p className="hint" />}
          </div>

          <div className="field">
            <label className="label" htmlFor="months">
              Срок, месяцев
            </label>
            <select
              className="input input--select"
              id="months"
              name="months"
              value={months}
              onChange={(e) => handleMonthsChange(parseInt(e.target.value, 10))}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} мес.
                </option>
              ))}
            </select>
          </div>
        </form>

        <section className="card results" aria-live="polite">
          <h2 className="results__title">Расчёт</h2>
          <ul className="results__list">
            <li
              className={`results__row results__row--down${result.ok && result.hasDown ? '' : ' is-hidden'}`}
            >
              <span className="results__label">Первый взнос</span>
              <span className="results__value">{displayDown}</span>
            </li>
            <li className="results__row">
              <span className="results__label">Наценка</span>
              <span className="results__value">{displayMarkup}</span>
            </li>
            <li className="results__row results__row--total">
              <span className="results__label">Итого к оплате</span>
              <span className="results__value">{displayTotal}</span>
            </li>
            <li className="results__row results__row--accent">
              <span className="results__label">Ежемесячный платёж</span>
              <span className="results__value">{displayMonthly}</span>
            </li>
          </ul>
        </section>

        <a
          className="wa-btn"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg className="wa-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
            />
          </svg>
          Оформить заявку
        </a>
      </main>
    </div>
  )
}

export default App
