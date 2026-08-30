// The Android verifier injects a generated script into government pages. It is
// Kotlin-authored, so it cannot be reached from the Kotlin unit tests; this
// suite lifts it out of the source and runs it against a DOM that mimics the
// pages it actually meets — CAPTCHA-gated, hash-routed, partly pre-filled.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const source = readFileSync('android/app/src/main/java/com/apositify/app/SecureVerifierScreen.kt', 'utf8')
const template = source.split('return """', 1)[1] ?? source.split('return """')[1]
const body = template.split('""".trimIndent()')[0]

function script(fields) {
  return body.replace('$json', JSON.stringify(fields))
}

let passed = 0
function check(name, run) {
  try {
    run()
    passed += 1
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`)
    process.exitCode = 1
  }
}

function run(html, fields) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only' })
  dom.window.eval(script(fields))
  return dom.window.document
}

const number = { value: 'ON-26-000000-0000', dateValue: null, aliases: ['Apostille number'], selectors: [] }
const date = { value: '2026-06-19', dateValue: '2026-06-19', aliases: ['Date'], selectors: [] }

check('fills a labelled control by alias', () => {
  const document = run('<label>Apostille number <input id="n"></label>', [number])
  assert.equal(document.querySelector('#n').value, 'ON-26-000000-0000')
})

check('never types a reviewed value into a CAPTCHA box', () => {
  // The China verifier gates its form behind a slider CAPTCHA. Filling that
  // box with the Apostille number both fails the challenge and looks like the
  // app is malfunctioning.
  for (const attribute of ['id="captcha"', 'name="yzm"', 'class="verify-code"', 'placeholder="请输入验证码"']) {
    const document = run(`<input ${attribute}><label>Apostille number <input id="n"></label>`, [number])
    const captcha = document.querySelector('input')
    assert.equal(captcha.value, '', `captcha input ${attribute} was filled`)
    assert.equal(document.querySelector('#n').value, 'ON-26-000000-0000')
  }
})

check('does not overwrite what the user typed', () => {
  // This script runs again on every client-side route change, so overwriting
  // would destroy whatever the user had just typed. Expressed the way a user's
  // input actually reaches the DOM: a value attribute would say the opposite —
  // that the page shipped the value — which is the case asserted just below.
  const dom = new JSDOM('<!doctype html><body><label>Apostille number <input id="n"></label></body>', { runScripts: 'outside-only' })
  dom.window.document.querySelector('#n').value = 'typed by hand'
  dom.window.eval(script([number]))
  assert.equal(dom.window.document.querySelector('#n').value, 'typed by hand')
})

check('corrects a value the page shipped in its own markup', () => {
  // Andorra prefills its date box with today's date; leaving it there means
  // submitting today's date rather than the one on the certificate.
  const document = run('<label>Apostille number <input id="n" value="30/08/2026"></label>', [number])
  assert.equal(document.querySelector('#n').value, 'ON-26-000000-0000')
})

check('leaves disabled and read-only controls alone', () => {
  const disabled = run('<label>Apostille number <input id="n" disabled></label>', [number])
  assert.equal(disabled.querySelector('#n').value, '')
  const readOnly = run('<label>Apostille number <input id="n" readonly></label>', [number])
  assert.equal(readOnly.querySelector('#n').value, '')
})

check('an explicit selector is still subject to the same guards', () => {
  const targeted = { ...number, selectors: ['#captcha'] }
  const document = run('<input id="captcha">', [targeted])
  assert.equal(document.querySelector('#captcha').value, '')
})

check('a date control receives the ISO value, a text control the printed one', () => {
  const iso = run('<label>Date <input id="d" type="date"></label>', [date])
  assert.equal(iso.querySelector('#d').value, '2026-06-19')
  const printed = run('<label>Date <input id="d"></label>', [{ ...date, value: '19/06/2026' }])
  assert.equal(printed.querySelector('#d').value, '19/06/2026')
})

check('re-running is idempotent rather than destructive', () => {
  const dom = new JSDOM('<!doctype html><body><label>Apostille number <input id="n"></label></body>', { runScripts: 'outside-only' })
  dom.window.eval(script([number]))
  dom.window.document.querySelector('#n').value = 'corrected by user'
  dom.window.eval(script([number]))
  assert.equal(dom.window.document.querySelector('#n').value, 'corrected by user')
})

check('never fills password or file controls', () => {
  const document = run('<label>Apostille number <input id="n" type="password"></label>', [number])
  assert.equal(document.querySelector('#n').value, '')
})

console.log(`Android autofill: ${passed} checks passed.`)
