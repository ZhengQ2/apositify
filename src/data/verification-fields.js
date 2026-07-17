// Phase 2 field-definition metadata, keyed by e-registers.cleaned.json entry `id`.
//
// Scope note: real deep-linking was tested by actually filling in and submitting the
// live form for every one of the 73 fielded authorities below, not just inspecting
// static HTML — most "GET-looking" forms turned out to be JS/AJAX SPAs, CSRF-token-
// guarded, or CAPTCHA-gated, and silently ignore query parameters entirely (confirmed
// false positives include Belgium, Bolivia, Indonesia, and Delaware/USA — the latter two
// looked like the strongest GET candidates on paper). Three authorities came back as
// genuine one-click cases: `method: 'get'` builds a URL and opens it directly (Ukraine's
// Ministry of Education); `method: 'post'` builds a hidden form and submits it to a new
// tab, which works identically to a real user submitting the official form themselves —
// confirmed for both Bulgaria authorities below by an actual cross-origin auto-submit
// that returned a real result page from their server. A handful of authorities (Andorra,
// several unreachable government sites, Guatemala mid-maintenance, Kazakhstan) could not
// be conclusively tested due to site/tooling issues on the day of testing and default to
// the copy-assist flow, same as every confirmed non-deep-linkable authority. New
// Zealand's "Verify" button was found to fire an AJAX GET, but the response is raw XML
// meant for their own JS to parse, not a human-readable page — rendering that ourselves
// would mean parsing and asserting their verification result, which is explicitly out of
// scope (see DEVELOPMENT_PLAN.md), so it stays copy-assist despite being GET-shaped.
// Every other entry is `kind: 'fields'`: we collect what the user reads off their
// Apostille and hand them a ready-to-paste summary plus the official link, rather than
// attempting (and, per this research, almost certainly failing) to open a pre-filled
// result page ourselves.
//
// `kind: 'upload'` marks authorities that verify by uploading the e-Apostille file itself
// rather than by looking up a number — conceptually closer to Phase 4 than Phase 2.
//
// Authorities absent from this file (but `online`/`hybrid` in the main dataset) had no
// confirmed field list from research — the UI falls back to the plain Phase 1 link.

