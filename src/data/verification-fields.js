// Verification helper metadata keyed by `e-registers.cleaned.json` entry `id`.
//
// `kind: 'fields'` lists what the user must enter on the official site.
// `deepLink` is included only when the official verifier supports a reliable direct GET
// or form POST navigation.
//
// `kind: 'upload'` marks authorities that verify by uploading the e-Apostille file itself
// rather than by looking up a number — conceptually closer to Phase 4 than Phase 2.
//
// Authorities absent from this file (but `online`/`hybrid` in the main dataset) had no
// confirmed field list from research — the UI falls back to the plain official link.

export const verificationFields = {
  'andorra-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Apostille/Legalization Number', 'Date'],
    // Clean POST form with no CSRF/CAPTCHA. Auto-submitted test values returned a real
    // result page. Legacy IBM LANSA app requires several static routing params.
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
  'austria-federal-ministry-for-europe-integration-and-foreign-affairs': {
    kind: 'upload',
    // Austria verifies e-Apostilles through RTR's signature-verification upload service
    // at signaturpruefung.egiz.gv.at. The tool checks the embedded digital signature in
    // the original file, so a printed copy or photo cannot be verified here.
    note: 'Upload the original e-Apostille PDF to verify its digital signature — a photo or scan of a paper apostille has no signature to check and won\'t work. Paper apostilles have no separate e-Register for this authority.'
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
    // Clean POST form with no CSRF/CAPTCHA. Invalid test values bounced back to the blank
    // form rather than a distinct "not found" page, but the POST navigation is real.
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
    // Clean POST form with no CSRF/CAPTCHA. Auto-submitted test values returned a clear
    // result page.
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
    note: 'The official site requires solving an image CAPTCHA and may take a few seconds to load.'
  },
  'colombia-ministry-of-foreign-affairs': {
    kind: 'fields',
    fields: ['Apostille/Legalization Number', 'Fecha de Expedición (Issue date)']
  },
  'costa-rica-ministry-of-foreign-affairs-and-worship': {
    kind: 'fields',
    fields: ['Código de la apostilla', 'Fecha de la apostilla (as YYYY-MM-DD)'],
    // Plain POST form with no working CSRF/CAPTCHA. The page still references a retired
    // Google ReCaptcha v1 widget, but submissions proceed and return a real result page.
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
    note: 'The official site requires solving an image-based verification code.'
  },
  'moldova-republic-of-ministry-of-justice': {
    kind: 'fields',
    fields: ['Apostille code', 'Security code'],
    note: 'Apostille numbers with an "ARIJ" prefix use a separate MPass-gated system (eservicii.gov.md). This direct flow applies only to other apostille codes.',
    // The visible page lazy-loads this form via an iframe; it is a clean POST with only
    // the two named fields and no hidden CSRF/CAPTCHA.
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
    note: 'The official site requires solving an image CAPTCHA on a session-bound form.'
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
    // Plain Joomla GET form. The resulting URL is a real, shareable result page rather
    // than an AJAX call.
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
    // Texas uses the Secretary of State's apostille verifier at this URL. It is a
    // classic ASP.NET WebForms POST with __VIEWSTATE/__EVENTVALIDATION, so it is not
    // deep-linkable.
    note: 'Applies to certificates issued on or after 31 October 1994.'
  },
  'united-states-of-america-washington-secretary-of-state': {
    kind: 'fields',
    fields: ['Date Printed (MM-DD-YYYY)', 'Document Number'],
    // Washington has a real verifier at sos.wa.gov for both paper apostilles and the
    // state's e-Apostille pilot documents. The search box is JS-driven with no enclosing
    // form, so this stays copy-assist rather than a confirmed deep link.
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
    // The file picker is restricted to PDF uploads, so this path is e-Apostille-only.
    note: 'Upload the original e-Apostille PDF to verify its digital signature — a photo or scan of a paper apostille has no signature to check and won\'t work (the site only accepts PDF uploads). Paper apostilles have no separate e-Register for this authority.'
  },
  'turkiye-supervisory-competent-authorities-ministry-of-justice-ministry-of-internal-affairs': {
    kind: 'upload',
    // The tool compares the uploaded file's exact hash against the originally issued
    // file. A photo, scan, or re-saved copy will not match.
    note: 'Upload the exact original e-Apostille PDF file — the site compares its file hash against the one it issued, so even a photo, scan, or re-saved copy won\'t match. Paper apostilles have no separate e-Register for this authority.'
  }
}