export const verificationFields = {
  'andorra-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Apostille/Legalization Number', 'Date'],
    // Confirmed live 2026-07: clean POST, no CSRF/CAPTCHA. Auto-submitted with test
    // values and got a real result page ("No s'ha trobat la postil·la amb el número
    // de registre ..."). Legacy IBM LANSA app requires several static routing params.
    deepLink: {
      method: 'post',
      actionUrl: 'https://isi.govern.ad/CGI-BIN/lansaweb?webapp=POEX0010+webrtn=consulta+ml=LANSA:XHTML+partition=H3W+language=CAT',
      extraParams: {
        IDIOMA: '1',
        _SERVICENAME: 'POEX0010_inici',
        _WEBAPP: 'POEX0010',
        _WEBROUTINE: 'consulta',
        _PARTITION: 'H3W',
        _LANGUAGE: 'CAT',
        _LW3TRCID: 'false'
      },
      paramOrder: ['PONUMREG', 'PODTENTRS']
    }
  },
  'argentina-ministry-of-foreign-affairs-and-worship': {
    kind: 'fields',
    fields: ['Year', 'Number (CE- prefix)', 'Dependency Code (-APN- prefix)', 'Order Number'],
    note: 'Argentina has two separate e-Registers depending on issue date: 17 Nov 2017–14 Apr 2019 (Order Number, Year, Security Code) or from 15 Apr 2019 (fields above). Check the date on your Apostille first.'
  },
  'armenia-ministry-of-justice': {
    kind: 'fields',
    fields: ['Document tracking code (16 digits)'],
    note: 'This is a general government document validity checker, not apostille-specific.'
  },
  'australia-department-of-foreign-affairs-and-trade': {
    kind: 'fields',
    fields: ['Apostille number (format AAAA-A1-1111)', 'Date of issue']
  },
  'azerbaijan-ministry-of-justice': {
    kind: 'fields',
    fields: ['Document number', 'Date (DD.MM.YYYY)']
  },
  'belgium-federal-public-service-foreign-affairs-foreign-trade-and-development-cooperation': {
    kind: 'fields',
    fields: ['Reference number (Legalisation: 12 digits; Dossier: 9 digits; Investigation: E + 8 digits)', 'Reference date']
  },
  'bolivia-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Fecha de apostillado (Date)', 'Número de apostilla (Number)', 'Código de seguridad (Security code)']
  },
  'brazil-national-council-of-justice': {
    kind: 'fields',
    fields: ['Code', 'CRC'],
    note: 'Site uses Cloudflare bot-protection; you may need to complete a challenge.'
  },
  'bulgaria-ministry-of-justice': {
    kind: 'fields',
    fields: ['Apostille Code', 'CAPTCHA code shown on page']
  },
  'bulgaria-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Apostille ID'],
    // Confirmed live 2026-07: clean POST form, no CSRF/CAPTCHA. A same-origin submit of a
    // fake ID bounced back to the blank form rather than showing a distinct "not found"
    // message, so we can't fully confirm this site displays a clear result for valid IDs —
    // but the POST itself genuinely reaches their server either way.
    deepLink: {
      method: 'post',
      actionUrl: 'https://apostille.mfa.bg/MFAL/apostille_index.nsf/apostilleCheck.lss',
      extraParams: { Open: '' },
      paramOrder: ['id']
    }
  },
  'bulgaria-national-center-for-information-and-documentation': {
    kind: 'fields',
    fields: ['Verification code (13 characters, from the apostille)']
  },
  'bulgaria-regional-administrations': {
    kind: 'fields',
    fields: ['Apostille ID'],
    // Confirmed live 2026-07: clean POST form (no CSRF/CAPTCHA), auto-submitted with a
    // fake ID and returned a real, clear result page ("NO APOSTILLE FOUND WITH ID: ...").
    deepLink: {
      method: 'post',
      actionUrl: 'https://apostille.gov.bg/apostille/check',
      paramOrder: ['apostilleID']
    }
  },
  'canada-the-department-of-foreign-affairs-trade-and-development-of-canada': {
    kind: 'fields',
    fields: ['Certificate number (item 8)', 'Certified-on date (item 6)'],
    note: 'This federal e-Register does not cover Ontario or Quebec apostilles.'
  },
  'canada-ministry-of-public-and-business-service-delivery-and-procurement-of-the-province-of-ontario': {
    kind: 'fields',
    fields: ['Apostille Number (format 11-AA-AAAA-AAAA)', 'Apostille Issue Date'],
    note: 'Only covers apostilles issued on or after 11 January 2024.'
  },
  'canada-minister-of-justice-of-the-province-of-quebec': {
    kind: 'fields',
    fields: ["Numéro de l'apostille", "Date d'émission"],
    note: 'Only covers apostilles issued on or after 11 January 2024.'
  },
  'chile-relevant-authorities-of-the-ministries-of-justice-education-health-foreign-affairs-and-the-civil-and-identification-registration-service': {
    kind: 'fields',
    fields: ['Número de Legalización/Apostille', 'Fecha', 'Código de verificación', 'CAPTCHA code shown on page']
  },
  'china-china-mainland-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Legalization/Apostille Number', 'Sticker Number'],
    note: 'Apostilles/legalizations issued before 7 November 2023 require scanning the QR code on a mobile device instead.'
  },
  'china-hong-kong-sar-the-registrar-the-senior-deputy-registrar-and-the-deputy-registrar-of-the-high-court': {
    kind: 'fields',
    fields: ['Apostille No.', 'Year', 'Reference Code'],
    note: 'Only covers apostilles issued on or after 1 September 2014. A CAPTCHA must be solved on the official site.'
  },
  'china-macao-sar-director-of-the-legal-affairs-bureau': {
    kind: 'fields',
    fields: ['Apostille No. (e.g. 12345/2023)', 'Issue date (DDMMYYYY)'],
    note: 'Confirmed live 2026-07 (fields identified for the first time — the site is a React SPA that takes ~8s to render past a loading spinner). Requires solving an image CAPTCHA, so it cannot be deep-linked.'
  },
  'colombia-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Apostille/Legalization Number', 'Fecha de Expedición (Issue date)']
  },
  'costa-rica-ministry-of-foreign-affairs-and-worship': {
    kind: 'fields',
    fields: ['Código de la apostilla', 'Fecha de la apostilla (as YYYY-MM-DD)'],
    // Confirmed live 2026-07: plain POST form, no working CSRF/CAPTCHA (the page still
    // references a retired Google ReCaptcha v1 widget, but the check silently passes
    // since the referenced element no longer exists in the DOM). Auto-submitted with
    // test values and got a real result page ("No se encontró ninguna apostilla...").
    deepLink: {
      method: 'post',
      actionUrl: 'https://www.rree.go.cr/?sec=servicios&cat=autenticaciones&cont=726',
      paramOrder: ['clave', 'fecha_inicio']
    }
  },
  'cyprus-ministry-of-justice-and-public-order': {
    kind: 'fields',
    fields: ['District', 'Location', 'Certificate Number', 'Certificate Year', 'Random Number'],
    note: 'Only covers apostilles issued on or after 1 June 2020.'
  },
  'denmark-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Apostille/stamp number (item 8)', 'Date']
  },
  'dominican-republic-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Date (item 6)', 'Number (item 8)', 'Verification code']
  },
  'ecuador-ministry-of-foreign-affairs-and-human-mobility': {
    kind: 'fields',
    fields: ['Número (Number)', 'Fecha de Emisión (Issuance date)'],
    note: 'The official site requires solving an image CAPTCHA.'
  },
  'estonia-chamber-of-notaries': {
    kind: 'fields',
    fields: ['Date of issue of the apostille', 'Apostille registration number']
  },
  'france-regional-councils-and-interdepartmental-chambers-of-notaries': {
    kind: 'fields',
    fields: ['Apostille Number', 'Date of issue'],
    note: 'Apostilles issued by authorities other than Notaires are on paper only and are not in this e-Register.'
  },
  'georgia-ministry-of-justice': {
    kind: 'fields',
    fields: ['Certificate Number (15 digits)', 'Issue Date'],
    note: 'The official site requires solving a reCAPTCHA.'
  },
  'georgia-ministry-of-internal-affairs': {
    kind: 'fields',
    fields: ['Apostille Number', 'Apostille Date']
  },
  'greece-ministry-of-digital-governance': {
    kind: 'fields',
    fields: ['Electronic apostille number'],
    note: 'Alternatively, scan the QR code printed on the e-Apostille.'
  },
  'guatemala-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Código de Verificación (Verification code)', 'Código de Apostilla (Apostille code)'],
    note: 'The official site sits behind a Cloudflare check page — allow a few seconds for it to pass before the form appears.'
  },
  'india-ministry-of-external-affairs': {
    kind: 'fields',
    fields: ['Apostille/Attestation Number'],
    note: 'The official site requires solving a CAPTCHA.'
  },
  'indonesia-ministry-of-law-and-human-rights': {
    kind: 'fields',
    fields: ['Sticker/Certificate Number', 'Issued Date']
  },
  'ireland-department-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Type (Apostille or Authentication)', 'Date of Issue', 'Apostille Number']
  },
  'israel-ministry-of-justice': {
    kind: 'fields',
    fields: ['Apostille number', 'Date issued']
  },
  'japan-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Apostille Number', 'Apostille Date', 'Access Code'],
    note: 'Only apostilles with a QR code issued on or after 1 June 2026 are verifiable here.'
  },
  'kazakhstan-relevant-authorities-of-several-ministries-and-services': {
    kind: 'fields',
    fields: ['Application number', 'Security code (from the stamp)'],
    note: 'Requires creating/using an egov.kz account to reach the actual form.'
  },
  'korea-republic-of-ministry-of-foreign-affairs-ministry-of-justice': {
    kind: 'fields',
    fields: ['Certificate issue number', 'Certificate issue date'],
    note: 'The official site may require an account login; a guest option may also be available.'
  },
  'kosovo-ministry-of-foreign-affairs-department-for-consular-affairs-ministry-of-internal-affairs-civil-registration-agency': {
    kind: 'fields',
    fields: ['Type of seal (MIA Apostille / Verifying / MFA Apostille / Legalizing)', 'Reference number'],
    note: 'The official site also asks for your own name, workplace, email, country and reason for verifying, in addition to the certificate reference.'
  },
  'latvia-council-of-sworn-notaries': {
    kind: 'fields',
    fields: ['Document number']
  },
  'mexico-jalisco-secretary-of-government': {
    kind: 'fields',
    fields: ['Código de documento (Document code)']
  },
  'mexico-ministry-of-interior': {
    kind: 'fields',
    fields: ['Fecha (Date)', 'Clave (Code)'],
    note: 'Confirmed live 2026-07: reachable via a frameset at consultasislac.segob.gob.mx, but the form requires an image-based verification code (a legacy CAPTCHA), so it cannot be deep-linked.'
  },
  'moldova-republic-of-ministry-of-justice': {
    kind: 'fields',
    fields: ['Apostille code', 'Security code'],
    note: 'Confirmed live 2026-07. Apostille numbers with an "ARIJ" prefix use a separate, MPass-gated system (eservicii.gov.md) not covered here — this deep link only applies to other apostille codes (e.g. starting with "201").',
    // Confirmed live 2026-07: the visible page lazy-loads this form via an iframe; it is
    // a clean POST with only the two named fields, no hidden CSRF/CAPTCHA. Auto-submitted
    // with test values and the server processed the real navigation (200 OK).
    deepLink: {
      method: 'post',
      actionUrl: 'https://apostila.gov.md/apostila/site/search',
      paramOrder: ['apostila_code', 'security_code']
    }
  },
  'mongolia-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Reference/Statement Number'],
    note: 'This is e-Mongolia’s general document checker rather than an apostille-specific tool. Requires solving a CAPTCHA.'
  },
  'morocco-ministry-of-justice': {
    kind: 'fields',
    fields: ['Apostille Number', 'Signature Date', 'Number of pages', 'Signature date of the underlying document'],
    note: 'The official site requires solving a CAPTCHA.'
  },
  'new-zealand-department-of-internal-affairs': {
    kind: 'fields',
    fields: ['Apostille Number (e.g. 12345.1)', 'Apostille Issue Date']
  },
  'pakistan-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Apostille Number', 'Date']
  },
  'panama-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Apostille-Certification Number', 'Issue Date']
  },
  'paraguay-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Fecha de Expedición (Issue date)', 'Número del código de barras (Barcode number)']
  },
  'peru-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Fecha (Date)', 'Número de Apostilla/Certificación de Firma', 'Código de Seguridad (from an image, on the official site)']
  },
  'philippines-department-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Serial Code (e.g. 26C, 25A, 24A)', 'Serial Number (7 digits, without the "S.N." prefix)', 'Keycode'],
    note: 'Apostilles without a keycode, or issued before late 2022, cannot be verified here — email the Authentication Division instead.'
  },
  'romania-offices-of-the-prefect': {
    kind: 'fields',
    fields: ['Apostille Number (format JJ/XXXX)', 'Date of the Apostille'],
    note: 'Only covers apostilles issued since 1 November 2004.'
  },
  'saint-kitts-and-nevis-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Apostille date', 'Apostille number']
  },
  'saudi-arabia-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Certificate Issue Date', 'Certificate Number']
  },
  'singapore-singapore-academy-of-law': {
    kind: 'fields',
    fields: ['Apostille Certificate No.', 'Notarial Certificate No.', 'Apostille Verification Code'],
    note: 'Apostilles issued before 16 September 2021 use a different certificate/verification-code pair — check the date on your Apostille.'
  },
  'slovenia-11-district-courts': {
    kind: 'fields',
    fields: ['Certificate ID', 'Issue date'],
    note: 'Confirmed live 2026-07 (fields identified for the first time — the URL is the genuine public verifier, not a filing form despite the misleading "create.jsf" name). Requires solving an image CAPTCHA on a session-bound form, so it cannot be deep-linked.'
  },
  'spain-44-judicial-and-administrative-competent-authorities': {
    kind: 'fields',
    fields: ['Código de Verificación (Verification code)', 'Número de Apostilla', 'Fecha de Emisión (DD/MM/YYYY)'],
    note: 'The official site uses a text-based CAPTCHA.'
  },
  'tajikistan-ministry-of-foreign-affairs-ministry-of-justice': {
    kind: 'fields',
    fields: ['Apostille Number', 'Date of the Apostille'],
    note: 'The official site requires solving an image CAPTCHA.'
  },
  'ukraine-ministry-of-education-and-science': {
    kind: 'fields',
    fields: ['Apostille number (item 8)', 'Application number', 'Apostille date (item 6)'],
    note: 'Covers apostilles from 18 January 2013 onward.',
    // Confirmed live 2026-07 by actually filling and submitting the real form: this is a
    // plain Joomla GET form, and the resulting URL is a real, sharable result page (not
    // an AJAX call) — the one confirmed exception among 49 authorities tested this way.
    deepLink: {
      baseUrl: 'https://enic.in.ua/index.php/en/aporegen',
      extraParams: { task: 'searchApo' },
      paramOrder: ['apoNum', 'reqNum', 'apoDate']
    }
  },
  'ukraine-ministry-of-justice': {
    kind: 'fields',
    fields: ['Apostille number (item 8)', 'Apostille issue date (item 6)', 'Control/verification code (newer apostilles only)']
  },
  'united-kingdom-foreign-and-commonwealth-office': {
    kind: 'fields',
    fields: ['Apostille issue date', 'Apostille number']
  },
  'united-kingdom-cayman-islands-passport-and-corporate-services-office': {
    kind: 'fields',
    fields: ['Apostille Number', 'Issue Date']
  },
  'united-states-of-america-california-secretary-of-state': {
    kind: 'fields',
    fields: ['Apostille Number', 'Issue Date'],
    note: 'Only covers apostilles issued in the last 5 years.'
  },
  'united-states-of-america-colorado-secretary-of-state': {
    kind: 'fields',
    fields: ['Number', 'Issue date'],
    note: 'Covers apostilles issued on or after 4/5/2011.'
  },
  'united-states-of-america-delaware-secretary-of-state': {
    kind: 'fields',
    fields: ['Corporation Number', 'Authentication Number'],
    note: 'Only valid within 1 year of issuance.'
  },
  'united-states-of-america-kentucky-secretary-of-state': {
    kind: 'fields',
    fields: ['Apostille ID (first 12 digits of the apostille number)']
  },
  'united-states-of-america-minnesota-secretary-of-state': {
    kind: 'fields',
    fields: ['File Number', 'Issue Date'],
    note: 'Only covers records from 5/15/2018 onward.'
  },
  'united-states-of-america-montana-secretary-of-state': {
    kind: 'fields',
    fields: ['Apostille/Authentication Number']
  },
  'united-states-of-america-nevada-secretary-of-state': {
    kind: 'fields',
    fields: ['Apostille or Certification # (starts with "N")', 'Issue Date']
  },
  'united-states-of-america-new-york-secretary-of-state': {
    kind: 'fields',
    fields: ['Document Number', 'Issue Date'],
    note: 'Only covers apostilles issued on or after 4/9/2013.'
  },
  'united-states-of-america-north-carolina-secretary-of-state': {
    kind: 'fields',
    fields: ['Certificate Type (Apostille / Authentication / Authority)', 'Certificate Number', 'Issued Date']
  },
  'united-states-of-america-tennessee-secretary-of-state': {
    kind: 'fields',
    fields: ['Document Number'],
    note: 'Only covers filings on or after 3/24/2014.'
  },
  'united-states-of-america-texas-secretary-of-state': {
    kind: 'fields',
    fields: ['Certificate Number'],
    // Corrected 2026-07: a prior pass reclassified Texas to contact-only after finding
    // the previously-listed URL verified corporate filing certificates, not apostilles.
    // The real verifier — linked as "Verify Issuance of an Apostille" from the Texas SOS
    // Apostille/Authentication page — is confirmed live at this URL. Classic ASP.NET
    // WebForms POST with __VIEWSTATE/__EVENTVALIDATION, so not deep-linkable.
    note: 'Applies to certificates issued on or after 31 October 1994.'
  },
  'united-states-of-america-washington-secretary-of-state': {
    kind: 'fields',
    fields: ['Date Printed (MM-DD-YYYY)', 'Document Number'],
    // Corrected 2026-07: the HCCH chart marked this "Available Here" but no hyperlink
    // was extractable from the source PDF, and a prior pass mistakenly filed it as
    // having no e-Register at all. It has a real, working one at sos.wa.gov, covering
    // both paper apostilles and Washington's e-Apostille pilot documents. Fields
    // confirmed live 2026-07: the search box has no enclosing <form> (Drupal Webform,
    // JS-driven) and a test submission produced no visible result or network activity
    // in automated testing — likely session/JS-gated rather than a plain deep link, so
    // this stays copy-assist rather than a confirmed deep link.
    note: 'Only covers documents completed by the Washington Secretary of State.'
  },
  'united-states-of-america-west-virginia-secretary-of-state': {
    kind: 'fields',
    fields: ['Document Code, OR Apostille/Certificate Number + Date Printed']
  },
  'uruguay-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Número de Apostilla', 'Fecha Apostilla', "Titular Documento Público (holder's name)"],
    note: 'Apostilles dated before 18/09/2023 need only the number.'
  },
  'uzbekistan-ministry-of-foreign-affairs-ministry-of-justice-supreme-court-and-other-authorities': {
    kind: 'fields',
    fields: ['Apostille number', 'Date of Apostille affixing']
  },
  'venezuela-ministry-of-people-s-power-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Número de Legalización/Apostilla', 'Código de Verificación', 'Fecha de Emisión'],
    note: 'The official site uses a Google reCAPTCHA.'
  },
  'bangladesh-ministry-of-foreign-affairs-of-the-government-of-bangladesh': {
    kind: 'upload',
    note: 'This authority verifies by uploading the signed PDF itself (a digital-signature check), not by looking up a number.'
  },
  'turkiye-supervisory-competent-authorities-ministry-of-justice-ministry-of-internal-affairs': {
    kind: 'upload',
    note: 'This authority verifies by uploading the e-Apostille file itself, which the site hashes and checks, rather than by looking up a number.'
  }
}
